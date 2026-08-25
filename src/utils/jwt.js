const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

/**
 * Generate a JWT access token.
 * @param {Object} user - User object with _id and email
 * @returns {string} Signed JWT
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

/**
 * Verify and decode a JWT.
 * @param {string} token - JWT string
 * @returns {Object} Decoded payload
 * @throws {JsonWebTokenError|TokenExpiredError}
 */
function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = { generateToken, verifyToken };
