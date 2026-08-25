const ApiError = require('../utils/ApiError');
const Project = require('../models/project.model');
const mongoose = require('mongoose');

/**
 * Middleware: Require the authenticated user to be a member of the project.
 * Extracts projectId from req.params.id or req.params.projectId.
 * Attaches the project to req.project for downstream use.
 */
function requireProjectMember(req, res, next) {
  return projectAuth('member')(req, res, next);
}

/**
 * Middleware: Require the authenticated user to be the admin/owner of the project.
 * Extracts projectId from req.params.id or req.params.projectId.
 * Attaches the project to req.project for downstream use.
 */
function requireProjectAdmin(req, res, next) {
  return projectAuth('admin')(req, res, next);
}

/**
 * Factory for project authorization middleware.
 * @param {'member'|'admin'} requiredRole
 */
function projectAuth(requiredRole) {
  return async (req, res, next) => {
    try {
      const projectId = req.params.id || req.params.projectId;

      // Validate ObjectId format
      if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        return next(ApiError.badRequest('Invalid project ID'));
      }

      const project = await Project.findById(projectId);

      if (!project) {
        return next(ApiError.notFound('Project not found'));
      }

      // Check membership
      if (!project.isMember(req.user.id)) {
        return next(ApiError.forbidden('Not a member of this project'));
      }

      // Check admin if required
      if (requiredRole === 'admin' && !project.isAdmin(req.user.id)) {
        return next(ApiError.forbidden('Admin access required'));
      }

      // Attach project to request for downstream use
      req.project = project;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { requireProjectMember, requireProjectAdmin };
