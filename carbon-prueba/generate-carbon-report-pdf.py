"""Generate the final MARA carbon-footprint report as a polished PDF."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


CARBON_DIR = Path(__file__).resolve().parent
ROOT = CARBON_DIR.parent
OUTPUT = CARBON_DIR / "informes" / "informe-huella-carbono-mara.pdf"

NAVY = colors.HexColor("#123047")
TEAL = colors.HexColor("#129E96")
LIGHT_TEAL = colors.HexColor("#E6F5F3")
PALE = colors.HexColor("#F3F6F8")
MID = colors.HexColor("#D5E0E6")
TEXT = colors.HexColor("#21313C")
MUTED = colors.HexColor("#5B6B75")
AMBER = colors.HexColor("#F3B33D")


def register_fonts():
    regular = Path(r"C:\Windows\Fonts\arial.ttf")
    bold = Path(r"C:\Windows\Fonts\arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("Report", str(regular)))
        pdfmetrics.registerFont(TTFont("Report-Bold", str(bold)))
        return "Report", "Report-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def footer(canvas, document):
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(MID)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFont(FONT, 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "MARA - Informe de huella de carbono")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"Pagina {document.page}")
    canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        "CoverTitle",
        fontName=FONT_BOLD,
        fontSize=25,
        leading=30,
        textColor=NAVY,
        alignment=TA_LEFT,
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        "CoverSub",
        fontName=FONT,
        fontSize=12,
        leading=18,
        textColor=MUTED,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        "Section",
        fontName=FONT_BOLD,
        fontSize=15,
        leading=19,
        textColor=NAVY,
        spaceBefore=8,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        "BodyReport",
        fontName=FONT,
        fontSize=9.5,
        leading=14,
        textColor=TEXT,
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        "Small",
        fontName=FONT,
        fontSize=8,
        leading=11,
        textColor=MUTED,
    )
)
styles.add(
    ParagraphStyle(
        "MetricValue",
        fontName=FONT_BOLD,
        fontSize=19,
        leading=22,
        textColor=TEAL,
        alignment=TA_CENTER,
    )
)
styles.add(
    ParagraphStyle(
        "MetricLabel",
        fontName=FONT,
        fontSize=8,
        leading=10,
        textColor=MUTED,
        alignment=TA_CENTER,
    )
)


def p(text, style="BodyReport"):
    return Paragraph(text, styles[style])


def metric(value, label):
    return [p(value, "MetricValue"), p(label, "MetricLabel")]


def styled_table(data, widths, header=True, alignments=None):
    table = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    commands = [
        ("FONTNAME", (0, 0), (-1, -1), FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 8.2),
        ("TEXTCOLOR", (0, 0), (-1, -1), TEXT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.35, MID),
        ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [colors.white, PALE]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    if header:
        commands += [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ]
    if alignments:
        for column, alignment in enumerate(alignments):
            commands.append(("ALIGN", (column, 1 if header else 0), (column, -1), alignment))
    table.setStyle(TableStyle(commands))
    return table


def bullet(text):
    return p(f"- {text}")


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title="Informe de huella de carbono - Backend MARA",
        author="Proyecto MARA",
    )
    story = []

    story += [
        Spacer(1, 20 * mm),
        p("INFORME TECNICO", "CoverSub"),
        p("Medicion de huella de carbono", "CoverTitle"),
        p("Backend MARA - Asistente Conversacional Taller Reyes Polo", "CoverSub"),
        Spacer(1, 12 * mm),
    ]
    metric_table = Table(
        [[metric("27.99 W", "Potencia media bajo carga"), metric("7.46 gCO2e/h", "Emisiones estimadas en Peru"), metric("0.322 gCO2e", "Por 1 millon de solicitudes")]],
        colWidths=[55 * mm, 55 * mm, 55 * mm],
    )
    metric_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT_TEAL),
                ("BOX", (0, 0), (-1, -1), 0.7, TEAL),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story += [
        metric_table,
        Spacer(1, 12 * mm),
        p("Fecha de medicion: 28 de septiembre de 2026"),
        p("Ubicacion electrica aplicada: Peru (PER)"),
        p("Herramienta: CodeCarbon 3.3.1 | Carga: Autocannon 8.0.0"),
        Spacer(1, 15 * mm),
        p(
            "Este documento presenta una linea base reproducible del consumo operativo local. "
            "Distingue el consumo bruto del equipo y la diferencia observada frente al reposo, "
            "sin atribuir falsa precision al proceso Express.",
            "CoverSub",
        ),
        PageBreak(),
    ]

    story += [p("1. Resumen ejecutivo", "Section")]
    executive = [
        ["Indicador", "Resultado"],
        ["Equipo con backend en reposo", "25.77 W | 6.87 gCO2e/h"],
        ["Equipo bajo carga", "27.99 W | 7.46 gCO2e/h"],
        ["Rendimiento observado", "6,431.90 solicitudes/s"],
        ["Costo bruto por 1 millon de solicitudes", "1.209 Wh | 0.322 gCO2e"],
        ["Calidad HTTP", "0 errores, 0 timeouts, 0 no-2xx"],
    ]
    story += [styled_table(executive, [95 * mm, 70 * mm], alignments=["LEFT", "RIGHT"]), Spacer(1, 5 * mm)]
    warning = Table(
        [[p("LECTURA RESPONSABLE", "Small"), p("La diferencia media carga-reposo fue 2.21 W, pero la desviacion entre rondas fue 5.86 W. La senal incremental no se distingue con confianza del ruido del portatil.", "Small")]],
        colWidths=[35 * mm, 130 * mm],
    )
    warning.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF5DE")),
                ("BOX", (0, 0), (-1, -1), 0.7, AMBER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("FONTNAME", (0, 0), (0, 0), FONT_BOLD),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story += [warning, Spacer(1, 4 * mm)]

    story += [
        p("2. Alcance y metodologia", "Section"),
        p("La prueba midio CPU, GPU y RAM de todo el equipo en modo machine. El backend Node.js/Express y el generador de carga se ejecutaron como procesos separados en Windows 11."),
        bullet("Tres rondas alternadas de reposo y carga, con 60 segundos por fase."),
        bullet("20 conexiones concurrentes contra GET / y GET /politica-privacidad."),
        bullet("1,158,193 solicitudes totales; latencia media 3.53 ms; p99 promedio 9 ms."),
        bullet("Intel Core i7-11370H, NVIDIA RTX 3050 Laptop y 15.70 GB de RAM."),
        p("CodeCarbon calcula CO2e como energia consumida multiplicada por la intensidad de carbono de la electricidad. Para evitar una ubicacion incorrecta por IP, se fijo Peru mediante OfflineEmissionsTracker. El factor usado fue 266.478 gCO2e/kWh."),
    ]

    story += [p("3. Resultados por ronda", "Section")]
    rounds = [
        ["Ronda", "Reposo W", "Carga W", "Diferencia W", "Solicitudes", "Req/s"],
        ["1", "23.45", "27.77", "+4.32", "503,036", "8,384.94"],
        ["2", "24.15", "19.74", "-4.41", "162,253", "2,704.74"],
        ["3", "29.72", "36.45", "+6.73", "492,904", "8,215.57"],
        ["Promedio", "25.77", "27.99", "+2.21", "1,158,193 total", "6,431.90"],
    ]
    story += [styled_table(rounds, [24 * mm, 25 * mm, 25 * mm, 28 * mm, 35 * mm, 28 * mm], alignments=["CENTER"] * 6)]
    story += [
        Spacer(1, 3 * mm),
        p("La ronda 2 produjo una diferencia negativa. Esto no implica que la carga ahorre energia; demuestra que la variacion de procesos de fondo y estados energeticos del hardware fue mayor que la senal que se queria aislar."),
        PageBreak(),
    ]

    story += [p("4. Interpretacion y proyecciones", "Section")]
    projections = [
        ["Escenario teorico 24/7", "Energia diaria", "Emisiones anuales"],
        ["Backend en reposo", "0.619 kWh/dia", "60.17 kgCO2e/ano"],
        ["Carga sostenida del ensayo", "0.672 kWh/dia", "65.33 kgCO2e/ano"],
    ]
    story += [styled_table(projections, [75 * mm, 45 * mm, 45 * mm], alignments=["LEFT", "RIGHT", "RIGHT"]), Spacer(1, 3 * mm)]
    story += [
        p("Estas proyecciones representan el portatil local encendido continuamente. No representan un despliegue en Railway u otro proveedor cloud, donde cambian el hardware, la region electrica, el nivel de utilizacion y el PUE del centro de datos."),
        p("5. Limitaciones", "Section"),
        bullet("El valor bruto incluye Windows, el generador de carga y procesos de fondo."),
        bullet("Los endpoints medidos son ligeros; no incluyen un flujo completo con MySQL ni proveedores externos."),
        bullet("CodeCarbon local no mide la infraestructura de OpenAI, Google Calendar, WhatsApp, Retell o LiveKit."),
        bullet("Tres rondas cortas aportan una linea base, no una estimacion de produccion de alta confianza."),
        bullet("CPU, GPU y RAM se miden o estiman; pantalla, disco, red, perifericos y carbono incorporado quedan fuera."),
        bullet("El factor de Peru es un promedio nacional, no una lectura en tiempo real de La Libertad."),
        p("6. Conclusion", "Section"),
        p("Durante el benchmark local, el equipo consumio en promedio 27.99 W bajo carga, equivalente a 7.46 gCO2e por hora con el factor electrico de Peru. El valor bruto normalizado fue 1.209 Wh y 0.322 gCO2e por millon de solicitudes."),
        p("La diferencia incremental media fue 2.21 W, pero no supero la variabilidad observada. El siguiente nivel de rigor consiste en medir 15 a 30 minutos por ronda en el servidor real, con trafico representativo, al menos cinco rondas y, de ser posible, un medidor electrico externo."),
    ]

    story += [p("7. Trazabilidad", "Section")]
    trace = [
        ["Elemento", "Archivo o valor"],
        ["Datos crudos", "carbon-prueba/resultados/codecarbon-20260928-193904.csv"],
        ["Detalle", "carbon-prueba/resultados/measurement-20260928-193904.json"],
        ["Resumen Peru", "carbon-prueba/resultados/summary-peru-20260928.json"],
        ["Script", "carbon-prueba/measure-carbon.py"],
        ["Carga", "carbon-prueba/carbon-load.js"],
    ]
    story += [styled_table(trace, [45 * mm, 120 * mm], alignments=["LEFT", "LEFT"]), Spacer(1, 4 * mm)]
    story += [
        p("Fuentes metodologicas", "Section"),
        p("CodeCarbon Methodology - https://mlco2.github.io/codecarbon/methodology.html", "Small"),
        p("CodeCarbon Parameters - https://mlco2.github.io/codecarbon/parameters.html", "Small"),
        p("CodeCarbon README - https://github.com/mlco2/codecarbon/blob/master/README.md", "Small"),
    ]

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
