const test = require('node:test');
const assert = require('node:assert/strict');
const format = require('../src/utils/format');
const { AppError, badRequest, notFound, forbidden } = require('../src/utils/errors');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('money formats VND with Vietnamese locale', () => {
  assert.match(format.money(189000), /189\.000/);
  assert.match(format.money(0), /0/);
});

test('money handles null and invalid values without throwing', () => {
  assert.doesNotThrow(() => format.money(null));
  assert.doesNotThrow(() => format.money(undefined));
  assert.doesNotThrow(() => format.money('not-a-number'));
});

test('date returns em dash for missing or invalid values', () => {
  assert.equal(format.date(null), '—');
  assert.equal(format.date(''), '—');
  assert.equal(format.date('not a date'), '—');
});

test('date renders a valid calendar date', () => {
  assert.match(format.date('2026-10-27T00:00:00.000Z'), /2026|2025/);
});

test('dateTime returns em dash for empty values', () => {
  assert.equal(format.dateTime(undefined), '—');
});

test('initials uses the last two name components', () => {
  assert.equal(format.initials('Đào Tuấn Khanh'), 'TK');
  assert.equal(format.initials('Minh Anh'), 'MA');
  assert.equal(format.initials('   '), '');
});

test('AppError preserves status and code', () => {
  const error = new AppError('bad data', 422, 'INVALID');
  assert.equal(error.message, 'bad data');
  assert.equal(error.status, 422);
  assert.equal(error.code, 'INVALID');
  assert.equal(error.name, 'AppError');
});

test('badRequest creates a 400 error', () => {
  const error = badRequest('missing name');
  assert.equal(error.status, 400);
  assert.equal(error.code, 'BAD_REQUEST');
  assert.equal(error.message, 'missing name');
});

test('notFound creates a 404 error', () => {
  const error = notFound('record missing');
  assert.equal(error.status, 404);
  assert.equal(error.code, 'NOT_FOUND');
});

test('forbidden creates a 403 error', () => {
  const error = forbidden();
  assert.equal(error.status, 403);
  assert.equal(error.code, 'FORBIDDEN');
});

test('schema declares the required related business entities', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  for (const table of ['users', 'categories', 'brands', 'suppliers', 'products', 'product_batches', 'customers', 'orders', 'order_items', 'file_metadata']) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(`));
  }
});

test('schema stores file metadata rather than binary file content', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS file_metadata/);
  assert.match(schema, /object_key VARCHAR\(500\) NOT NULL UNIQUE/);
  assert.match(schema, /content_type VARCHAR\(120\) NOT NULL/);
  assert.match(schema, /file_size BIGINT NOT NULL/);
  assert.doesNotMatch(schema, /file_content BYTEA/i);
});


test('customer account migration enables CUSTOMER role and binds user to customer profile', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '003_customer_accounts.sql'), 'utf8');
  assert.match(migration, /'CUSTOMER'/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS customer_id BIGINT/);
  assert.match(migration, /REFERENCES customers\(id\)/);
});

test('customer portal routes and views exist for product catalog and own orders', () => {
  const root = path.join(__dirname, '..');
  for (const file of ['src/routes/customer-shop.js','src/routes/customer-orders.js','src/views/customer/shop.ejs','src/views/customer/orders.ejs','src/views/customer/order-detail.ejs','src/views/auth/register.ejs']) {
    assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);
  }
  const orderRoute = fs.readFileSync(path.join(root, 'src/routes/customer-orders.js'), 'utf8');
  assert.match(orderRoute, /o\.customer_id=\$1/);
  assert.match(orderRoute, /o\.customer_id=\$2/);
});

test('compose declares application, database, MinIO and named volumes', () => {
  const compose = fs.readFileSync(path.join(__dirname, '..', 'compose.yaml'), 'utf8');
  for (const expected of ['application:', 'database:', 'minio:', 'database-data:', 'minio-data:', 'cosmetic-network:']) assert.ok(compose.includes(expected));
});

test('example environment file does not contain an actual .env file', () => {
  assert.ok(fs.existsSync(path.join(__dirname, '..', '.env.example')));
  assert.equal(fs.existsSync(path.join(__dirname, '..', '.env')), false);
});

test('syntax-check script runs and reports source files', () => {
  const script = path.join(__dirname, '..', 'scripts', 'check-syntax.js');
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Checked \d+ JavaScript files/);
});
