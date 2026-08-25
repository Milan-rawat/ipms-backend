const Project = require('../models/project.model');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const socketService = require('./socket.service');

/**
 * Create a new project. The authenticated user becomes owner and admin member.
 * @param {Object} data - { name, description }
 * @param {string} userId - Authenticated user's ID
 * @returns {Object} Populated project
 */
async function createProject({ name, description }, userId) {
  const project = await Project.create({
    name,
    description: description || '',
    owner: userId,
    members: [{ user: userId, role: 'admin' }],
  });

  // Return populated project
  return Project.findById(project._id)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');
}

/**
 * List all projects where the user is a member.
 * @param {string} userId
 * @returns {Array} Projects
 */
async function listProjects(userId) {
  return Project.find({ 'members.user': userId })
    .populate('owner', 'name email')
    .populate('members.user', 'name email')
    .sort({ updatedAt: -1 });
}

/**
 * Get a single project by ID (already authorized via middleware).
 * @param {string} projectId
 * @returns {Object} Populated project
 */
async function getProject(projectId) {
  return Project.findById(projectId)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');
}

/**
 * Update project details. Only name and description can be changed.
 * @param {Object} project - Mongoose project document (from middleware)
 * @param {Object} data - { name, description }
 * @returns {Object} Updated populated project
 */
async function updateProject(project, { name, description }) {
  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;

  await project.save();

  return Project.findById(project._id)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');
}

/**
 * Delete a project and its associated tasks.
 * Sequential deletion: tasks first, then project.
 * @param {Object} project - Mongoose project document (from middleware)
 */
async function deleteProject(project) {
  const Task = require('../models/task.model');

  // Delete all tasks belonging to this project
  await Task.deleteMany({ project: project._id });

  // Delete the project
  await Project.findByIdAndDelete(project._id);
}

/**
 * Add a member to the project by email.
 * @param {Object} project - Mongoose project document (from middleware)
 * @param {string} email - Email of the user to add
 * @returns {Object} Updated populated project
 */
async function addMember(project, email) {
  // Find user by email
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw ApiError.notFound('User not found with that email');
  }

  // Check if already a member
  if (project.isMember(user._id)) {
    throw ApiError.conflict('User is already a member of this project');
  }

  // Add as member (never as admin — only creator is admin)
  project.members.push({ user: user._id, role: 'member' });
  await project.save();

  // Emit after successful persistence
  socketService.emitMemberAdded(project._id.toString(), {
    _id: user._id,
    name: user.name,
    email: user.email,
  });

  return Project.findById(project._id)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');
}

/**
 * Remove a member from the project.
 * @param {Object} project - Mongoose project document (from middleware)
 * @param {string} userId - ID of the user to remove
 */
async function removeMember(project, userId) {
  // Cannot remove the owner
  if (project.isAdmin(userId)) {
    throw ApiError.badRequest('Cannot remove the project owner');
  }

  // Check if user is actually a member
  if (!project.isMember(userId)) {
    throw ApiError.notFound('User is not a member of this project');
  }

  // Remove member
  project.members = project.members.filter(
    (m) => m.user.toString() !== userId.toString(),
  );
  await project.save();

  // Emit after successful persistence + remove user's sockets from room
  await socketService.emitMemberRemoved(project._id.toString(), userId);

  return Project.findById(project._id)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');
}

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
};
