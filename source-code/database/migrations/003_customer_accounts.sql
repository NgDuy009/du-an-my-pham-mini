-- Add customer login accounts while preserving existing ADMIN/STAFF users and data.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'STAFF', 'CUSTOMER'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id BIGINT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_customer_id_fkey') THEN
    ALTER TABLE users ADD CONSTRAINT users_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_customer_id_unique
  ON users(customer_id) WHERE customer_id IS NOT NULL;
