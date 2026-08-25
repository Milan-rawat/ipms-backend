const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

const TASK_STATUSES = Object.values(TASK_STATUS);
const TASK_PRIORITIES = Object.values(TASK_PRIORITY);

module.exports = {
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_STATUSES,
  TASK_PRIORITIES,
};
