const { forbidden } = require('../utils/errors');

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập.' });
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

function requireCustomer(req, res, next) {
  if (req.session?.user?.role === 'CUSTOMER' && req.session.user.customerId) return next();
  if (!req.session?.user) return res.redirect('/login');
  if (req.session.user.role === 'CUSTOMER') return res.status(403).send('Tài khoản khách hàng chưa được liên kết với hồ sơ khách hàng. Vui lòng liên hệ cửa hàng.');
  return res.redirect('/');
}

function requireStaff(req, res, next) {
  if (req.session?.user && req.session.user.role !== 'CUSTOMER') return next();
  if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'FORBIDDEN', message: 'Tài khoản khách hàng không có quyền truy cập chức năng quản trị.' });
  return res.redirect('/shop');
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role === 'ADMIN') return next();
  if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'FORBIDDEN', message: 'Chỉ Administrator được thực hiện thao tác này.' });
  return next(forbidden());
}

function attachUser(req, res, next) {
  res.locals.currentUser = req.session?.user || null;
  res.locals.currentPath = req.path;
  res.locals.flash = req.session?.flash || null;
  delete req.session?.flash;
  next();
}

function flash(req, type, message) {
  req.session.flash = { type, message };
}
module.exports = { requireAuth, requireAdmin, requireCustomer, requireStaff, attachUser, flash };
