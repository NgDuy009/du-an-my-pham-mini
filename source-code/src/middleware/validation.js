const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map(({ path, msg }) => ({ field: path, message: msg }));
  if (req.path.startsWith('/api/')) return res.status(400).json({ error: 'VALIDATION_ERROR', details: errors });
  req.session.formErrors = errors;
  req.session.formValues = req.body;
  req.session.flash = { type: 'error', message: 'Vui lòng kiểm tra lại thông tin đã nhập.' };
  return res.redirect('back');
}
module.exports = { validateRequest };
