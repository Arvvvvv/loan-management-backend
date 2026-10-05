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
    res.status(201).json({ token: tokenFor(user), user: { id: user._id, username: user.username, avatar: user.avatar || '' } });
  } catch (e) { res.status(500).json({ message: e.message }); }
}
export async function login(req, res) {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username?.trim() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    res.json({ token: tokenFor(user), user: { id: user._id, username: user.username, avatar: user.avatar || '' } });
  } catch (e) { res.status(500).json({ message: e.message }); }
}
export async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id).select('_id username avatar createdAt');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: { id: user._id, username: user.username, avatar: user.avatar || '', createdAt: user.createdAt } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
export async function updateProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { username, avatar } = req.body;
    if (username !== undefined) {
      const cleanUsername = String(username).trim();
      if (!cleanUsername) return res.status(400).json({ message: 'Username cannot be empty' });
      const duplicate = await User.findOne({ username: cleanUsername, _id: { $ne: user._id } });
      if (duplicate) return res.status(409).json({ message: 'Username already exists' });
      user.username = cleanUsername;
    }
    if (avatar !== undefined) {
      const avatarValue = String(avatar || '');
      const isPreset = avatarValue.startsWith('preset:');
      const isImage = avatarValue.startsWith('data:image/');
      if (avatarValue && !isPreset && !isImage) {
        return res.status(400).json({ message: 'Avatar must be a valid image or a built-in avatar.' });
      }
      if (isImage && avatarValue.length > 900000) {
        return res.status(400).json({ message: 'Avatar image is still too large after compression. Please crop or choose a smaller image.' });
      }
      user.avatar = avatarValue;
    }
    await user.save();
    res.json({ user: { id: user._id, username: user.username, avatar: user.avatar || '', createdAt: user.createdAt } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new passwords are required' });
    if (newPassword !== confirmPassword) return res.status(400).json({ message: 'New passwords do not match' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
