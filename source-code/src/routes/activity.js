const express = require('express');
const db = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.get('/audit', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const search = String(req.query.q || '').trim().slice(0, 80);
  const values = search ? [`%${search}%`] : [];
  const where = search ? 'WHERE a.action ILIKE $1 OR a.entity_type ILIKE $1 OR u.full_name ILIKE $1' : '';
  const result = await db.query(`SELECT a.*,u.full_name AS actor_name,u.email AS actor_email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ${where} ORDER BY a.created_at DESC LIMIT 300`, values);
  res.render('activity/audit', { title: 'Nhật ký hoạt động', rows: result.rows, search });
}));

router.get('/stock-movements', requireAuth, asyncHandler(async (req, res) => {
  const search = String(req.query.q || '').trim().slice(0, 80);
  const values = search ? [`%${search}%`] : [];
  const where = search ? 'WHERE p.name ILIKE $1 OR p.sku ILIKE $1 OR sm.movement_type ILIKE $1' : '';
  const result = await db.query(`SELECT sm.*,p.sku,p.name AS product_name,b.batch_code,u.full_name AS actor_name FROM stock_movements sm JOIN products p ON p.id=sm.product_id LEFT JOIN product_batches b ON b.id=sm.batch_id LEFT JOIN users u ON u.id=sm.created_by ${where} ORDER BY sm.created_at DESC LIMIT 300`, values);
  res.render('activity/stock-movements', { title: 'Lịch sử biến động kho', rows: result.rows, search });
}));
module.exports = router;
