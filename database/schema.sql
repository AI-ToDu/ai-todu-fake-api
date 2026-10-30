-- AI-ToDu normalized relational design v0.2.0. NOT the demo storage adapter.

-- Validated in SQLite; AV2 PostgreSQL/JPA migration and server enforcement remain pending.

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  UNIQUE (name)
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  UNIQUE (name)
);

CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  UNIQUE (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT,
  role_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'INVITED',
  UNIQUE (tenant_id, id),
  UNIQUE (email),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE INDEX idx_users_tenant ON users (tenant_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (token_hash),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

CREATE INDEX idx_sessions_tenant ON sessions (tenant_id);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL,
  job_title TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

CREATE INDEX idx_employees_tenant ON employees (tenant_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_categories_tenant ON categories (tenant_id);

CREATE TABLE units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code)
);

CREATE INDEX idx_units_tenant ON units (tenant_id);

CREATE TABLE warehouses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  address TEXT,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_warehouses_tenant ON warehouses (tenant_id);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  warehouse_id TEXT NOT NULL,
  code TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, warehouse_id, code),
  FOREIGN KEY (tenant_id, warehouse_id) REFERENCES warehouses(tenant_id, id)
);

CREATE INDEX idx_locations_tenant ON locations (tenant_id);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  price_cents BIGINT NOT NULL,
  cost_cents BIGINT NOT NULL,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  conservation TEXT NOT NULL DEFAULT 'GOOD',
  category_id TEXT,
  unit_id TEXT,
  location_id TEXT,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, sku),
  CHECK (quantity >= 0),
  CHECK (price_cents >= 0),
  CHECK (cost_cents >= 0),
  CHECK (minimum_stock >= 0),
  CHECK (conservation IN ('GOOD','QUARANTINED','DAMAGED')),
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories(tenant_id, id),
  FOREIGN KEY (tenant_id, unit_id) REFERENCES units(tenant_id, id),
  FOREIGN KEY (tenant_id, location_id) REFERENCES locations(tenant_id, id)
);

CREATE INDEX idx_products_tenant ON products (tenant_id);

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  attributes_json TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, sku),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id)
);

CREATE INDEX idx_product_variants_tenant ON product_variants (tenant_id);

CREATE TABLE stock_lots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL,
  location_id TEXT,
  lot_number TEXT NOT NULL,
  expires_on TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, product_id, lot_number),
  CHECK (quantity >= 0),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id),
  FOREIGN KEY (tenant_id, location_id) REFERENCES locations(tenant_id, id)
);

CREATE INDEX idx_stock_lots_tenant ON stock_lots (tenant_id);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL,
  lot_id TEXT,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  movement_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  unit_cost_cents BIGINT,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  CHECK (delta <> 0),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id),
  FOREIGN KEY (tenant_id, lot_id) REFERENCES stock_lots(tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

CREATE INDEX idx_stock_movements_tenant ON stock_movements (tenant_id);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  tax_id TEXT,
  contact TEXT,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_suppliers_tenant ON suppliers (tenant_id);

CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  supplier_id TEXT NOT NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, number),
  CHECK (status IN ('OPEN','PARTIAL','RECEIVED','CANCELLED')),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id)
);

CREATE INDEX idx_purchase_orders_tenant ON purchase_orders (tenant_id);

CREATE TABLE purchase_order_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  purchase_order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  received INTEGER NOT NULL DEFAULT 0,
  cost_cents BIGINT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, purchase_order_id, product_id),
  CHECK (quantity > 0),
  CHECK (received >= 0 AND received <= quantity),
  CHECK (cost_cents >= 0),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES purchase_orders(tenant_id, id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id)
);

CREATE INDEX idx_purchase_order_lines_tenant ON purchase_order_lines (tenant_id);

CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  purchase_order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES purchase_orders(tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

CREATE INDEX idx_receipts_tenant ON receipts (tenant_id);

CREATE TABLE receipt_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  receipt_id TEXT NOT NULL,
  purchase_order_line_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, receipt_id, purchase_order_line_id),
  CHECK (quantity > 0),
  FOREIGN KEY (tenant_id, receipt_id) REFERENCES receipts(tenant_id, id),
  FOREIGN KEY (tenant_id, purchase_order_line_id) REFERENCES purchase_order_lines(tenant_id, id)
);

CREATE INDEX idx_receipt_lines_tenant ON receipt_lines (tenant_id);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  email TEXT,
  tax_id TEXT,
  UNIQUE (tenant_id, id)
);

CREATE INDEX idx_customers_tenant ON customers (tenant_id);

CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  customer_id TEXT,
  user_id TEXT NOT NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  total_cents BIGINT NOT NULL,
  created_at TEXT NOT NULL,
  cancelled_at TEXT,
  cancellation_reason TEXT,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, number),
  CHECK (total_cents >= 0),
  CHECK (status IN ('CONFIRMED','CANCELLED')),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers(tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

CREATE INDEX idx_sales_tenant ON sales (tenant_id);

CREATE TABLE sale_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_cents BIGINT NOT NULL,
  cost_cents BIGINT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, sale_id, product_id),
  CHECK (quantity > 0),
  CHECK (price_cents >= 0),
  CHECK (cost_cents >= 0),
  FOREIGN KEY (tenant_id, sale_id) REFERENCES sales(tenant_id, id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id)
);

CREATE INDEX idx_sale_lines_tenant ON sale_lines (tenant_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  sale_id TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  method TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  CHECK (amount_cents >= 0),
  FOREIGN KEY (tenant_id, sale_id) REFERENCES sales(tenant_id, id)
);

CREATE INDEX idx_payments_tenant ON payments (tenant_id);

CREATE TABLE sales_receipts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  sale_id TEXT NOT NULL,
  number TEXT NOT NULL,
  total_cents BIGINT NOT NULL,
  fiscal SMALLINT NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, number),
  UNIQUE (tenant_id, sale_id),
  CHECK (total_cents >= 0),
  CHECK (fiscal IN (0,1)),
  FOREIGN KEY (tenant_id, sale_id) REFERENCES sales(tenant_id, id)
);

CREATE INDEX idx_sales_receipts_tenant ON sales_receipts (tenant_id);

CREATE TABLE drivers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  license TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, license)
);

CREATE INDEX idx_drivers_tenant ON drivers (tenant_id);

CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  plate TEXT NOT NULL,
  capacity_kg NUMERIC,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, plate),
  CHECK (capacity_kg IS NULL OR capacity_kg > 0)
);

CREATE INDEX idx_vehicles_tenant ON vehicles (tenant_id);

CREATE TABLE dispatches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  driver_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  number TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, number),
  CHECK (status IN ('PENDING','IN_TRANSIT','DELIVERED')),
  FOREIGN KEY (tenant_id, driver_id) REFERENCES drivers(tenant_id, id),
  FOREIGN KEY (tenant_id, vehicle_id) REFERENCES vehicles(tenant_id, id)
);

CREATE INDEX idx_dispatches_tenant ON dispatches (tenant_id);

CREATE TABLE dispatch_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  dispatch_id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  sale_line_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, sale_line_id),
  CHECK (quantity > 0),
  FOREIGN KEY (tenant_id, dispatch_id) REFERENCES dispatches(tenant_id, id),
  FOREIGN KEY (tenant_id, sale_id) REFERENCES sales(tenant_id, id),
  FOREIGN KEY (tenant_id, sale_line_id) REFERENCES sale_lines(tenant_id, id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id)
);

CREATE INDEX idx_dispatch_lines_tenant ON dispatch_lines (tenant_id);

CREATE TABLE dispatch_stops (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  dispatch_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  address TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, dispatch_id, sequence),
  CHECK (sequence > 0),
  FOREIGN KEY (tenant_id, dispatch_id) REFERENCES dispatches(tenant_id, id)
);

CREATE INDEX idx_dispatch_stops_tenant ON dispatch_stops (tenant_id);

CREATE TABLE delivery_attempts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  dispatch_id TEXT NOT NULL,
  stop_id TEXT,
  recipient TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, dispatch_id) REFERENCES dispatches(tenant_id, id),
  FOREIGN KEY (tenant_id, stop_id) REFERENCES dispatch_stops(tenant_id, id)
);

CREATE INDEX idx_delivery_attempts_tenant ON delivery_attempts (tenant_id);

CREATE TABLE dispatch_incidents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  dispatch_id TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, dispatch_id) REFERENCES dispatches(tenant_id, id)
);

CREATE INDEX idx_dispatch_incidents_tenant ON dispatch_incidents (tenant_id);

CREATE TABLE returns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  sale_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, sale_id) REFERENCES sales(tenant_id, id)
);

CREATE INDEX idx_returns_tenant ON returns (tenant_id);

CREATE TABLE return_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  return_id TEXT NOT NULL,
  sale_line_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount_cents BIGINT NOT NULL,
  disposition TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, return_id, sale_line_id),
  CHECK (quantity > 0),
  CHECK (amount_cents >= 0),
  CHECK (disposition IN ('RESTOCK','LOSS')),
  FOREIGN KEY (tenant_id, return_id) REFERENCES returns(tenant_id, id),
  FOREIGN KEY (tenant_id, sale_line_id) REFERENCES sale_lines(tenant_id, id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id)
);

CREATE INDEX idx_return_lines_tenant ON return_lines (tenant_id);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT,
  product_id TEXT,
  notification_type TEXT NOT NULL,
  is_read SMALLINT NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  CHECK (is_read IN (0,1)),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id)
);

CREATE INDEX idx_notifications_tenant ON notifications (tenant_id);
