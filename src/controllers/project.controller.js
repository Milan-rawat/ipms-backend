const projectService = require('../services/project.service');

/**
 * POST /api/projects
 * Create a new project. Authenticated user becomes owner.
 */
async function create(req, res, next) {
  try {
    const { name, description } = req.body;
    const project = await projectService.createProject(
      { name, description },
      req.user.id,
    );

    res.status(201).json({
      success: true,
      data: { project },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/projects
 * List projects where the authenticated user is a member.
 */
async function list(req, res, next) {
  try {
    const projects = await projectService.listProjects(req.user.id);

    res.status(200).json({
      success: true,
      data: { projects },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/projects/:id
 * Get a single project (membership verified by middleware).
 */
async function get(req, res, next) {
  try {
    const project = await projectService.getProject(req.project._id);

    res.status(200).json({
      success: true,
      data: { project },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/projects/:id
 * Update project details (admin only, verified by middleware).
 */
async function update(req, res, next) {
  try {
    const { name, description } = req.body;
    const project = await projectService.updateProject(
      req.project,
      { name, description },
    );

    res.status(200).json({
      success: true,
      data: { project },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/projects/:id
 * Delete project and associated tasks (admin only, verified by middleware).
 */
async function remove(req, res, next) {
  try {
    await projectService.deleteProject(req.project);

    res.status(200).json({
      success: true,
      data: { message: 'Project deleted' },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/projects/:id/members
 * Add a member by email (admin only, verified by middleware).
 */
async function addMember(req, res, next) {
  try {
    const { email } = req.body;
    const project = await projectService.addMember(req.project, email);

    res.status(200).json({
      success: true,
      data: { project },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/projects/:id/members/:userId
 * Remove a member (admin only, verified by middleware).
 */
async function removeMember(req, res, next) {
  try {
    const { userId } = req.params;
    const project = await projectService.removeMember(req.project, userId);

    res.status(200).json({
      success: true,
      data: { project },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { create, list, get, update, remove, addMember, removeMember };
