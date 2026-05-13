const db = require('../config/database');

function scheduleAgent() {
  return new Promise((resolve, reject) => {

    const sql = `
      SELECT *
      FROM horarios
    `;

    db.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve({
        intent: "schedule",
        data: results
      });
    });

  });
}

module.exports = scheduleAgent;