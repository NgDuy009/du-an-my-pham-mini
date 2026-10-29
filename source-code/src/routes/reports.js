const express = require('express');
const db = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);
router.get('/', asyncHandler(async (req, res) => {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : new Date(Date.now() - 29 * 86400000).toISOString().slice(0,10);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : new Date().toISOString().slice(0,10);
  const [summary, daily, topProducts, expiring, lowStock] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS order_count,COALESCE(SUM(total_amount),0) AS revenue,COALESCE(SUM(total_amount-discount_amount),0) AS net_revenue FROM orders WHERE status='COMPLETED' AND created_at::date BETWEEN $1 AND $2`, [from,to]),
    db.query(`SELECT created_at::date AS day,COUNT(*)::int AS orders,COALESCE(SUM(total_amount),0) AS revenue FROM orders WHERE status='COMPLETED' AND created_at::date BETWEEN $1 AND $2 GROUP BY created_at::date ORDER BY day`, [from,to]),
    db.query(`SELECT oi.product_name,SUM(oi.quantity)::int AS quantity,SUM(oi.line_total) AS revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='COMPLETED' AND o.created_at::date BETWEEN $1 AND $2 GROUP BY oi.product_name ORDER BY quantity DESC LIMIT 10`, [from,to]),
    db.query(`SELECT p.sku,p.name,b.batch_code,b.expires_on,b.quantity_remaining FROM product_batches b JOIN products p ON p.id=b.product_id WHERE b.quantity_remaining>0 AND b.expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '90 days' ORDER BY b.expires_on LIMIT 20`),
    db.query(`SELECT p.id,p.sku,p.name,p.reorder_level,COALESCE(SUM(b.quantity_remaining),0)::int AS stock FROM products p LEFT JOIN product_batches b ON b.product_id=p.id WHERE p.is_active=true GROUP BY p.id HAVING COALESCE(SUM(b.quantity_remaining),0)<=p.reorder_level ORDER BY stock LIMIT 20`)
  ]);
  res.render('reports/index', { title: 'Báo cáo', from, to, summary: summary.rows[0], daily: daily.rows, topProducts: topProducts.rows, expiring: expiring.rows, lowStock: lowStock.rows });
}));
router.get('/sales.csv', asyncHandler(async (req, res) => {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : '2000-01-01';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : '2100-01-01';
  const rows = await db.query(`SELECT o.order_code,o.created_at,c.full_name AS customer,o.payment_method,o.status,o.subtotal,o.discount_amount,o.total_amount FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.created_at::date BETWEEN $1 AND $2 ORDER BY o.created_at DESC`, [from,to]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"','""')}"`;
  const csv = ['Mã đơn,Ngày tạo,Khách hàng,Thanh toán,Trạng thái,Tạm tính,Giảm giá,Tổng cộng', ...rows.rows.map((row) => [row.order_code,row.created_at?.toISOString(),row.customer,row.payment_method,row.status,row.subtotal,row.discount_amount,row.total_amount].map(escape).join(','))].join('\r\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="bao-cao-doanh-thu.csv"'); res.send('\uFEFF'+csv);
}));
module.exports = router;
