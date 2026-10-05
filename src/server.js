import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import loanRoutes from './routes/loanRoutes.js';

const app = express();

/* =========================================================
   CORS
   ========================================================= */

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',

  // Capacitor Android WebView origins
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost',

  // Production web frontend
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || '').split(',').map(url => url.trim())
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header
      // such as Postman or direct server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked origin: ${origin}`)
      );
    }
  })
);

/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(express.json({ limit: '8mb' }));

/* =========================================================
   ROOT / STATUS ROUTE
   ========================================================= */

app.get('/', (req, res) => {
  res.json({
    message: 'Business Loan Management API is running',
    status: 'success'
  });
});

/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Business Loan API is running'
  });
});

/* =========================================================
   API ROUTES
   ========================================================= */

app.use('/api/auth', authRoutes);

app.use('/api/customers', customerRoutes);

app.use('/api/loans', loanRoutes);

/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use((err, req, res, next) => {
  console.error(err);

  if (err.message?.startsWith('CORS blocked')) {
    return res.status(403).json({
      message: err.message
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'Profile image is too large. Please choose a smaller image.'
    });
  }

  res.status(500).json({
    message: err.message || 'Server error'
  });
});

/* =========================================================
   SERVER
   ========================================================= */

const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error(
      'MongoDB connection failed:',
      err.message
    );

    process.exit(1);
  });