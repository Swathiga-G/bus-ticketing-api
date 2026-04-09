const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../tickets.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY,
      seat_number INTEGER UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      passenger_name TEXT,
      passenger_email TEXT,
      passenger_phone TEXT,
      booked_at TEXT
    )
  `);

  db.get(`SELECT COUNT(*) as count FROM tickets`, (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare(`INSERT INTO tickets (seat_number, status) VALUES (?, 'open')`);
      for (let i = 1; i <= 40; i++) stmt.run(i);
      stmt.finalize();
      console.log('✅ 40 seats seeded');
    }
  });
});

module.exports = db;