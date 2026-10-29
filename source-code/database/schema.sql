CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'STAFF' CHECK (role IN ('ADMIN','STAFF','CUSTOMER')),
  customer_id BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS brands (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  country VARCHAR(80),
  website VARCHAR(255),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  contact_name VARCHAR(120),
  phone VARCHAR(30),
  email VARCHAR(180),
  address TEXT,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  sku VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE,
  brand_id BIGINT REFERENCES brands(id) ON UPDATE CASCADE ON DELETE SET NULL,
  supplier_id BIGINT REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  description TEXT,
  ingredient TEXT,
  volume_label VARCHAR(60),
  unit VARCHAR(30) NOT NULL DEFAULT 'sản phẩm',
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS product_batches (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON UPDATE CASCADE,
  supplier_id BIGINT REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  batch_code VARCHAR(80) NOT NULL,
  manufactured_on DATE,
  expires_on DATE,
  received_on DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  quantity_remaining INTEGER NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, batch_code),
  CHECK (expires_on IS NULL OR manufactured_on IS NULL OR expires_on >= manufactured_on)
);
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(140) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(180),
  birthday DATE,
  gender VARCHAR(20),
  address TEXT,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_customer_id_fkey') THEN
    ALTER TABLE users ADD CONSTRAINT users_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_customer_id_unique ON users(customer_id) WHERE customer_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS promotions (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(140) NOT NULL,
  discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('PERCENT','AMOUNT')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_code VARCHAR(40) NOT NULL UNIQUE,
  customer_id BIGINT REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_by BIGINT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  promotion_id BIGINT REFERENCES promotions(id) ON UPDATE CASCADE ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('DRAFT','COMPLETED','CANCELLED','REFUNDED')),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH','BANK_TRANSFER','CARD','OTHER')),
  note TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON UPDATE CASCADE,
  batch_id BIGINT REFERENCES product_batches(id) ON UPDATE CASCADE ON DELETE SET NULL,
  product_sku VARCHAR(40) NOT NULL,
  product_name VARCHAR(180) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  line_total NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON UPDATE CASCADE,
  batch_id BIGINT REFERENCES product_batches(id) ON UPDATE CASCADE ON DELETE SET NULL,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('OPENING','RECEIPT','SALE','RETURN','ADJUSTMENT','EXPIRED')),
  quantity_change INTEGER NOT NULL CHECK (quantity_change <> 0),
  reference_type VARCHAR(40),
  reference_id BIGINT,
  note TEXT,
  created_by BIGINT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS file_metadata (
  id BIGSERIAL PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  object_key VARCHAR(500) NOT NULL UNIQUE,
  content_type VARCHAR(120) NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  bucket_name VARCHAR(120) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT,
  uploaded_by BIGINT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80),
  entity_id BIGINT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON product_batches(expires_on);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_entity ON file_metadata(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers USING gin (to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(phone,'')));
