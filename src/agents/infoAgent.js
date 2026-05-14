const db = require('../config/database');

function infoAgent() {
  return new Promise((resolve, reject) => {

    const sql = `
      SELECT *
      FROM info_taller
    `;

    db.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve({
        intent: "info",
        data: results
      });
    });

  });
}

module.exports = infoAgent;