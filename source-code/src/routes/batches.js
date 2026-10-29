const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const { requireAuth, requireAdmin, flash } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { transaction } = require('../config/database');
const { notFound, badRequest } = require('../utils/errors');
const audit = require('../services/audit-service');
const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const values = q ? [`%${q}%`] : [];
  const where = q ? 'WHERE p.name ILIKE $1 OR p.sku ILIKE $1 OR b.batch_code ILIKE $1' : '';
  const rows = await db.query(`SELECT b.*,p.sku,p.name AS product_name,s.name AS supplier_name FROM product_batches b JOIN products p ON p.id=b.product_id LEFT JOIN suppliers s ON s.id=b.supplier_id ${where} ORDER BY b.expires_on NULLS LAST,b.received_on DESC LIMIT 300`, values);
  res.render('batches/list', { title: 'Lô hàng & hạn sử dụng', batches: rows.rows, search: q });
}));
router.get('/new', requireAdmin, asyncHandler(async (req, res) => {
  const [products, suppliers] = await Promise.all([db.query('SELECT id,sku,name FROM products WHERE is_active=true ORDER BY name'), db.query('SELECT id,name FROM suppliers WHERE is_active=true ORDER BY name')]);
  res.render('batches/form', { title: 'Nhập lô hàng', products: products.rows, suppliers: suppliers.rows });
}));
router.post('/', requireAdmin,
  body('product_id').isInt({ min: 1 }).withMessage('Chọn sản phẩm hợp lệ'),
  body('batch_code').trim().notEmpty().withMessage('Mã lô không được để trống'),
  body('quantity_received').isInt({ min: 1, max: 1000000 }).withMessage('Số lượng phải lớn hơn 0'),
  body('unit_cost').isFloat({ min: 0 }).withMessage('Giá nhập không hợp lệ'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const created = await transaction(async (client) => {
      const result = await client.query(`INSERT INTO product_batches(product_id,supplier_id,batch_code,manufactured_on,expires_on,received_on,quantity_received,quantity_remaining,unit_cost,note) VALUES($1,$2,$3,NULLIF($4,'')::date,NULLIF($5,'')::date,COALESCE(NULLIF($6,'')::date,CURRENT_DATE),$7,$7,$8,$9) RETURNING *`, [req.body.product_id, req.body.supplier_id || null, req.body.batch_code.trim(), req.body.manufactured_on || '', req.body.expires_on || '', req.body.received_on || '', req.body.quantity_received, req.body.unit_cost, req.body.note || null]);
      await client.query(`INSERT INTO stock_movements(product_id,batch_id,movement_type,quantity_change,reference_type,reference_id,created_by,note) VALUES($1,$2,'RECEIPT',$3,'BATCH',$2,$4,$5)`, [created.rows[0].product_id, created.rows[0].id, Number(req.body.quantity_received), req.session.user.id, req.body.note || null]);
      return created.rows[0];
    });
    await audit.record({ userId: req.session.user.id, action: 'RECEIVE_BATCH', entityType: 'product_batches', entityId: created.id, ip: req.ip });
    flash(req, 'success', `Đã nhập lô ${created.batch_code}.`);
    res.redirect('/batches');
  })
);
router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  const result = await db.query(`SELECT b.*,p.name AS product_name,p.sku,s.name AS supplier_name FROM product_batches b JOIN products p ON p.id=b.product_id LEFT JOIN suppliers s ON s.id=b.supplier_id WHERE b.id=$1`, [req.params.id]);
  if (!result.rowCount) throw notFound('Không tìm thấy lô hàng.');
  res.render('batches/detail', { title: `Lô ${result.rows[0].batch_code}`, batch: result.rows[0] });
}));
router.post('/:id(\\d+)/adjust', requireAdmin,
  body('quantity_change').isInt().custom((value) => Number(value) !== 0).withMessage('Điều chỉnh phải khác 0'),
  body('note').trim().notEmpty().withMessage('Cần ghi lý do điều chỉnh'), validateRequest,
  asyncHandler(async (req, res) => {
    await transaction(async (client) => {
      const result = await client.query('SELECT * FROM product_batches WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!result.rowCount) throw notFound('Không tìm thấy lô hàng.');
      const batch = result.rows[0]; const delta = Number(req.body.quantity_change);
      if (batch.quantity_remaining + delta < 0) throw badRequest('Không thể điều chỉnh tồn kho xuống dưới 0.');
      await client.query('UPDATE product_batches SET quantity_remaining=quantity_remaining+$1 WHERE id=$2', [delta, batch.id]);
      await client.query(`INSERT INTO stock_movements(product_id,batch_id,movement_type,quantity_change,reference_type,reference_id,created_by,note) VALUES($1,$2,'ADJUSTMENT',$3,'BATCH',$2,$4,$5)`, [batch.product_id, batch.id, delta, req.session.user.id, req.body.note]);
    });
    flash(req, 'success', 'Đã điều chỉnh tồn kho.'); res.redirect('/batches');
  })
);
module.exports = router;
