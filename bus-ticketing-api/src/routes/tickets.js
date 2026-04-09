const express = require('express');
const db = require('../db');

module.exports = (ticketEmitter) => {
  const router = express.Router();

  // All tickets
  router.get('/', (req, res) => {
    db.all(`SELECT * FROM tickets ORDER BY seat_number`, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ total: rows.length, tickets: rows });
    });
  });

  // Open tickets
  router.get('/open', (req, res) => {
    db.all(`SELECT * FROM tickets WHERE status='open' ORDER BY seat_number`, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ total: rows.length, tickets: rows });
    });
  });

  // Closed tickets
  router.get('/closed', (req, res) => {
    db.all(`SELECT * FROM tickets WHERE status='closed' ORDER BY seat_number`, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ total: rows.length, tickets: rows });
    });
  });

  // Admin reset — before /:seat
  router.post('/admin/reset', (req, res) => {
    const { admin_key } = req.body;
    if (admin_key !== process.env.ADMIN_KEY)
      return res.status(403).json({ error: 'Unauthorized' });
    db.run(
      `UPDATE tickets SET status='open', passenger_name=NULL, passenger_email=NULL, passenger_phone=NULL, booked_at=NULL`,
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        ticketEmitter.emit('ticket:reset');
        res.json({ message: 'All 40 tickets reset to open' });
      }
    );
  });

  // Passenger details — before /:seat
  router.get('/:seat/passenger', (req, res) => {
    const seat = parseInt(req.params.seat);
    db.get(`SELECT * FROM tickets WHERE seat_number=?`, [seat], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Ticket not found' });
      if (row.status === 'open') return res.status(400).json({ error: 'No passenger — ticket is open' });
      res.json({
        seat_number: row.seat_number,
        passenger_name: row.passenger_name,
        passenger_email: row.passenger_email,
        passenger_phone: row.passenger_phone,
        booked_at: row.booked_at
      });
    });
  });

  // Single ticket status
  router.get('/:seat', (req, res) => {
    const seat = parseInt(req.params.seat);
    if (seat < 1 || seat > 40) return res.status(400).json({ error: 'Seat must be 1–40' });
    db.get(`SELECT * FROM tickets WHERE seat_number=?`, [seat], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Ticket not found' });
      ticketEmitter.emit('ticket:viewed', { seat });
      res.json(row);
    });
  });

  // Book or cancel a ticket
  router.patch('/:seat', (req, res) => {
    const seat = parseInt(req.params.seat);
    const { status, passenger_name, passenger_email, passenger_phone } = req.body;

    if (!['open', 'closed'].includes(status))
      return res.status(400).json({ error: 'Status must be "open" or "closed"' });

    if (status === 'closed') {
      if (!passenger_name || !passenger_email || !passenger_phone)
        return res.status(400).json({ error: 'passenger_name, passenger_email, and passenger_phone are required' });

      db.get(`SELECT * FROM tickets WHERE seat_number=?`, [seat], (err, row) => {
        if (!row) return res.status(404).json({ error: 'Ticket not found' });
        if (row.status === 'closed') return res.status(409).json({ error: 'Seat already booked' });

        db.run(
          `UPDATE tickets SET status='closed', passenger_name=?, passenger_email=?, passenger_phone=?, booked_at=? WHERE seat_number=?`,
          [passenger_name, passenger_email, passenger_phone, new Date().toISOString(), seat],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            ticketEmitter.emit('ticket:booked', { seat, passenger_name });
            res.json({ message: `Seat ${seat} booked successfully` });
          }
        );
      });
    } else {
      db.run(
        `UPDATE tickets SET status='open', passenger_name=NULL, passenger_email=NULL, passenger_phone=NULL, booked_at=NULL WHERE seat_number=?`,
        [seat],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Ticket not found' });
          ticketEmitter.emit('ticket:cancelled', { seat });
          res.json({ message: `Seat ${seat} released successfully` });
        }
      );
    }
  });

  return router;
};