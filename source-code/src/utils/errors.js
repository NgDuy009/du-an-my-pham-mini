class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

function notFound(message = 'Không tìm thấy dữ liệu') {
  return new AppError(message, 404, 'NOT_FOUND');
}
function badRequest(message = 'Dữ liệu không hợp lệ') {
  return new AppError(message, 400, 'BAD_REQUEST');
}
function forbidden(message = 'Bạn không có quyền thực hiện thao tác này') {
  return new AppError(message, 403, 'FORBIDDEN');
}

module.exports = { AppError, notFound, badRequest, forbidden };
