CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(140) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(60) DEFAULT NULL,
  target_id VARCHAR(80) DEFAULT NULL,
  details JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_actor (actor_user_id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Supplier price snapshots: each import is immutable, and one snapshot per supplier is active.
CREATE TABLE IF NOT EXISTS price_suppliers (
  code VARCHAR(40) NOT NULL PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO price_suppliers (code, display_name) VALUES ('3f', '3F Holdings')
  ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

CREATE TABLE IF NOT EXISTS price_imports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_code VARCHAR(40) NOT NULL,
  effective_month DATE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_sha256 CHAR(64) NOT NULL,
  imported_by BIGINT UNSIGNED NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  item_count INT UNSIGNED NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_price_import_supplier FOREIGN KEY (supplier_code) REFERENCES price_suppliers(code),
  CONSTRAINT fk_price_import_user FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_supplier_active (supplier_code, active, id),
  INDEX idx_supplier_month (supplier_code, effective_month, id),
  INDEX idx_import_duplicate (supplier_code, effective_month, file_sha256)
);

CREATE TABLE IF NOT EXISTS price_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  import_id BIGINT UNSIGNED NOT NULL,
  sheet_name VARCHAR(128) NOT NULL,
  category VARCHAR(255) NOT NULL,
  ul_code VARCHAR(100) NOT NULL,
  source_item_no VARCHAR(30) DEFAULT NULL,
  description TEXT NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  price_range VARCHAR(60) NOT NULL,
  packing_roll VARCHAR(100) DEFAULT NULL,
  moq VARCHAR(100) DEFAULT NULL,
  lead_time VARCHAR(100) DEFAULT NULL,
  source_row INT UNSIGNED NOT NULL,
  CONSTRAINT fk_price_item_import FOREIGN KEY (import_id) REFERENCES price_imports(id) ON DELETE CASCADE,
  UNIQUE KEY uk_price_import_row (import_id, sheet_name, source_row),
  INDEX idx_price_category (import_id, category(100)),
  INDEX idx_price_ul (import_id, ul_code),
  FULLTEXT INDEX ft_price_description (description)
);

INSERT INTO price_suppliers (code, display_name)
VALUES ('aks', 'AKS Distributions')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

CREATE TABLE IF NOT EXISTS aks_imports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  files_json JSON NOT NULL,
  file_count INT UNSIGNED NOT NULL,
  item_count INT UNSIGNED NOT NULL,
  imported_by BIGINT UNSIGNED NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_aks_import_user FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS aks_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  import_id BIGINT UNSIGNED NOT NULL,
  part_no VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'AUD',
  uom VARCHAR(60) NOT NULL,
  moq VARCHAR(60) NOT NULL,
  quote_ref VARCHAR(80) DEFAULT NULL,
  quote_date DATE DEFAULT NULL,
  valid_until DATE DEFAULT NULL,
  source_file VARCHAR(255) NOT NULL,
  source_page INT UNSIGNED NOT NULL,
  source_row INT UNSIGNED NOT NULL,
  CONSTRAINT fk_aks_item_import FOREIGN KEY (import_id) REFERENCES aks_imports(id) ON DELETE CASCADE,
  UNIQUE KEY uq_aks_import_part (import_id, part_no),
  INDEX ix_aks_part (part_no),
  INDEX ix_aks_source (import_id, source_file),
  FULLTEXT INDEX ft_aks_description (description)
);

INSERT INTO price_suppliers (code, display_name)
VALUES ('cabac', 'CABAC')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

CREATE TABLE IF NOT EXISTS cabac_imports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_code VARCHAR(40) NOT NULL DEFAULT 'cabac',
  filename VARCHAR(255) NOT NULL,
  item_count INT UNSIGNED NOT NULL,
  imported_by BIGINT UNSIGNED NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cabac_import_supplier FOREIGN KEY (supplier_code) REFERENCES price_suppliers(code),
  CONSTRAINT fk_cabac_import_user FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cabac_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  import_id BIGINT UNSIGNED NOT NULL,
  item_code VARCHAR(100) NOT NULL,
  item_description TEXT NOT NULL,
  quantity DECIMAL(16,3) NOT NULL,
  quantity_per DECIMAL(16,3) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  offer_price DECIMAL(20,6) NOT NULL,
  currency CHAR(3) NOT NULL,
  sheet_name VARCHAR(128) NOT NULL,
  source_row INT UNSIGNED NOT NULL,
  CONSTRAINT fk_cabac_item_import FOREIGN KEY (import_id) REFERENCES cabac_imports(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cabac_sheet_row (import_id, sheet_name, source_row),
  INDEX ix_cabac_import_code (import_id, item_code),
  FULLTEXT INDEX ft_cabac_description (item_description)
);

INSERT INTO price_suppliers (code, display_name)
VALUES ('carroll', 'Carroll')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

CREATE TABLE IF NOT EXISTS carroll_imports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_code VARCHAR(40) NOT NULL DEFAULT 'carroll',
  filename VARCHAR(255) NOT NULL,
  effective_date DATE NULL,
  item_count INT UNSIGNED NOT NULL,
  imported_by BIGINT UNSIGNED NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_carroll_supplier FOREIGN KEY (supplier_code) REFERENCES price_suppliers(code),
  CONSTRAINT fk_carroll_user FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS carroll_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  import_id BIGINT UNSIGNED NOT NULL,
  part_number VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  per_pack_list_price DECIMAL(18,4) NOT NULL,
  quantity_per_pack DECIMAL(18,4) NOT NULL,
  per_pack_net_price DECIMAL(18,4) NOT NULL,
  discount_percent DECIMAL(7,3) NOT NULL,
  category_discount_code VARCHAR(80) NOT NULL,
  category_product VARCHAR(255) NOT NULL,
  sheet_name VARCHAR(128) NOT NULL,
  source_row INT UNSIGNED NOT NULL,
  CONSTRAINT fk_carroll_item_import FOREIGN KEY (import_id) REFERENCES carroll_imports(id) ON DELETE CASCADE,
  UNIQUE KEY uq_carroll_source_row (import_id, sheet_name, source_row),
  INDEX ix_carroll_part_number (import_id, part_number),
  INDEX ix_carroll_product_category (import_id, category_product),
  FULLTEXT INDEX ft_carroll_description (description)
);