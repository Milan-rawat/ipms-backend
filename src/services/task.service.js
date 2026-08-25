const Task = require('../models/task.model');
const Project = require('../models/project.model');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');

/**
 * Create a new task within a project.
 * @param {Object} data - { title, description, status, priority, assignee }
 * @param {string} projectId - Project ID (from route/middleware)
 * @param {string} userId - Authenticated user ID (createdBy)
 * @returns {Object} Populated task
 */
async function createTask(data, projectId, userId) {
  const { title, description, status, priority, assignee } = data;

  // Validate assignee is a project member if provided
  if (assignee) {
    await validateAssignee(assignee, projectId);
  }

  const task = await Task.create({
    title,
    description: description || '',
    status,
    priority,
    project: projectId,
    assignee: assignee || null,
    createdBy: userId,
  });

  return Task.findById(task._id)
    .populate('assignee', 'name email')
    .populate('createdBy', 'name email');
}

/**
 * List all tasks for a project.
 * @param {string} projectId
 * @returns {Array} Tasks sorted by creation date (newest first)
 */
async function listTasks(projectId) {
  return Task.find({ project: projectId })
    .populate('assignee', 'name email')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
}

/**
 * Get a single task by ID, verifying it belongs to the specified project.
 * @param {string} taskId
 * @param {string} projectId
 * @returns {Object} Populated task
 */
async function getTask(taskId, projectId) {
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw ApiError.badRequest('Invalid task ID');
  }

  const task = await Task.findById(taskId)
    .populate('assignee', 'name email')
    .populate('createdBy', 'name email');

  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  // Verify task belongs to the specified project
  if (task.project.toString() !== projectId.toString()) {
    throw ApiError.notFound('Task not found in this project');
  }

  return task;
}

/**
 * Update a task.
 * @param {string} taskId
 * @param {string} projectId
 * @param {Object} data - Fields to update
 * @returns {Object} Updated populated task
 */
async function updateTask(taskId, projectId, data) {
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw ApiError.badRequest('Invalid task ID');
  }

  const task = await Task.findById(taskId);

  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  // Verify task belongs to the specified project
  if (task.project.toString() !== projectId.toString()) {
    throw ApiError.notFound('Task not found in this project');
  }

  // Validate assignee if being changed
  if (data.assignee !== undefined) {
    if (data.assignee === null || data.assignee === '') {
      task.assignee = null;
    } else {
      await validateAssignee(data.assignee, projectId);
      task.assignee = data.assignee;
    }
  }

  // Update allowed fields
  if (data.title !== undefined) task.title = data.title;
  if (data.description !== undefined) task.description = data.description;
  if (data.status !== undefined) task.status = data.status;
  if (data.priority !== undefined) task.priority = data.priority;

  await task.save();

  return Task.findById(task._id)
    .populate('assignee', 'name email')
    .populate('createdBy', 'name email');
}

/**
 * Delete a task.
 * @param {string} taskId
 * @param {string} projectId
 * @param {string} userId - Authenticated user ID
 * @param {boolean} isAdmin - Whether the user is the project admin
 */
async function deleteTask(taskId, projectId, userId, isAdmin) {
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw ApiError.badRequest('Invalid task ID');
  }

  const task = await Task.findById(taskId);

  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  // Verify task belongs to the specified project
  if (task.project.toString() !== projectId.toString()) {
    throw ApiError.notFound('Task not found in this project');
  }

  // Authorization: admin can delete any task, member can delete own tasks only
  if (!isAdmin && task.createdBy.toString() !== userId.toString()) {
    throw ApiError.forbidden('Only the task creator or project admin can delete this task');
  }

  await Task.findByIdAndDelete(taskId);
}

/**
 * Delete all tasks belonging to a project (cascade on project deletion).
 * @param {string} projectId
 * @returns {Object} Deletion result with count
 */
async function deleteTasksByProject(projectId) {
  const result = await Task.deleteMany({ project: projectId });
  return result;
}

/**
 * Validate that an assignee exists and is a member of the project.
 * @param {string} assigneeId
 * @param {string} projectId
 */
async function validateAssignee(assigneeId, projectId) {
  if (!mongoose.Types.ObjectId.isValid(assigneeId)) {
    throw ApiError.badRequest('Invalid assignee ID');
  }

  const user = await User.findById(assigneeId);
  if (!user) {
    throw ApiError.notFound('Assignee user not found');
  }

  const project = await Project.findById(projectId);
  if (!project || !project.isMember(assigneeId)) {
    throw ApiError.badRequest('Assignee must be a member of this project');
  }
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  deleteTasksByProject,
};
