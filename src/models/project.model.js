const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [100, 'Project name must be at most 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be at most 500 characters'],
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['admin', 'member'],
          default: 'member',
        },
        _id: false,
      },
    ],
  },
  {
    timestamps: true,
  },
);

/**
 * Index on members.user for efficient "list my projects" queries.
 * This is the primary query pattern: find all projects where user is a member.
 */
projectSchema.index({ 'members.user': 1 });

/**
 * Check if a user is a member of this project.
 * @param {string|ObjectId} userId
 * @returns {boolean}
 */
projectSchema.methods.isMember = function (userId) {
  return this.members.some(
    (m) => m.user.toString() === userId.toString(),
  );
};

/**
 * Check if a user is the admin/owner of this project.
 * @param {string|ObjectId} userId
 * @returns {boolean}
 */
projectSchema.methods.isAdmin = function (userId) {
  return this.owner.toString() === userId.toString();
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
