// Errors: Module level logic for the feature area.
/**
 * Simple Error Handler with Common Error Codes
 */

// Error Handler: Runs Error handler flow. Inputs: message, statusCode, code. Returns: a function result.
const errorHandler = (message, statusCode = 400, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
};

// Common error codes with default messages
const errors = {
  badRequest: (message = "Bad Request") => errorHandler(message, 400),
  unauthorized: (message = "Unauthorized") => errorHandler(message, 401),
  forbidden: (message = "Forbidden") => errorHandler(message, 403),
  notFound: (message = "Not Found") => errorHandler(message, 404),
  conflict: (message = "Conflict") => errorHandler(message, 409),
  validation: (message = "Validation Error") => errorHandler(message, 422),
  serverError: (message = "Internal Server Error") =>
    errorHandler(message, 500),
  emailDeliveryFailed: (
    message = "Ticket email delivery failed. Registration reverted."
  ) => errorHandler(message, 502, "EMAIL_DELIVERY_FAILED"),
};

export default errorHandler;
export { errors };
