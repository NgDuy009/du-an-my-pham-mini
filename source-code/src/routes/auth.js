const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { body } = require('express-validator');
const asyncHandler = require('../utils/async-handler');
const { authenticate } = require('../services/auth-service');
const { validateRequest } = require('../middleware/validation');
const { flash } = require('../middleware/auth');
const audit = require('../services/audit-service');
const router = express.Router();


router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect(req.session.user.role === 'CUSTOMER' ? '/shop' : '/');
  res.render('auth/register', { title: 'Tạo tài khoản khách hàng', errors: [] });
});
router.post('/register',
  body('full_name').trim().isLength({ min: 2, max: 140 }).withMessage('Họ tên phải từ 2 đến 140 ký tự'),
  body('email').isEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 10, max: 100 }).withMessage('Mật khẩu phải có ít nhất 10 ký tự'),
  body('password_confirmation').custom((value, { req }) => value === req.body.password).withMessage('Mật khẩu xác nhận không khớp'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }).withMessage('Số điện thoại quá dài'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const fullName = String(req.body.full_name).trim();
    const email = String(req.body.email).trim().toLowerCase();
    const phone = String(req.body.phone || '').trim() || null;
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const client = await db.pool.connect();
    let user;
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id FROM users WHERE lower(email)=lower($1)', [email]);
      if (existing.rowCount) {
        await client.query('ROLLBACK');
        flash(req, 'error', 'Email này đã có tài khoản. Vui lòng đăng nhập.');
        return res.redirect('/register');
      }
      const customerCode = `CUS-WEB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const customerResult = await client.query(
        'INSERT INTO customers(code,full_name,phone,email) VALUES($1,$2,$3,$4) RETURNING id',
        [customerCode, fullName, phone, email]
      );
      const userResult = await client.query(
        "INSERT INTO users(full_name,email,password_hash,role,customer_id) VALUES($1,$2,$3,'CUSTOMER',$4) RETURNING id,full_name,email,role,customer_id",
        [fullName, email, passwordHash, customerResult.rows[0].id]
      );
      await client.query('COMMIT');
      user = userResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        flash(req, 'error', 'Email hoặc mã khách hàng đã tồn tại. Vui lòng thử lại.');
        return res.redirect('/register');
      }
      throw error;
    } finally {
      client.release();
    }
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.user = { id: user.id, fullName: user.full_name, email: user.email, role: user.role, customerId: user.customer_id };
    await audit.record({ userId: user.id, action: 'CUSTOMER_REGISTER', entityType: 'customers', entityId: user.customer_id, ip: req.ip });
    res.redirect('/shop');
  })
);

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect(req.session.user.role === 'CUSTOMER' ? '/shop' : '/');
  res.render('auth/login', { title: 'Đăng nhập', errors: [] });
});
router.post('/login',
  body('email').isEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 1 }).withMessage('Vui lòng nhập mật khẩu'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const user = await authenticate(req.body.email, req.body.password);
    if (!user) {
      flash(req, 'error', 'Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.');
      return res.redirect('/login');
    }
    const returnTo = req.session.returnTo || '/';
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.user = user;
    await audit.record({ userId: user.id, action: 'LOGIN', ip: req.ip });
    res.redirect(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/');
  })
);
router.post('/logout', (req, res, next) => {
  const user = req.session.user;
  if (user) audit.record({ userId: user.id, action: 'LOGOUT', ip: req.ip });
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('cosmetic.sid');
    res.redirect('/login');
  });
});
module.exports = router;
