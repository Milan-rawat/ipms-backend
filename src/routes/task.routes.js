const { Router } = require('express');
const Joi = require('joi');
const validate = require('../middleware/validate.middleware');
const authenticate = require('../middleware/auth.middleware');
const { requireProjectMember } = require('../middleware/authorize.middleware');
const taskController = require('../controllers/task.controller');
const { TASK_STATUSES, TASK_PRIORITIES } = require('../utils/constants');

const router = Router({ mergeParams: true });

// --- Validation Schemas ---

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createTaskSchema = {
  body: Joi.object({
    title: Joi.string().trim().min(2).max(200).required()
      .messages({
        'string.min': 'Title must be at least 2 characters',
        'string.max': 'Title must be at most 200 characters',
        'any.required': 'Title is required',
      }),
    description: Joi.string().trim().max(1000).allow('').optional()
      .messages({
        'string.max': 'Description must be at most 1000 characters',
      }),
    status: Joi.string().valid(...TASK_STATUSES).optional()
      .messages({
        'any.only': `Status must be one of: ${TASK_STATUSES.join(', ')}`,
      }),
    priority: Joi.string().valid(...TASK_PRIORITIES).optional()
      .messages({
        'any.only': `Priority must be one of: ${TASK_PRIORITIES.join(', ')}`,
      }),
    assignee: Joi.string().pattern(objectIdPattern).allow(null, '').optional()
      .messages({
        'string.pattern.base': 'Invalid assignee ID',
      }),
  }),
};

const updateTaskSchema = {
  body: Joi.object({
    title: Joi.string().trim().min(2).max(200).optional()
      .messages({
        'string.min': 'Title must be at least 2 characters',
        'string.max': 'Title must be at most 200 characters',
      }),
    description: Joi.string().trim().max(1000).allow('').optional()
      .messages({
        'string.max': 'Description must be at most 1000 characters',
      }),
    status: Joi.string().valid(...TASK_STATUSES).optional()
      .messages({
        'any.only': `Status must be one of: ${TASK_STATUSES.join(', ')}`,
      }),
    priority: Joi.string().valid(...TASK_PRIORITIES).optional()
      .messages({
        'any.only': `Priority must be one of: ${TASK_PRIORITIES.join(', ')}`,
      }),
    assignee: Joi.string().pattern(objectIdPattern).allow(null, '').optional()
      .messages({
        'string.pattern.base': 'Invalid assignee ID',
      }),
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update',
  }),
};

// --- Routes ---
// All task routes require authentication + project membership
router.use(authenticate, requireProjectMember);

// POST /api/projects/:projectId/tasks
router.post('/', validate(createTaskSchema), taskController.create);

// GET /api/projects/:projectId/tasks
router.get('/', taskController.list);

// GET /api/projects/:projectId/tasks/:taskId
router.get('/:taskId', taskController.get);

// PUT /api/projects/:projectId/tasks/:taskId
router.put('/:taskId', validate(updateTaskSchema), taskController.update);

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete('/:taskId', taskController.remove);

module.exports = router;
