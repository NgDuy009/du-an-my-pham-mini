function notFoundHandler(req, res, next) {
  const error = new Error(`Không tìm thấy đường dẫn ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const isUploadError = error.name === 'MulterError';
  const status = Number(error.status || error.statusCode || (isUploadError ? 400 : 500));
  if (status >= 500) console.error('[http-error]', error.stack || error.message);
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(status).json({
      error: error.code || (status === 404 ? 'NOT_FOUND' : 'REQUEST_FAILED'),
      message: isUploadError && error.code === 'LIMIT_FILE_SIZE' ? 'Tệp vượt quá giới hạn dung lượng cho phép.' : (status >= 500 ? 'Đã xảy ra lỗi hệ thống.' : error.message),
      ...(process.env.NODE_ENV !== 'production' && status >= 500 ? { debug: error.message } : {})
    });
  }
  res.status(status).render('error', {
    title: status === 404 ? 'Không tìm thấy trang' : 'Có lỗi xảy ra',
    status,
    message: isUploadError && error.code === 'LIMIT_FILE_SIZE' ? 'Tệp vượt quá giới hạn dung lượng cho phép.' : (status >= 500 && process.env.NODE_ENV === 'production' ? 'Vui lòng thử lại sau.' : error.message)
  });
}
module.exports = { notFoundHandler, errorHandler };
