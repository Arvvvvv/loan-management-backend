import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

function tokenFor(user) {
  return jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export async function register(req, res) {
  try {
    const { username, password, confirmPassword } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
    if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const exists = await User.findOne({ username: username.trim() });
    if (exists) return res.status(409).json({ message: 'Username already exists' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username: username.trim(), passwordHash });
    res.status(201).json({ token: tokenFor(user), user: { id: user._id, username: user.username } });
  } catch (e) { res.status(500).json({ message: e.message }); }
}

export async function login(req, res) {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username?.trim() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    res.json({ token: tokenFor(user), user: { id: user._id, username: user.username } });
  } catch (e) { res.status(500).json({ message: e.message }); }
}
