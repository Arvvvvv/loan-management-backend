import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    // The JWT is only the authentication proof. The database user is the
    // authoritative owner identity used by all customer/loan operations.
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select('_id username avatar createdAt');
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });

    // Keep the existing req.user shape so the working controllers continue
    // to behave the same way, while replacing the id with the verified DB id.
    req.user = {
      id: user._id,
      username: user.username,
      avatar: user.avatar || '',
    };
    req.account = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
