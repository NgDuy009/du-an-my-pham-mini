const express = require('express');
const db = require('../config/database');
const { client: minio } = require('../config/storage');
const asyncHandler = require('../utils/async-handler');
const { notFound } = require('../utils/errors');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.q || '').trim().slice(0, 80);
  const params = [];
  let where = 'WHERE p.is_active = TRUE';
  if (search) {
    params.push(`%${search}%`);
    where += ' AND (p.name ILIKE $1 OR p.sku ILIKE $1 OR c.name ILIKE $1 OR COALESCE(b.name, \'\') ILIKE $1)';
  }
  const result = await db.query(`
    SELECT p.id,p.sku,p.name,p.description,p.ingredient,p.volume_label,p.unit,p.sale_price,
      c.name AS category_name,b.name AS brand_name,
      COALESCE((SELECT SUM(pb.quantity_remaining) FROM product_batches pb WHERE pb.product_id=p.id AND (pb.expires_on IS NULL OR pb.expires_on >= CURRENT_DATE)),0)::int AS stock,
      (SELECT fm.id FROM file_metadata fm WHERE fm.entity_type='PRODUCT_IMAGE' AND fm.entity_id=p.id ORDER BY fm.created_at DESC LIMIT 1) AS image_file_id
    FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
    ${where} ORDER BY p.name LIMIT 200`, params);
  res.render('customer/shop', { title: 'Sản phẩm', products: result.rows, search });
}));

router.get('/images/:id(\\d+)', asyncHandler(async (req, res) => {
  const result = await db.query(`SELECT fm.* FROM file_metadata fm JOIN products p ON p.id=fm.entity_id
    WHERE fm.id=$1 AND fm.entity_type='PRODUCT_IMAGE' AND p.is_active=TRUE`, [req.params.id]);
  if (!result.rowCount) throw notFound('Không tìm thấy ảnh sản phẩm.');
  const file = result.rows[0];
  const stream = await minio.getObject(file.bucket_name, file.object_key);
  res.setHeader('Content-Type', file.content_type);
  res.setHeader('Content-Length', file.file_size);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'private, max-age=300');
  stream.on('error', (error) => { if (!res.headersSent) res.status(500).end(); else res.destroy(error); });
  stream.pipe(res);
}));

module.exports = router;
