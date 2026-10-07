/**
 * Centralized API Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  console.error('[API Error]:', err.message || err);

  const statusCode = err.status || err.statusCode || 500;
  const response = {
    success: false,
    error: {
      message: err.message || 'An unexpected server error occurred.'
    }
  };

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
