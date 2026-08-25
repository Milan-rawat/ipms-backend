const { Router } = require('express');
const { env } = require('../config/env');
const authRoutes = require('./auth.routes');

const router = Router();

/**
 * GET /api/health
 * Liveness check — confirms the server is running and responsive.
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    },
  });
});

// --- Feature Routes ---
router.use('/auth', authRoutes);
router.use('/projects', require('./project.routes'));

module.exports = router;
