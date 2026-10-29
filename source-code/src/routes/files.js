const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/database');
const { client: minio, bucket } = require('../config/storage');
const asyncHandler = require('../utils/async-handler');
const { requireAuth, flash } = require('../middleware/auth');
const { badRequest, notFound } = require('../utils/errors');
const audit = require('../services/audit-service');
const router = express.Router();
router.use(requireAuth);
const maxBytes = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 5)) * 1024 * 1024;
const allowedMime = new Set(['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const allowedExt = new Set(['.jpg','.jpeg','.png','.webp','.pdf','.docx']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } });

function validateFile(file) {
  if (!file) throw badRequest('Vui lòng chọn tệp cần tải lên.');
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.has(extension) || !allowedMime.has(file.mimetype)) throw badRequest('Định dạng được hỗ trợ: JPG, PNG, WEBP, PDF, DOCX.');
  if (!file.size || file.size > maxBytes) throw badRequest(`Dung lượng tệp tối đa là ${Math.round(maxBytes / 1024 / 1024)} MB.`);
}
async function storeFile(file, user, entityType, entityId) {
  validateFile(file);
  const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  const key = `uploads/${new Date().toISOString().slice(0,7).replace('-','/')}/${crypto.randomUUID()}-${safeName}`;
  await minio.putObject(bucket, key, file.buffer, file.size, { 'Content-Type': file.mimetype, 'X-Amz-Meta-Original-Name': encodeURIComponent(file.originalname) });
  try {
    const result = await db.query(`INSERT INTO file_metadata(original_name,object_key,content_type,file_size,bucket_name,entity_type,entity_id,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [file.originalname, key, file.mimetype, file.size, bucket, entityType || 'GENERAL', entityId ? Number(entityId) : null, user.id]);
    return result.rows[0];
  } catch (error) {
    await minio.removeObject(bucket, key).catch(() => {});
    throw error;
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.query(`SELECT f.*,u.full_name AS uploader FROM file_metadata f LEFT JOIN users u ON u.id=f.uploaded_by ORDER BY f.created_at DESC LIMIT 300`);
  res.render('files/list', { title: 'Tệp đã tải lên', files: rows.rows });
}));
router.get('/upload', asyncHandler(async (req, res) => {
  const products = await db.query('SELECT id,sku,name FROM products ORDER BY name LIMIT 500');
  res.render('files/form', { title: 'Tải tệp lên', products: products.rows });
}));
router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  const metadata = await storeFile(req.file, req.session.user, req.body.entity_type, req.body.entity_id);
  await audit.record({ userId: req.session.user.id, action: 'UPLOAD_FILE', entityType: 'file_metadata', entityId: metadata.id, details: { objectKey: metadata.object_key }, ip: req.ip });
  flash(req, 'success', 'Tệp đã được lưu vào MinIO.');
  res.redirect('/files');
}));
router.post('/api/upload', upload.single('file'), asyncHandler(async (req, res) => {
  const metadata = await storeFile(req.file, req.session.user, req.body.entity_type, req.body.entity_id);
  res.status(201).json({ data: metadata });
}));
router.get('/:id(\\d+)/download', asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM file_metadata WHERE id=$1', [req.params.id]);
  if (!result.rowCount) throw notFound('Không tìm thấy tệp.');
  const metadata = result.rows[0];
  const stream = await minio.getObject(metadata.bucket_name, metadata.object_key);
  res.setHeader('Content-Type', metadata.content_type);
  res.setHeader('Content-Length', metadata.file_size);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(metadata.original_name)}`);
  stream.on('error', (error) => { if (!res.headersSent) res.status(500).end(); else res.destroy(error); });
  stream.pipe(res);
}));
router.get('/:id(\\d+)/view', asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM file_metadata WHERE id=$1', [req.params.id]);
  if (!result.rowCount) throw notFound('Không tìm thấy tệp.');
  const metadata = result.rows[0];
  const stream = await minio.getObject(metadata.bucket_name, metadata.object_key);
  res.setHeader('Content-Type', metadata.content_type);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(metadata.original_name)}`);
  stream.on('error', (error) => { if (!res.headersSent) res.status(500).end(); else res.destroy(error); });
  stream.pipe(res);
}));
router.post('/:id(\\d+)/delete', asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM file_metadata WHERE id=$1', [req.params.id]);
  if (!result.rowCount) throw notFound('Không tìm thấy tệp.');
  const metadata = result.rows[0];
  if (req.session.user.role !== 'ADMIN' && Number(metadata.uploaded_by) !== Number(req.session.user.id)) {
    const error = new Error('Bạn chỉ có thể xóa tệp do mình tải lên.'); error.status = 403; throw error;
  }
  await minio.removeObject(metadata.bucket_name, metadata.object_key);
  await db.query('DELETE FROM file_metadata WHERE id=$1', [metadata.id]);
  await audit.record({ userId: req.session.user.id, action: 'DELETE_FILE', entityType: 'file_metadata', entityId: metadata.id, ip: req.ip });
  flash(req, 'success', 'Đã xóa tệp.'); res.redirect('/files');
}));
module.exports = router;
