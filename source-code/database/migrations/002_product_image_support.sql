-- Product images are stored as objects in MinIO. This migration is safe to run more than once.
-- The existing file_metadata table already stores object keys and entity relationships.
CREATE INDEX IF NOT EXISTS idx_product_image_lookup
  ON file_metadata(entity_type, entity_id, created_at DESC)
  WHERE entity_type = 'PRODUCT_IMAGE';
