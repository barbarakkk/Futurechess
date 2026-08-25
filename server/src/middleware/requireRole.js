const { createHttpError } = require("../utils/createHttpError");

/** Gate a route to a single role. Must run after `requireAuth` (needs `req.user.role`). */
function requireRole(role) {
  return function requireRoleMiddleware(req, _res, next) {
    if (req.user?.role !== role) {
      return next(createHttpError(403, `This action requires the "${role}" role`));
    }

    next();
  };
}

module.exports = { requireRole };
