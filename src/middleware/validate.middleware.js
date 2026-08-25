const ApiError = require('../utils/ApiError');

/**
 * Creates a validation middleware using a Joi schema.
 * Validates req.body, req.params, and/or req.query based on schema keys.
 *
 * Usage:
 *   const schema = { body: Joi.object({...}), params: Joi.object({...}) };
 *   router.post('/endpoint', validate(schema), controller);
 *
 * @param {Object} schema - Object with optional keys: body, params, query
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const key of ['params', 'query', 'body']) {
      if (!schema[key]) continue;

      const { error, value } = schema[key].validate(req[key], {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const messages = error.details.map((detail) => detail.message);
        errors.push(...messages);
      } else {
        // Replace req property with validated/sanitized value
        req[key] = value;
      }
    }

    if (errors.length > 0) {
      return next(ApiError.badRequest('Validation failed', errors));
    }

    next();
  };
}

module.exports = validate;
