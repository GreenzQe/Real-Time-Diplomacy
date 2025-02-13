const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Dummy database for sample purposes.
const players = [
  { id: 1, username: 'Player1', password: 'pass1', steel: 500, gold: 1000, ammo: 300, color: 'red' },
  { id: 2, username: 'Player2', password: 'pass2', steel: 400, gold: 900, ammo: 250, color: 'blue' }
];

let units = [];

let regions = [];

// POST /api/login: basic login endpoint.
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const player = players.find(p => p.username === username && p.password === password);
  if (player) {
    res.json({ success: true, player });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

// GET /api/game-state: returns the current state of players, units, and regions.
app.get('/api/game-state', (req, res) => {
  res.json({ players, units, regions });
});

//----- Socket.IO Setup -----//
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  
  // Send the current state to the new client.
  socket.emit("bulkUnitsData", units);
  socket.emit("bulkRegionsData", regions);
  
  // Listen for new unit creation.
socket.on("newUnitCreated", (data) => {
  const newUnit = {
    id: data.serverId,
    location: data.position,
    owner: data.owner
  };
  units.push(newUnit);
  io.emit("newUnitCreated", data); // Broadcast to ALL clients
});
  
  // Listen for unit movement.
  socket.on("moveUnit", (data) => {
    const unit = units.find(u => u.id === data.unitId);
    if (unit) {
      unit.location = data.currentPosition;
      io.emit("moveUnit", data);
    }
  });
  
  // Listen for region capture events.
  socket.on("regionCaptured", (data) => {
    const region = regions.find(r => r.id === data.regionId);
    if (region) {
      region.owner = data.newOwner;
      io.emit("regionCaptured", data);
    }
  });
  
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});