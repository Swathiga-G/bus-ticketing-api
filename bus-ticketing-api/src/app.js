const express = require('express');
const EventEmitter = require('events');

const app = express();
const ticketEmitter = new EventEmitter();

// Event listeners — this is the "event-driven logic"
ticketEmitter.on('ticket:booked', (data) => {
  console.log(`EVENT: Seat ${data.seat} booked by ${data.passenger_name} at ${new Date().toISOString()}`);
});

ticketEmitter.on('ticket:cancelled', (data) => {
  console.log(`EVENT: Seat ${data.seat} was cancelled at ${new Date().toISOString()}`);
});

ticketEmitter.on('ticket:reset', () => {
  console.log(`EVENT: All tickets reset by admin at ${new Date().toISOString()}`);
});

ticketEmitter.on('ticket:viewed', (data) => {
  console.log(`EVENT: Seat ${data.seat} was viewed at ${new Date().toISOString()}`);
});

app.use(express.json());

// Pass emitter to routes
app.use('/tickets', require('./routes/tickets')(ticketEmitter));

app.get('/', (req, res) => res.json({ message: 'Bus Ticketing API is running' }));
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

module.exports = app;