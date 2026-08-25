const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { env } = require('./config/env');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

// --- Security Headers ---
app.use(helmet());

// --- CORS ---
app.use(
  cors({
    origin: env.frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: false,
  }),
);

// --- Body Parsing ---
app.use(express.json({ limit: '1mb' }));

// --- Rate Limiting ---
// --- Rate Limiting (skip in test environment) ---
if (!env.isTest) {
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
    },
  });
  app.use('/api', generalLimiter);
}

// --- Routes ---
app.use('/api', routes);

// --- 404 Handler ---
app.use(notFoundHandler);

// --- Centralized Error Handler ---
app.use(errorHandler);

module.exports = app;
