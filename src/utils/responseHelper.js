/**
 * src/utils/responseHelper.js
 * Format response JSON yang konsisten di seluruh API.
 */

exports.success = (message, data = null) => ({
  success: true,
  message,
  data,
});

exports.error = (message, data = null) => ({
  success: false,
  message,
  data,
});
