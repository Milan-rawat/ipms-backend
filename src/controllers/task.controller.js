const taskService = require('../services/task.service');

/**
 * POST /api/projects/:projectId/tasks
 * Create a task within a project.
 */
async function create(req, res, next) {
  try {
    const { title, description, status, priority, assignee } = req.body;
    const task = await taskService.createTask(
      { title, description, status, priority, assignee },
      req.project._id,
      req.user.id,
    );

    res.status(201).json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/projects/:projectId/tasks
 * List all tasks for a project.
 */
async function list(req, res, next) {
  try {
    const tasks = await taskService.listTasks(req.project._id);

    res.status(200).json({
      success: true,
      data: { tasks },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/projects/:projectId/tasks/:taskId
 * Get a single task.
 */
async function get(req, res, next) {
  try {
    const task = await taskService.getTask(req.params.taskId, req.project._id);

    res.status(200).json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/projects/:projectId/tasks/:taskId
 * Update a task.
 */
async function update(req, res, next) {
  try {
    const { title, description, status, priority, assignee } = req.body;
    const task = await taskService.updateTask(
      req.params.taskId,
      req.project._id,
      { title, description, status, priority, assignee },
    );

    res.status(200).json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/projects/:projectId/tasks/:taskId
 * Delete a task.
 */
async function remove(req, res, next) {
  try {
    const isAdmin = req.project.isAdmin(req.user.id);
    await taskService.deleteTask(
      req.params.taskId,
      req.project._id,
      req.user.id,
      isAdmin,
    );

    res.status(200).json({
      success: true,
      data: { message: 'Task deleted' },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { create, list, get, update, remove };
