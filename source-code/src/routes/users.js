const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const db = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const { requireAuth, requireAdmin, flash } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { notFound } = require('../utils/errors');
const audit = require('../services/audit-service');
const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.query('SELECT id,full_name,email,role,is_active,last_login_at,created_at FROM users ORDER BY created_at DESC');
  res.render('users/list', { title: 'Tài khoản nhân viên', users: rows.rows });
}));
router.get('/new', (req, res) => res.render('users/form', { title: 'Tạo tài khoản', user: {}, editing: false }));
router.post('/',
  body('full_name').trim().isLength({ min: 2, max: 120 }).withMessage('Họ tên từ 2 đến 120 ký tự'),
  body('email').isEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 10 }).withMessage('Mật khẩu tối thiểu 10 ký tự'),
  body('role').isIn(['ADMIN','STAFF']).withMessage('Vai trò không hợp lệ'), validateRequest,
  asyncHandler(async (req, res) => {
    const hash = await bcrypt.hash(req.body.password, 12);
    const result = await db.query('INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id', [req.body.full_name.trim(), req.body.email.toLowerCase().trim(), hash, req.body.role]);
    await audit.record({ userId: req.session.user.id, action: 'CREATE_USER', entityType: 'users', entityId: result.rows[0].id, ip: req.ip });
    flash(req, 'success', 'Đã tạo tài khoản.'); res.redirect('/users');
  })
);
router.post('/:id(\\d+)/toggle', asyncHandler(async (req, res) => {
  if (Number(req.params.id) === Number(req.session.user.id)) {
    const error = new Error('Không thể khóa tài khoản đang đăng nhập.'); error.status = 400; throw error;
  }
  const result = await db.query('UPDATE users SET is_active=NOT is_active,updated_at=NOW() WHERE id=$1 RETURNING id,is_active', [req.params.id]);
  if (!result.rowCount) throw notFound('Không tìm thấy tài khoản.');
  await audit.record({ userId: req.session.user.id, action: 'TOGGLE_USER', entityType: 'users', entityId: req.params.id, details: { active: result.rows[0].is_active }, ip: req.ip });
  flash(req, 'success', result.rows[0].is_active ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.'); res.redirect('/users');
}));
module.exports = router;
