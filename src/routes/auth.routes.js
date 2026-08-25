const { Router } = require('express');
const Joi = require('joi');
const validate = require('../middleware/validate.middleware');
const authenticate = require('../middleware/auth.middleware');
const authController = require('../controllers/auth.controller');

const router = Router();

// --- Validation Schemas ---

const registerSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(50).required()
      .messages({
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name must be at most 50 characters',
        'any.required': 'Name is required',
      }),
    email: Joi.string().trim().lowercase().email().required()
      .messages({
        'string.email': 'Please provide a valid email',
        'any.required': 'Email is required',
      }),
    password: Joi.string().min(6).max(128).required()
      .messages({
        'string.min': 'Password must be at least 6 characters',
        'any.required': 'Password is required',
      }),
  }),
};

const loginSchema = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required()
      .messages({
        'string.email': 'Please provide a valid email',
        'any.required': 'Email is required',
      }),
    password: Joi.string().required()
      .messages({
        'any.required': 'Password is required',
      }),
  }),
};

// --- Routes ---

// POST /api/auth/register — public
router.post('/register', validate(registerSchema), authController.register);

// POST /api/auth/login — public
router.post('/login', validate(loginSchema), authController.login);

// POST /api/auth/logout — authenticated
router.post('/logout', authenticate, authController.logout);

// GET /api/auth/me — authenticated
router.get('/me', authenticate, authController.getMe);

module.exports = router;
