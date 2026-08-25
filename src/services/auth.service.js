const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { generateToken } = require('../utils/jwt');

/**
 * Register a new user.
 * @param {Object} data - { name, email, password }
 * @returns {Object} { user, token }
 */
async function registerUser({ name, email, password }) {
  // Check if email already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict('Email already registered');
  }

  // Create user (password hashed by pre-save hook)
  const user = await User.create({ name, email, password });

  // Generate JWT
  const token = generateToken(user);

  return { user: user.toSafeObject(), token };
}

/**
 * Authenticate a user with email and password.
 * @param {Object} data - { email, password }
 * @returns {Object} { user, token }
 */
async function loginUser({ email, password }) {
  // Find user with password field included
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Compare passwords
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Generate JWT
  const token = generateToken(user);

  return { user: user.toSafeObject(), token };
}

/**
 * Get current user by ID.
 * @param {string} userId
 * @returns {Object} Sanitized user object
 */
async function getCurrentUser(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  return user.toSafeObject();
}

module.exports = { registerUser, loginUser, getCurrentUser };
