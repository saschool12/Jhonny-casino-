const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const db = require('./db');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(cors({ origin: true, credentials: true }));
app.use(session({
  secret: 'casino-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24*60*60*1000 }
}));

// ---------- AUTH ROUTES ----------
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }
  const hashed = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (username, email, password) VALUES (?,?,?)', [username, email, hashed], function(err) {
    if (err) return res.status(400).json({ error: 'Username or email taken' });
    req.session.userId = this.lastID;
    req.session.username = username;
    res.json({ success: true, user: { id: this.lastID, username } });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (!user) return res.status(400).json({ error: 'User not found' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid password' });
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, user: { id: user.id, username: user.username, avatar: user.avatar } });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  db.get('SELECT id, username, email, avatar FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    res.json(user);
  });
});

// ---------- SCORE ROUTES ----------
app.post('/api/score', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  const { game, score } = req.body;
  db.run('INSERT INTO scores (user_id, game, score) VALUES (?,?,?)', [req.session.userId, game, score]);
  res.json({ success: true });
});

app.get('/api/leaderboard/:game', (req, res) => {
  const game = req.params.game;
  db.all(`SELECT users.username, scores.score, scores.date 
          FROM scores 
          JOIN users ON scores.user_id = users.id 
          WHERE scores.game = ? 
          ORDER BY scores.score DESC LIMIT 10`, [game], (err, rows) => {
    res.json(rows);
  });
});

app.get('/api/scores/:userId', (req, res) => {
  db.all('SELECT game, score FROM scores WHERE user_id = ? ORDER BY score DESC', [req.params.userId], (err, rows) => {
    res.json(rows);
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🎰 Casino running on http://localhost:${PORT}`));
