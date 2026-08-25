const { Router } = require('express');
const Joi = require('joi');
const validate = require('../middleware/validate.middleware');
const authenticate = require('../middleware/auth.middleware');
const { requireProjectMember, requireProjectAdmin } = require('../middleware/authorize.middleware');
const projectController = require('../controllers/project.controller');

const router = Router();

// --- Validation Schemas ---

const createProjectSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.min': 'Project name must be at least 2 characters',
        'string.max': 'Project name must be at most 100 characters',
        'any.required': 'Project name is required',
      }),
    description: Joi.string().trim().max(500).allow('').optional()
      .messages({
        'string.max': 'Description must be at most 500 characters',
      }),
  }),
};

const updateProjectSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional()
      .messages({
        'string.min': 'Project name must be at least 2 characters',
        'string.max': 'Project name must be at most 100 characters',
      }),
    description: Joi.string().trim().max(500).allow('').optional()
      .messages({
        'string.max': 'Description must be at most 500 characters',
      }),
  }).min(1).messages({
    'object.min': 'At least one field (name or description) must be provided',
  }),
};

const addMemberSchema = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required()
      .messages({
        'string.email': 'Please provide a valid email',
        'any.required': 'Email is required',
      }),
  }),
};

// --- Routes ---

// All project routes require authentication
router.use(authenticate);

// POST /api/projects — create project
router.post('/', validate(createProjectSchema), projectController.create);

// GET /api/projects — list user's projects
router.get('/', projectController.list);

// GET /api/projects/:id — get project (member)
router.get('/:id', requireProjectMember, projectController.get);

// PUT /api/projects/:id — update project (admin)
router.put('/:id', requireProjectAdmin, validate(updateProjectSchema), projectController.update);

// DELETE /api/projects/:id — delete project (admin)
router.delete('/:id', requireProjectAdmin, projectController.remove);

// POST /api/projects/:id/members — add member (admin)
router.post('/:id/members', requireProjectAdmin, validate(addMemberSchema), projectController.addMember);

// DELETE /api/projects/:id/members/:userId — remove member (admin)
router.delete('/:id/members/:userId', requireProjectAdmin, projectController.removeMember);

module.exports = router;
