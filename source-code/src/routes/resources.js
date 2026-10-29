const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { body, param } = require('express-validator');
const db = require('../config/database');
const asyncHandler = require('../utils/async-handler');
const { validateRequest } = require('../middleware/validation');
const { requireAuth, requireAdmin, flash } = require('../middleware/auth');
const { notFound, badRequest } = require('../utils/errors');
const audit = require('../services/audit-service');
const { client: minio, bucket } = require('../config/storage');

const imageMaxBytes = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 5)) * 1024 * 1024;
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: imageMaxBytes, files: 1 } });
const productImageUpload = (req, res, next) => resourceUpload(req, res, next);
function resourceUpload(req, res, next) {
  if (req.baseUrl !== '/products') return next();
  imageUpload.single('product_image')(req, res, (error) => {
    if (error) return next(error);
    const file = req.file;
    if (file) {
      const ext = path.extname(file.originalname).toLowerCase();
      const valid = new Set(['.jpg', '.jpeg', '.png', '.webp']);
      const mime = new Set(['image/jpeg', 'image/png', 'image/webp']);
      if (!valid.has(ext) || !mime.has(file.mimetype)) return next(badRequest('Ảnh sản phẩm chỉ hỗ trợ JPG, PNG hoặc WEBP.'));
      if (!file.size || file.size > imageMaxBytes) return next(badRequest(`Ảnh tối đa ${Math.round(imageMaxBytes / 1024 / 1024)} MB.`));
    }
    next();
  });
}
async function saveProductImage(file, user, productId) {
  if (!file) return null;
  const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'product-image';
  const objectKey = `products/${productId}/${crypto.randomUUID()}-${safeName}`;
  await minio.putObject(bucket, objectKey, file.buffer, file.size, { 'Content-Type': file.mimetype });
  try {
    const result = await db.query(
      `INSERT INTO file_metadata(original_name, object_key, content_type, file_size, bucket_name, entity_type, entity_id, uploaded_by)
       VALUES($1,$2,$3,$4,$5,'PRODUCT_IMAGE',$6,$7) RETURNING id`,
      [file.originalname, objectKey, file.mimetype, file.size, bucket, productId, user.id]
    );
    return result.rows[0].id;
  } catch (error) {
    await minio.removeObject(bucket, objectKey).catch(() => {});
    throw error;
  }
}

// Identifiers are constants in this file; only values supplied by users are parameterized.
const definitions = {
  products: {
    title: 'Sản phẩm', singular: 'sản phẩm', table: 'products', key: 'id', adminWrite: false,
    search: ['p.sku', 'p.name', 'b.name'], order: 'p.created_at DESC',
    listSql: `SELECT p.*, c.name AS category_name, b.name AS brand_name, s.name AS supplier_name,
      COALESCE((SELECT SUM(pb.quantity_remaining) FROM product_batches pb WHERE pb.product_id=p.id),0)::int AS stock,
      (SELECT fm.id FROM file_metadata fm WHERE fm.entity_type='PRODUCT_IMAGE' AND fm.entity_id=p.id ORDER BY fm.created_at DESC LIMIT 1) AS image_file_id
      FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
      LEFT JOIN suppliers s ON s.id=p.supplier_id`,
    fields: [
      { name: 'sku', label: 'Mã SKU', required: true, max: 40 }, { name: 'name', label: 'Tên sản phẩm', required: true, max: 180 },
      { name: 'category_id', label: 'Danh mục', type: 'select', source: 'categories', required: true },
      { name: 'brand_id', label: 'Nhãn hàng', type: 'select', source: 'brands' },
      { name: 'supplier_id', label: 'Nhà cung cấp', type: 'select', source: 'suppliers' },
      { name: 'volume_label', label: 'Dung tích / quy cách', max: 60 }, { name: 'unit', label: 'Đơn vị', required: true, max: 30 },
      { name: 'cost_price', label: 'Giá nhập', type: 'number', min: 0, required: true },
      { name: 'sale_price', label: 'Giá bán', type: 'number', min: 0, required: true },
      { name: 'reorder_level', label: 'Ngưỡng cảnh báo tồn', type: 'number', min: 0, required: true },
      { name: 'description', label: 'Mô tả', type: 'textarea' }, { name: 'ingredient', label: 'Thành phần', type: 'textarea' }
    ],
    columns: [ ['image_file_id','Ảnh'], ['sku','Mã SKU'], ['name','Tên sản phẩm'], ['category_name','Danh mục'], ['brand_name','Nhãn hàng'], ['sale_price','Giá bán','money'], ['stock','Tồn kho'] ],
    detail: true
  },
  categories: {
    title: 'Danh mục', singular: 'danh mục', table: 'categories', key: 'id', adminWrite: true,
    search: ['code','name'], order: 'created_at DESC', listSql: 'SELECT * FROM categories',
    fields: [ {name:'code',label:'Mã danh mục',required:true,max:30}, {name:'name',label:'Tên danh mục',required:true,max:120}, {name:'description',label:'Mô tả',type:'textarea'} ],
    columns: [['code','Mã'],['name','Tên danh mục'],['description','Mô tả']], detail: true
  },
  brands: {
    title: 'Nhãn hàng', singular: 'nhãn hàng', table: 'brands', key: 'id', adminWrite: true,
    search: ['code','name','country'], order: 'created_at DESC', listSql: 'SELECT * FROM brands',
    fields: [ {name:'code',label:'Mã nhãn hàng',required:true,max:30}, {name:'name',label:'Tên nhãn hàng',required:true,max:120}, {name:'country',label:'Quốc gia',max:80}, {name:'website',label:'Website',max:255}, {name:'description',label:'Mô tả',type:'textarea'} ],
    columns: [['code','Mã'],['name','Nhãn hàng'],['country','Quốc gia'],['website','Website']], detail: true
  },
  suppliers: {
    title: 'Nhà cung cấp', singular: 'nhà cung cấp', table: 'suppliers', key: 'id', adminWrite: true,
    search: ['code','name','contact_name','phone','email'], order: 'created_at DESC', listSql: 'SELECT * FROM suppliers',
    fields: [ {name:'code',label:'Mã nhà cung cấp',required:true,max:30}, {name:'name',label:'Tên nhà cung cấp',required:true,max:160}, {name:'contact_name',label:'Người liên hệ',max:120}, {name:'phone',label:'Số điện thoại',max:30}, {name:'email',label:'Email',type:'email',max:180}, {name:'address',label:'Địa chỉ',type:'textarea'}, {name:'note',label:'Ghi chú',type:'textarea'} ],
    columns: [['code','Mã'],['name','Nhà cung cấp'],['contact_name','Người liên hệ'],['phone','Điện thoại'],['email','Email']], detail: true
  },
  customers: {
    title: 'Khách hàng', singular: 'khách hàng', table: 'customers', key: 'id', adminWrite: false,
    search: ['code','full_name','phone','email'], order: 'created_at DESC', listSql: 'SELECT * FROM customers',
    fields: [ {name:'code',label:'Mã khách hàng',required:true,max:30}, {name:'full_name',label:'Họ tên',required:true,max:140}, {name:'phone',label:'Số điện thoại',max:30}, {name:'email',label:'Email',type:'email',max:180}, {name:'birthday',label:'Ngày sinh',type:'date'}, {name:'gender',label:'Giới tính',max:20}, {name:'address',label:'Địa chỉ',type:'textarea'}, {name:'note',label:'Ghi chú',type:'textarea'} ],
    columns: [['code','Mã'],['full_name','Khách hàng'],['phone','Điện thoại'],['email','Email'],['points','Điểm']], detail: true
  }
};

function validatorsFor(definition) {
  return definition.fields.filter((field) => field.required).map((field) =>
    body(field.name).trim().notEmpty().withMessage(`${field.label} không được để trống`)
  ).concat(definition.fields.filter((field) => field.type === 'number').map((field) =>
    body(field.name).optional({ values: 'falsy' }).isFloat({ min: field.min ?? 0 }).withMessage(`${field.label} không hợp lệ`)
  ));
}
function buildWhere(definition, search) {
  if (!search) return { sql: '', values: [] };
  const values = definition.search.map(() => `%${search}%`);
  const sql = definition.search.map((column, index) => `${column} ILIKE $${index + 1}`).join(' OR ');
  return { sql: ` WHERE (${sql})`, values };
}
function normalizeValue(field, value) {
  if (value === '' || value === undefined) return null;
  if (field.type === 'number') return Number(value);
  return typeof value === 'string' ? value.trim() : value;
}

function createResourceRouter(resourceName) {
  const definition = definitions[resourceName];
  if (!definition) throw new Error(`Unknown resource: ${resourceName}`);
  const router = express.Router();
  router.use(requireAuth);
  const writePermission = definition.adminWrite ? requireAdmin : (req, res, next) => next();

  router.get('/', asyncHandler(async (req, res) => {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const where = buildWhere(definition, search);
    const sql = `${definition.listSql}${where.sql} ORDER BY ${definition.order} LIMIT 200`;
    const result = await db.query(sql, where.values);
    res.render('resources/list', { title: definition.title, definition, resourceName, rows: result.rows, search });
  }));

  router.get('/new', writePermission, asyncHandler(async (req, res) => {
    const options = await loadOptions(definition);
    res.render('resources/form', { title: `Thêm ${definition.singular}`, definition, resourceName, row: {}, options, errors: req.session.formErrors || [] });
    delete req.session.formErrors;
  }));

  router.post('/', writePermission, productImageUpload, validatorsFor(definition), validateRequest, asyncHandler(async (req, res) => {
    const fields = definition.fields;
    const names = fields.map((field) => field.name);
    const values = fields.map((field) => normalizeValue(field, req.body[field.name]));
    const placeholders = names.map((_, index) => `$${index + 1}`);
    const sql = `INSERT INTO ${definition.table} (${names.join(',')}) VALUES (${placeholders.join(',')}) RETURNING id`;
    const result = await db.query(sql, values);
    if (resourceName === 'products' && req.file) await saveProductImage(req.file, req.session.user, result.rows[0].id);
    await audit.record({ userId: req.session.user.id, action: 'CREATE', entityType: resourceName, entityId: result.rows[0].id, ip: req.ip });
    if (req.path.startsWith('/api')) return res.status(201).json({ id: result.rows[0].id });
    flash(req, 'success', `Đã thêm ${definition.singular}.`);
    res.redirect(`/${resourceName}`);
  }));

  router.get('/export.csv', asyncHandler(async (req, res) => {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const where = buildWhere(definition, search);
    const rows = await db.query(`${definition.listSql}${where.sql} ORDER BY ${definition.order} LIMIT 5000`, where.values);
    const columns = definition.columns.map((column) => column[0]);
    const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csvRows = [definition.columns.map((column) => escapeCsv(column[1])).join(',')];
    for (const row of rows.rows) csvRows.push(columns.map((column) => escapeCsv(row[column])).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${resourceName}-export.csv"`);
    res.send('\uFEFF' + csvRows.join('\r\n'));
  }));

  router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
    const detailKey = resourceName === 'products' ? 'p.id' : definition.key;
    const result = await db.query(`${definition.listSql} WHERE ${detailKey}=$1`, [req.params.id]);
    if (!result.rowCount) throw notFound(`Không tìm thấy ${definition.singular}.`);
    res.render('resources/detail', { title: `Chi tiết ${definition.singular}`, definition, resourceName, row: result.rows[0] });
  }));

  router.get('/:id(\\d+)/edit', writePermission, asyncHandler(async (req, res) => {
    const result = await db.query(`SELECT * FROM ${definition.table} WHERE ${definition.key}=$1`, [req.params.id]);
    if (!result.rowCount) throw notFound(`Không tìm thấy ${definition.singular}.`);
    const options = await loadOptions(definition);
    const row = result.rows[0];
    if (resourceName === 'products') {
      const image = await db.query("SELECT id FROM file_metadata WHERE entity_type='PRODUCT_IMAGE' AND entity_id=$1 ORDER BY created_at DESC LIMIT 1", [req.params.id]);
      row.image_file_id = image.rows[0]?.id || null;
    }
    res.render('resources/form', { title: `Cập nhật ${definition.singular}`, definition, resourceName, row, options, errors: [] });
  }));

  router.post('/:id(\\d+)', writePermission, productImageUpload, validatorsFor(definition), validateRequest, asyncHandler(async (req, res) => {
    const names = definition.fields.map((field) => field.name);
    const values = definition.fields.map((field) => normalizeValue(field, req.body[field.name]));
    const sets = names.map((name, index) => `${name}=$${index + 1}`);
    values.push(req.params.id);
    const result = await db.query(`UPDATE ${definition.table} SET ${sets.join(',')}, updated_at=NOW() WHERE id=$${values.length} RETURNING id`, values);
    if (!result.rowCount) throw notFound(`Không tìm thấy ${definition.singular}.`);
    if (resourceName === 'products' && req.file) await saveProductImage(req.file, req.session.user, req.params.id);
    await audit.record({ userId: req.session.user.id, action: 'UPDATE', entityType: resourceName, entityId: req.params.id, ip: req.ip });
    flash(req, 'success', `Đã cập nhật ${definition.singular}.`);
    res.redirect(`/${resourceName}`);
  }));

  router.post('/:id(\\d+)/delete', requireAdmin, asyncHandler(async (req, res) => {
    const result = await db.query(`DELETE FROM ${definition.table} WHERE id=$1 RETURNING id`, [req.params.id]);
    if (!result.rowCount) throw notFound(`Không tìm thấy ${definition.singular}.`);
    await audit.record({ userId: req.session.user.id, action: 'DELETE', entityType: resourceName, entityId: req.params.id, ip: req.ip });
    flash(req, 'success', `Đã xóa ${definition.singular}.`);
    res.redirect(`/${resourceName}`);
  }));
  return router;
}

async function loadOptions(definition) {
  const result = {};
  for (const field of definition.fields.filter((item) => item.source)) {
    const source = field.source;
    result[field.name] = (await db.query(`SELECT id, name FROM ${source} WHERE is_active IS DISTINCT FROM FALSE ORDER BY name`)).rows;
  }
  return result;
}

module.exports = { createResourceRouter, definitions, loadOptions, validatorsFor };
