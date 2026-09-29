"""Measure the local MARA backend with CodeCarbon.

The tracker deliberately uses machine mode because the backend and the load
generator are separate Node.js processes. Results therefore include the whole
computer during each measurement window. Alternating idle/load rounds makes it
possible to estimate the workload's incremental energy by subtracting the idle
power observed on the same machine.
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import subprocess
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

from codecarbon import OfflineEmissionsTracker


CARBON_DIR = Path(__file__).resolve().parent
ROOT = CARBON_DIR.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:3100")
    parser.add_argument("--seconds", type=int, default=60)
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--connections", type=int, default=20)
    parser.add_argument("--cooldown", type=int, default=10)
    parser.add_argument(
        "--country-iso-code",
        default="PER",
        help="Codigo ISO-3 del pais donde se ejecuta el equipo (por defecto: PER).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=CARBON_DIR / "resultados",
    )
    return parser.parse_args()


def check_backend(base_url: str) -> None:
    with urllib.request.urlopen(f"{base_url}/", timeout=10) as response:
        if response.status != 200:
            raise RuntimeError(f"Backend no disponible: HTTP {response.status}")


def run_load(base_url: str, seconds: int, connections: int) -> dict:
    command = [
        "node",
        str(CARBON_DIR / "carbon-load.js"),
        "--base-url",
        base_url,
        "--duration",
        str(seconds),
        "--connections",
        str(connections),
    ]
    completed = subprocess.run(
        command,
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    output_lines = [line for line in completed.stdout.splitlines() if line.strip()]
    if not output_lines:
        raise RuntimeError("La prueba de carga no devolvio resultados.")
    return json.loads(output_lines[-1])


def read_latest_measurement(csv_path: Path, project_name: str) -> dict:
    with csv_path.open(newline="", encoding="utf-8") as handle:
        matches = [
            row
            for row in csv.DictReader(handle)
            if row["project_name"] == project_name
        ]
    if not matches:
        raise RuntimeError(f"No se encontro la medicion {project_name}.")
    return matches[-1]


def measure_phase(
    phase: str,
    round_number: int,
    args: argparse.Namespace,
    csv_path: Path,
) -> dict:
    project_name = f"MARA_{phase.upper()}_R{round_number}"
    # OfflineEmissionsTracker avoids incorrect IP geolocation (for example,
    # when a VPN makes a Peruvian machine appear to be in another country).
    tracker = OfflineEmissionsTracker(
        country_iso_code=args.country_iso_code,
        project_name=project_name,
        output_dir=str(args.output_dir),
        output_file=csv_path.name,
        save_to_file=True,
        tracking_mode="machine",
        measure_power_secs=5,
        log_level="error",
    )

    print(
        f"[{datetime.now().isoformat(timespec='seconds')}] "
        f"Iniciando {project_name} ({args.seconds}s)",
        flush=True,
    )
    tracker.start()
    load_result = None
    if phase == "idle":
        time.sleep(args.seconds)
    else:
        load_result = run_load(args.base_url, args.seconds, args.connections)
    tracker.stop()

    row = read_latest_measurement(csv_path, project_name)
    result = {
        "phase": phase,
        "round": round_number,
        "project_name": project_name,
        "duration_seconds": float(row["duration"]),
        "energy_kwh": float(row["energy_consumed"]),
        "emissions_kg_co2e": float(row["emissions"]),
        "carbon_intensity_g_co2e_per_kwh": (
            float(row["emissions"]) * 1_000 / float(row["energy_consumed"])
        ),
        "cpu_energy_kwh": float(row["cpu_energy"]),
        "gpu_energy_kwh": float(row["gpu_energy"]),
        "ram_energy_kwh": float(row["ram_energy"]),
        "cpu_power_w": float(row["cpu_power"]),
        "gpu_power_w": float(row["gpu_power"]),
        "ram_power_w": float(row["ram_power"]),
        "country": row["country_name"],
        "region": row["region"],
        "codecarbon_version": row["codecarbon_version"],
        "cpu_model": row["cpu_model"],
        "gpu_model": row["gpu_model"],
        "ram_total_gb": float(row["ram_total_size"]),
        "load": load_result,
    }
    print(
        f"[{datetime.now().isoformat(timespec='seconds')}] "
        f"Termino {project_name}: {result['energy_kwh']:.8f} kWh, "
        f"{result['emissions_kg_co2e'] * 1_000:.6f} gCO2e",
        flush=True,
    )
    return result


def mean(items: list[float]) -> float:
    return statistics.fmean(items)


def build_summary(results: list[dict], args: argparse.Namespace) -> dict:
    idle = [row for row in results if row["phase"] == "idle"]
    load = [row for row in results if row["phase"] == "load"]

    idle_power_w = [row["energy_kwh"] * 3_600_000 / row["duration_seconds"] for row in idle]
    load_power_w = [row["energy_kwh"] * 3_600_000 / row["duration_seconds"] for row in load]
    idle_carbon_g_h = [row["emissions_kg_co2e"] * 1_000 * 3_600 / row["duration_seconds"] for row in idle]
    load_carbon_g_h = [row["emissions_kg_co2e"] * 1_000 * 3_600 / row["duration_seconds"] for row in load]

    total_requests = sum(row["load"]["requests_total"] for row in load)
    total_load_seconds = sum(row["load"]["duration_seconds"] for row in load)
    incremental_power_w = mean(load_power_w) - mean(idle_power_w)
    incremental_carbon_g_h = mean(load_carbon_g_h) - mean(idle_carbon_g_h)
    paired_power_differences_w = [
        loaded - resting for resting, loaded in zip(idle_power_w, load_power_w)
    ]
    requests_per_second = total_requests / total_load_seconds
    incremental_wh_per_request = (
        incremental_power_w / 3_600 / requests_per_second
        if requests_per_second
        else 0.0
    )
    incremental_g_per_request = (
        incremental_carbon_g_h / 3_600 / requests_per_second
        if requests_per_second
        else 0.0
    )
    gross_wh_per_request = (
        mean(load_power_w) / 3_600 / requests_per_second
        if requests_per_second
        else 0.0
    )
    gross_g_per_request = (
        mean(load_carbon_g_h) / 3_600 / requests_per_second
        if requests_per_second
        else 0.0
    )

    first = results[0]
    return {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "base_url": args.base_url,
        "rounds": args.rounds,
        "target_seconds_per_phase": args.seconds,
        "connections": args.connections,
        "tracking_mode": "machine",
        "hardware": {
            "cpu": first["cpu_model"],
            "gpu": first["gpu_model"],
            "ram_gb": first["ram_total_gb"],
        },
        "location": {
            "country": first["country"],
            "region": first["region"],
            "country_iso_code_requested": args.country_iso_code,
        },
        "carbon_intensity_g_co2e_per_kwh": mean(
            [row["carbon_intensity_g_co2e_per_kwh"] for row in results]
        ),
        "codecarbon_version": first["codecarbon_version"],
        "idle": {
            "average_power_w": mean(idle_power_w),
            "average_emissions_g_co2e_per_hour": mean(idle_carbon_g_h),
        },
        "load": {
            "average_power_w": mean(load_power_w),
            "average_emissions_g_co2e_per_hour": mean(load_carbon_g_h),
            "requests_total": total_requests,
            "requests_per_second": requests_per_second,
            "average_latency_ms": mean([row["load"]["latency_average_ms"] for row in load]),
            "p99_latency_ms": mean([row["load"]["latency_p99_ms"] for row in load]),
            "errors": sum(row["load"]["errors"] for row in load),
            "timeouts": sum(row["load"]["timeouts"] for row in load),
            "non_2xx": sum(row["load"]["responses_non_2xx"] for row in load),
            "energy_wh_per_request": gross_wh_per_request,
            "emissions_g_co2e_per_request": gross_g_per_request,
        },
        "incremental_workload": {
            "power_w": incremental_power_w,
            "paired_power_stddev_w": statistics.stdev(paired_power_differences_w)
            if len(paired_power_differences_w) > 1
            else 0.0,
            "paired_power_min_w": min(paired_power_differences_w),
            "paired_power_max_w": max(paired_power_differences_w),
            "emissions_g_co2e_per_hour": incremental_carbon_g_h,
            "energy_wh_per_request": incremental_wh_per_request,
            "emissions_g_co2e_per_request": incremental_g_per_request,
            "requests_per_kwh": 1_000 / incremental_wh_per_request
            if incremental_wh_per_request
            else None,
        },
    }


def main() -> int:
    args = parse_args()
    if args.seconds < 30:
        raise ValueError("Usa al menos 30 segundos por fase para una medicion estable.")
    if args.rounds < 1:
        raise ValueError("--rounds debe ser al menos 1.")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    check_backend(args.base_url)

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    csv_path = args.output_dir / f"codecarbon-{stamp}.csv"
    detail_path = args.output_dir / f"measurement-{stamp}.json"
    summary_path = args.output_dir / f"summary-{stamp}.json"
    results: list[dict] = []

    for round_number in range(1, args.rounds + 1):
        results.append(measure_phase("idle", round_number, args, csv_path))
        time.sleep(args.cooldown)
        results.append(measure_phase("load", round_number, args, csv_path))
        if round_number < args.rounds:
            time.sleep(args.cooldown)

    summary = build_summary(results, args)
    detail_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(json.dumps(summary, indent=2), flush=True)
    print(f"Datos CodeCarbon: {csv_path}", flush=True)
    print(f"Detalle: {detail_path}", flush=True)
    print(f"Resumen: {summary_path}", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr, flush=True)
        raise
