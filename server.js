const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(cors()); // Allow all origins
app.use(bodyParser.json());
app.use(express.static('public'));

// Dummy database for sample purposes.
let players = [
  {
    id: 1,
    username: 'Player1',
    password: 'pass1',
    color: 'red',
    steel: 500,
    gold: 1000,
    ammo: 300
  },
  {
    id: 2,
    username: 'Player2',
    password: 'pass2',
    color: 'blue',
    steel: 500,
    gold: 1000,
    ammo: 300
  },
  {
    id: 3,
    username: 'Player3',
    password: 'pass3',
    color: 'green',
    steel: 500,
    gold: 1000,
    ammo: 300
  }
];

let armies = [
  // Army: ID, Location, and Direction.
];

let regions = [
  // Region: ID, Owner, HasMine.
];

app.use(bodyParser.json());
app.use(express.static('public')); // Place your static HTML/JS files in a "public" folder

// POST /api/login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const player = players.find(p => p.username === username && p.password === password);
  if (player) {
    res.json({ success: true, player });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

// GET /api/game-state returns army, player, and region data.
app.get('/api/game-state', (req, res) => {
  res.json({ players, armies, regions });
});

// Example endpoint to update an army.
app.post('/api/army/update', (req, res) => {
  const { id, location, direction } = req.body;
  const army = armies.find(a => a.id === id);
  if (army) {
    army.location = location;
    army.direction = direction;
    res.json({ success: true, army });
  } else {
    res.json({ success: false, message: 'Army not found' });
  }
});

// Example endpoint to update a region.
app.post('/api/region/update', (req, res) => {
  const { id, owner, hasMine } = req.body;
  const region = regions.find(r => r.id === id);
  if (region) {
    region.owner = owner;
    region.hasMine = hasMine;
    res.json({ success: true, region });
  } else {
    res.json({ success: false, message: 'Region not found' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});