const mongoose = require('mongoose');
const { TASK_STATUSES, TASK_PRIORITIES, TASK_STATUS, TASK_PRIORITY } = require('../utils/constants');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title must be at most 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description must be at most 1000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: TASK_STATUSES,
        message: 'Status must be one of: ' + TASK_STATUSES.join(', '),
      },
      default: TASK_STATUS.TODO,
    },
    priority: {
      type: String,
      enum: {
        values: TASK_PRIORITIES,
        message: 'Priority must be one of: ' + TASK_PRIORITIES.join(', '),
      },
      default: TASK_PRIORITY.MEDIUM,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Compound index for the primary query pattern:
 * "Get all tasks for a project" — used by the task board.
 */
taskSchema.index({ project: 1, status: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
