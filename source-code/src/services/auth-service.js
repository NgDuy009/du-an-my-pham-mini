const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function ensureCustomerAccountSchema() {
  // Safe, idempotent migration for existing installations.
  await db.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
  await db.query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN','STAFF','CUSTOMER'))");
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id BIGINT');
  await db.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_customer_id_fkey') THEN
      ALTER TABLE users ADD CONSTRAINT users_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
    END IF;
  END $$`);
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS users_customer_id_unique ON users(customer_id) WHERE customer_id IS NOT NULL');
}

async function ensureDemoUsers() {
  const users = [
    { name: process.env.ADMIN_NAME || 'Administrator', email: process.env.ADMIN_EMAIL || 'admin@cosmetic.local', password: process.env.ADMIN_PASSWORD || 'Admin@12345', role: 'ADMIN' },
    { name: 'Nhân viên bán hàng', email: process.env.STAFF_EMAIL || 'staff@cosmetic.local', password: process.env.STAFF_PASSWORD || 'Staff@12345', role: 'STAFF' }
  ];
  for (const user of users) {
    const exists = await db.query('SELECT id FROM users WHERE email=$1', [user.email.toLowerCase()]);
    if (exists.rowCount) continue;
    const passwordHash = await bcrypt.hash(user.password, 12);
    await db.query(
      'INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,$4)',
      [user.name, user.email.toLowerCase(), passwordHash, user.role]
    );
    console.log(`[auth] created demo account ${user.email} (${user.role})`);
  }
}

async function authenticate(email, password) {
  const result = await db.query(
    'SELECT id,full_name,email,password_hash,role,is_active,customer_id FROM users WHERE lower(email)=lower($1)',
    [String(email || '').trim()]
  );
  const user = result.rows[0];
  if (!user || !user.is_active) return null;
  const valid = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!valid) return null;
  await db.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);
  return { id: user.id, fullName: user.full_name, email: user.email, role: user.role, customerId: user.customer_id || null };
}

module.exports = { ensureDemoUsers, ensureCustomerAccountSchema, authenticate };
