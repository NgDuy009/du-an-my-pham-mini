const express = require('express');
const { body, query: queryValidator } = require('express-validator');
const db = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { notFound, badRequest } = require('../utils/errors');
const { definitions } = require('./resources');
const audit = require('../services/audit-service');

const router = express.Router();
router.use(requireAuth);

const apiResources = {
  products: { table: 'products', select: `SELECT p.*, c.name AS category_name, b.name AS brand_name FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id`, search: ['p.sku','p.name'], admin: false },
  categories: { table: 'categories', select: 'SELECT * FROM categories', search: ['code','name'], admin: true },
  brands: { table: 'brands', select: 'SELECT * FROM brands', search: ['code','name','country'], admin: true },
  suppliers: { table: 'suppliers', select: 'SELECT * FROM suppliers', search: ['code','name','phone'], admin: true },
  customers: { table: 'customers', select: 'SELECT * FROM customers', search: ['code','full_name','phone','email'], admin: false }
};

for (const [resource, config] of Object.entries(apiResources)) {
  const adminOnly = config.admin ? requireAdmin : (req, res, next) => next();
  router.get(`/${resource}`, asyncHandler(async (req, res) => {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const values = [];
    let where = '';
    if (search) {
      where = ` WHERE (${config.search.map((column, index) => { values.push(`%${search}%`); return `${column} ILIKE $${index + 1}`; }).join(' OR ')})`;
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const count = await db.query(`SELECT COUNT(*)::int AS total FROM (${config.select}${where}) AS rows`, values);
    const result = await db.query(`${config.select}${where} ORDER BY 1 LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, (page - 1) * limit]);
    res.json({ data: result.rows, pagination: { page, limit, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / limit) } });
  }));

  router.get(`/${resource}/:id(\\d+)`, asyncHandler(async (req, res) => {
    const result = await db.query(`${config.select} WHERE ${config.table === 'products' ? 'p.id' : 'id'}=$1`, [req.params.id]);
    if (!result.rowCount) throw notFound();
    res.json({ data: result.rows[0] });
  }));

  router.post(`/${resource}`, adminOnly,
    body().custom((_, { req }) => {
      const def = definitions[resource];
      for (const field of def.fields.filter((item) => item.required)) {
        if (req.body[field.name] === undefined || String(req.body[field.name]).trim() === '') throw new Error(`${field.label} không được để trống`);
      }
      return true;
    }), validateRequest, asyncHandler(async (req, res) => {
      const fields = definitions[resource].fields;
      const names = fields.map((field) => field.name);
      const values = fields.map((field) => req.body[field.name] === '' ? null : req.body[field.name]);
      const placeholders = names.map((_, index) => `$${index + 1}`);
      const result = await db.query(`INSERT INTO ${config.table}(${names.join(',')}) VALUES(${placeholders.join(',')}) RETURNING *`, values);
      await audit.record({ userId: req.session.user.id, action: 'API_CREATE', entityType: resource, entityId: result.rows[0].id, ip: req.ip });
      res.status(201).json({ data: result.rows[0] });
    })
  );

  router.put(`/${resource}/:id(\\d+)`, adminOnly, asyncHandler(async (req, res) => {
    const fields = definitions[resource].fields;
    const names = fields.filter((field) => Object.hasOwn(req.body, field.name)).map((field) => field.name);
    if (!names.length) throw badRequest('Cần truyền ít nhất một trường cần cập nhật.');
    const values = names.map((name) => req.body[name] === '' ? null : req.body[name]);
    const sets = names.map((name, index) => `${name}=$${index + 1}`);
    values.push(req.params.id);
    const result = await db.query(`UPDATE ${config.table} SET ${sets.join(',')},updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values);
    if (!result.rowCount) throw notFound();
    await audit.record({ userId: req.session.user.id, action: 'API_UPDATE', entityType: resource, entityId: req.params.id, ip: req.ip });
    res.json({ data: result.rows[0] });
  }));

  router.delete(`/${resource}/:id(\\d+)`, requireAdmin, asyncHandler(async (req, res) => {
    const result = await db.query(`DELETE FROM ${config.table} WHERE id=$1 RETURNING id`, [req.params.id]);
    if (!result.rowCount) throw notFound();
    await audit.record({ userId: req.session.user.id, action: 'API_DELETE', entityType: resource, entityId: req.params.id, ip: req.ip });
    res.status(204).end();
  }));
}

router.get('/orders', asyncHandler(async (req, res) => {
  const search = String(req.query.q || '').trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const values = search ? [`%${search}%`] : [];
  const where = search ? 'WHERE o.order_code ILIKE $1 OR c.full_name ILIKE $1' : '';
  const count = await db.query(`SELECT COUNT(*)::int AS total FROM orders o LEFT JOIN customers c ON c.id=o.customer_id ${where}`, values);
  const rows = await db.query(`SELECT o.*,c.full_name AS customer_name,u.full_name AS cashier_name FROM orders o LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN users u ON u.id=o.created_by ${where} ORDER BY o.created_at DESC LIMIT $${values.length+1} OFFSET $${values.length+2}`, [...values,limit,(page-1)*limit]);
  res.json({ data: rows.rows, pagination: { page, limit, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / limit) } });
}));

router.get('/stock-movements', asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const rows = await db.query(`SELECT sm.*,p.sku,p.name AS product_name,b.batch_code,u.full_name AS actor_name FROM stock_movements sm JOIN products p ON p.id=sm.product_id LEFT JOIN product_batches b ON b.id=sm.batch_id LEFT JOIN users u ON u.id=sm.created_by ORDER BY sm.created_at DESC LIMIT $1`, [limit]);
  res.json({ data: rows.rows });
}));

router.get('/files/:id(\\d+)', asyncHandler(async (req, res) => {
  const result = await db.query('SELECT id,original_name,object_key,content_type,file_size,bucket_name,entity_type,entity_id,uploaded_by,created_at FROM file_metadata WHERE id=$1', [req.params.id]);
  if (!result.rowCount) throw notFound('Không tìm thấy metadata tệp.');
  res.json({ data: result.rows[0], viewUrl: `/files/${result.rows[0].id}/view`, downloadUrl: `/files/${result.rows[0].id}/download` });
}));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [products, customers, orders, revenue, lowStock] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS count FROM products WHERE is_active=true'),
    db.query('SELECT COUNT(*)::int AS count FROM customers'),
    db.query("SELECT COUNT(*)::int AS count FROM orders WHERE status='COMPLETED' AND created_at::date=CURRENT_DATE"),
    db.query("SELECT COALESCE(SUM(total_amount),0) AS total FROM orders WHERE status='COMPLETED' AND created_at::date=CURRENT_DATE"),
    db.query(`SELECT p.id,p.sku,p.name,p.reorder_level,COALESCE(SUM(b.quantity_remaining),0)::int AS stock FROM products p LEFT JOIN product_batches b ON b.product_id=p.id WHERE p.is_active=true GROUP BY p.id HAVING COALESCE(SUM(b.quantity_remaining),0)<=p.reorder_level ORDER BY stock LIMIT 10`)
  ]);
  res.json({ data: { products: products.rows[0].count, customers: customers.rows[0].count, ordersToday: orders.rows[0].count, revenueToday: Number(revenue.rows[0].total), lowStock: lowStock.rows } });
}));

module.exports = router;
