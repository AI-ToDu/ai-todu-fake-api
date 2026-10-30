// Shared application model for both HTTP and Service Worker demo transports.
// No fiscal documents, actual payments or production identity are issued here.
export const tables = {
  identity: [
    'tenants',
    'users',
    'roles',
    'permissions',
    'role_permissions',
    'sessions',
    'employees',
  ],
  inventory: [
    'products',
    'categories',
    'units',
    'warehouses',
    'locations',
    'product_variants',
    'stock_lots',
    'stock_movements',
  ],
  procurement: [
    'suppliers',
    'purchase_orders',
    'purchase_order_lines',
    'receipts',
    'receipt_lines',
  ],
  sales: ['customers', 'sales', 'sale_lines', 'payments', 'sales_receipts'],
  logistics: [
    'drivers',
    'vehicles',
    'dispatches',
    'dispatch_lines',
    'dispatch_stops',
    'delivery_attempts',
    'dispatch_incidents',
  ],
  returns: ['returns', 'return_lines'],
  notifications: ['notifications'],
};
export { DomainError, Sku, Quantity, Money, Address } from './value-objects.mjs';
import { DomainError, Sku, Quantity, Money, Address, fail } from './value-objects.mjs';
import { InventoryItem } from './domain/inventory-item.mjs';
import { SaleSummary } from './domain/sale-summary.mjs';
import { DispatchManifest } from './domain/dispatch-manifest.mjs';
const text = (v, min = 2, max = 160) => {
  const s = String(v ?? '').trim();
  if (s.length < min || s.length > max) fail('INVALID_TEXT');
  return s;
};
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
export async function passwordDigest(password) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(password)));
  return Array.from(new Uint8Array(b), (v) => v.toString(16).padStart(2, '0')).join('');
}
export async function normalizeBody(body, path) {
  const data = { ...body };
  if (['/auth/login', '/auth/register'].includes(path)) {
    if (typeof data.password !== 'string' || data.password.length < 8)
      fail('INVALID_CREDENTIALS', 401);
    data.passwordDigest = await passwordDigest(data.password);
    delete data.password;
  }
  return data;
}
export async function seed() {
  const s = {
    version: 2,
    ...Object.fromEntries(
      Object.values(tables)
        .flat()
        .map((t) => [t, []]),
    ),
  };
  s.tenants.push({ id: 'demo', name: 'Andean Distribution', createdAt: now() });
  for (const role of ['ADMIN', 'WAREHOUSE', 'SALES', 'LOGISTICS'])
    s.roles.push({ id: role, name: role });
  for (const permission of ['inventory', 'procurement', 'sales', 'logistics', 'reporting', 'team'])
    s.permissions.push({ id: permission, name: permission });
  const grants = {
    ADMIN: ['inventory', 'procurement', 'sales', 'logistics', 'reporting', 'team'],
    WAREHOUSE: ['inventory', 'procurement'],
    SALES: ['inventory', 'sales'],
    LOGISTICS: ['inventory', 'logistics'],
  };
  for (const [role, permissions] of Object.entries(grants))
    for (const permission of permissions)
      s.role_permissions.push({
        id: `${role}-${permission}`,
        roleId: role,
        permissionId: permission,
      });
  const hash = await passwordDigest('DemoOnly2026!');
  for (const [key, name, role] of [
    ['admin', 'Alex Morgan', 'ADMIN'],
    ['warehouse', 'Sam Rivera', 'WAREHOUSE'],
    ['sales', 'Jordan Lee', 'SALES'],
    ['logistics', 'Taylor Cruz', 'LOGISTICS'],
  ]) {
    s.users.push({
      id: key,
      tenantId: 'demo',
      email: `${key}@demo.ai-todu.test`,
      name,
      role,
      passwordDigest: hash,
    });
    s.employees.push({ id: `employee-${key}`, tenantId: 'demo', userId: key, name, role });
  }
  s.categories.push({ id: 'food', tenantId: 'demo', name: 'Food & essentials' });
  s.units.push({ id: 'unit', tenantId: 'demo', name: 'Unit' });
  s.warehouses.push({ id: 'wh-main', tenantId: 'demo', name: 'Lima distribution centre' });
  s.locations.push({
    id: 'loc-a1',
    tenantId: 'demo',
    warehouseId: 'wh-main',
    name: 'Aisle A / Bay 01',
  });
  for (const [productId, sku, name, quantity, price, cost, minimum] of [
    ['p-rice', 'RICE-050', 'Premium rice · 50 kg', 8, 145, 110, 10],
    ['p-tomato', 'TOM-020', 'Fresh tomatoes · 20 kg', 15, 65, 42, 5],
    ['p-oil', 'OIL-012', 'Vegetable oil · 12 × 1 L', 0, 96, 74, 4],
  ]) {
    s.products.push({
      id: productId,
      tenantId: 'demo',
      sku,
      name,
      quantity,
      price,
      cost,
      minimum,
      conservation: 'GOOD',
      categoryId: 'food',
      unitId: 'unit',
      locationId: 'loc-a1',
    });
    if (quantity)
      s.stock_movements.push({
        id: id(),
        tenantId: 'demo',
        productId,
        delta: quantity,
        type: 'OPENING',
        reason: 'Demonstration opening balance',
        createdAt: now(),
        userId: 'admin',
      });
  }
  s.suppliers.push({
    id: 'supplier-1',
    tenantId: 'demo',
    name: 'Valley Foods',
    contact: 'Demo supplier',
  });
  s.customers.push({ id: 'customer-1', tenantId: 'demo', name: 'Walk-in customer' });
  s.drivers.push({ id: 'driver-1', tenantId: 'demo', name: 'Morgan Silva', license: 'DEMO-L001' });
  s.vehicles.push({ id: 'vehicle-1', tenantId: 'demo', name: 'Delivery van', plate: 'DEMO-01' });
  return s;
}
const safeUser = (u) => ({
  id: u.id,
  tenantId: u.tenantId,
  email: u.email,
  name: u.name,
  role: u.role,
});
export function handle(state, method, path, body = {}, token = '') {
  try {
    const draft = structuredClone(state);
    if (!draft.sales_receipts && draft.receipts_sales) {
      draft.sales_receipts = draft.receipts_sales;
      delete draft.receipts_sales;
    }
    draft.version = 2;
    const result = execute(draft, method, path, body, token);
    return {
      status: typeof result.status === 'number' ? result.status : 200,
      body: Object.hasOwn(result, 'body') ? result.body : result,
      state: draft,
    };
  } catch (e) {
    if (e instanceof DomainError) return { status: e.status, body: { code: e.code }, state };
    throw e;
  }
}
function execute(s, method, path, b, token) {
  const session = s.sessions.find((x) => x.token === token && Date.parse(x.expiresAt) > Date.now());
  const user = session && s.users.find((x) => x.id === session.userId);
  const list = (t) => s[t].filter((x) => x.tenantId === user?.tenantId);
  const get = (t, key) => list(t).find((x) => x.id === key) ?? fail('NOT_FOUND', 404);
  const add = (t, data) => {
    const row = { id: id(), tenantId: user.tenantId, ...data };
    s[t].push(row);
    return row;
  };
  const allow = (...roles) => {
    if (!roles.includes(user.role)) fail('FORBIDDEN', 403);
  };
  const findProduct = (key) => get('products', key);
  const move = (p, delta, type, reason) => {
    if (!Number.isSafeInteger(delta) || p.quantity + delta < 0) fail('INSUFFICIENT_STOCK', 409);
    const aggregate = new InventoryItem(p);
    if (delta > 0) aggregate.receive(delta);
    else aggregate.issue(-delta);
    p.quantity = aggregate.quantity.value;
    add('stock_movements', {
      productId: p.id,
      delta,
      type,
      reason,
      userId: user.id,
      createdAt: now(),
    });
    if (
      p.quantity <= p.minimum &&
      !list('notifications').some((n) => n.productId === p.id && !n.read)
    )
      add('notifications', { productId: p.id, type: 'LOW_STOCK', read: false, createdAt: now() });
  };
  if (method === 'GET' && path === '/health')
    return { body: { status: 'ok', mode: 'academic-fake-rest-api', version: s.version } };
  if (method === 'POST' && path === '/auth/register') {
    const email = text(b.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('INVALID_EMAIL');
    if (s.users.some((x) => x.email === email)) fail('EMAIL_EXISTS', 409);
    const tenant = { id: id(), name: text(b.company), createdAt: now() };
    s.tenants.push(tenant);
    const u = {
      id: id(),
      tenantId: tenant.id,
      email,
      name: text(b.name),
      role: 'ADMIN',
      passwordDigest: b.passwordDigest,
    };
    s.users.push(u);
    s.employees.push({ id: id(), tenantId: tenant.id, userId: u.id, name: u.name, role: u.role });
    return { status: 201, body: safeUser(u) };
  }
  if (method === 'POST' && path === '/auth/login') {
    const u = s.users.find(
      (x) =>
        x.email === String(b.email).trim().toLowerCase() && x.passwordDigest === b.passwordDigest,
    );
    if (!u) fail('INVALID_CREDENTIALS', 401);
    const token = id();
    s.sessions.push({
      id: id(),
      tenantId: u.tenantId,
      userId: u.id,
      token,
      expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
    });
    return { body: { token, user: safeUser(u) } };
  }
  if (!user) fail('UNAUTHENTICATED', 401);
  if (method === 'GET' && path === '/auth/me') return safeUser(user);
  if (method === 'POST' && path === '/auth/logout') {
    s.sessions = s.sessions.filter((x) => x.token !== token);
    return { status: 204, body: null };
  }
  if (method === 'GET' && path === '/workspace')
    return { tenant: s.tenants.find((t) => t.id === user.tenantId), user: safeUser(user) };
  if (method === 'GET' && path === '/dispatch-candidates') {
    allow('ADMIN', 'LOGISTICS');
    return {
      items: list('sales')
        .filter(
          (sale) =>
            sale.status === 'CONFIRMED' &&
            !list('dispatch_lines').some((l) => l.saleId === sale.id) &&
            !list('returns').some((r) => r.saleId === sale.id),
        )
        .map((sale) => ({ id: sale.id, number: sale.number })),
    };
  }
  const segments = path.split('/').filter(Boolean);
  const [resource, key, action] = segments;
  const resources = {
    products: 'products',
    movements: 'stock_movements',
    suppliers: 'suppliers',
    purchases: 'purchase_orders',
    sales: 'sales',
    dispatches: 'dispatches',
    drivers: 'drivers',
    vehicles: 'vehicles',
    customers: 'customers',
    returns: 'returns',
    notifications: 'notifications',
    employees: 'employees',
    categories: 'categories',
    locations: 'locations',
    lots: 'stock_lots',
  };
  const roleResources = {
    purchases: ['ADMIN', 'WAREHOUSE'],
    suppliers: ['ADMIN', 'WAREHOUSE'],
    sales: ['ADMIN', 'SALES'],
    customers: ['ADMIN', 'SALES'],
    dispatches: ['ADMIN', 'LOGISTICS'],
    drivers: ['ADMIN', 'LOGISTICS'],
    vehicles: ['ADMIN', 'LOGISTICS'],
    returns: ['ADMIN', 'SALES'],
    employees: ['ADMIN'],
  };
  if (roleResources[resource]) allow(...roleResources[resource]);
  if (method === 'GET' && resources[resource] && !key) {
    let items = list(resources[resource]);
    if (resource === 'purchases')
      items = items.map((p) => ({
        ...p,
        lines: list('purchase_order_lines').filter((l) => l.purchaseOrderId === p.id),
      }));
    if (resource === 'sales')
      items = items.map((sale) => ({
        ...sale,
        lines: list('sale_lines').filter((l) => l.saleId === sale.id),
        receipt: list('sales_receipts').find((r) => r.saleId === sale.id),
      }));
    if (resource === 'dispatches')
      items = items.map((d) => ({
        ...d,
        lines: list('dispatch_lines').filter((l) => l.dispatchId === d.id),
        incidents: list('dispatch_incidents').filter((l) => l.dispatchId === d.id),
        stops: list('dispatch_stops').filter((l) => l.dispatchId === d.id),
      }));
    return { items: items.toReversed() };
  }
  if (resource === 'products' && method === 'POST' && !key) {
    allow('ADMIN', 'WAREHOUSE');
    const sku = new Sku(b.sku).value;
    if (list('products').some((p) => p.sku === sku)) fail('SKU_EXISTS', 409);
    const p = add('products', {
      sku,
      name: text(b.name),
      quantity: 0,
      price: new Money(b.price).value,
      cost: new Money(b.cost).value,
      minimum: new Quantity(b.minimum ?? 0).value,
      conservation: 'GOOD',
    });
    return { status: 201, body: p };
  }
  if (resource === 'products' && method === 'PATCH' && key) {
    allow('ADMIN', 'WAREHOUSE');
    const p = findProduct(key);
    if (b.conservation !== undefined) {
      if (!['GOOD', 'QUARANTINED', 'DAMAGED'].includes(b.conservation)) fail('INVALID_STATUS');
      p.conservation = b.conservation;
    }
    return p;
  }
  if (resource === 'movements' && method === 'POST') {
    allow('ADMIN', 'WAREHOUSE');
    const p = findProduct(b.productId),
      amount = new Quantity(b.quantity, { positive: true }).value;
    if (!['RECEIPT', 'ISSUE', 'LOSS'].includes(b.type)) fail('INVALID_STATUS');
    const reason = text(b.reason);
    move(p, b.type === 'RECEIPT' ? amount : -amount, b.type, reason);
    return { status: 201, body: p };
  }
  if (
    ['suppliers', 'customers', 'drivers', 'vehicles'].includes(resource) &&
    method === 'POST' &&
    !key
  ) {
    const data = { name: text(b.name) };
    if (resource === 'vehicles') data.plate = text(b.plate, 3, 16).toUpperCase();
    if (resource === 'drivers') data.license = text(b.license, 3, 32);
    if (resource === 'suppliers') data.contact = text(b.contact ?? 'Demo contact');
    return { status: 201, body: add(resources[resource], data) };
  }
  if (resource === 'purchases' && method === 'POST' && !key) {
    get('suppliers', b.supplierId);
    if (!Array.isArray(b.lines) || !b.lines.length) fail('EMPTY_LINES');
    const order = add('purchase_orders', {
      supplierId: b.supplierId,
      status: 'OPEN',
      createdAt: now(),
      number: `PO-${String(list('purchase_orders').length + 1).padStart(4, '0')}`,
    });
    const seen = new Set();
    for (const line of b.lines) {
      const p = findProduct(line.productId);
      if (seen.has(p.id)) fail('DUPLICATE_LINE');
      seen.add(p.id);
      add('purchase_order_lines', {
        purchaseOrderId: order.id,
        productId: p.id,
        quantity: new Quantity(line.quantity, { positive: true }).value,
        received: 0,
        cost: new Money(line.cost ?? p.cost).value,
      });
    }
    return { status: 201, body: order };
  }
  if (resource === 'purchases' && method === 'POST' && action === 'receipts') {
    const order = get('purchase_orders', key);
    if (order.status === 'RECEIVED') fail('ORDER_CLOSED', 409);
    if (!Array.isArray(b.lines) || !b.lines.length) fail('EMPTY_LINES');
    const receipt = add('receipts', { purchaseOrderId: key, createdAt: now(), userId: user.id });
    const seen = new Set();
    for (const input of b.lines) {
      if (seen.has(input.lineId)) fail('DUPLICATE_LINE');
      seen.add(input.lineId);
      const line = get('purchase_order_lines', input.lineId);
      if (line.purchaseOrderId !== key) fail('NOT_FOUND', 404);
      const qty = new Quantity(input.quantity, { positive: true }).value;
      if (line.received + qty > line.quantity) fail('EXCESS_RECEIPT', 409);
      line.received += qty;
      move(findProduct(line.productId), qty, 'PURCHASE_RECEIPT', order.number);
      add('receipt_lines', { receiptId: receipt.id, purchaseOrderLineId: line.id, quantity: qty });
    }
    order.status = list('purchase_order_lines')
      .filter((l) => l.purchaseOrderId === key)
      .every((l) => l.received === l.quantity)
      ? 'RECEIVED'
      : 'PARTIAL';
    return { status: 201, body: order };
  }
  if (resource === 'sales' && method === 'POST' && !key) {
    if (!Array.isArray(b.lines) || !b.lines.length) fail('EMPTY_LINES');
    const seen = new Set();
    const lines = b.lines.map((input) => {
      const p = findProduct(input.productId),
        qty = new Quantity(input.quantity, { positive: true }).value;
      if (seen.has(p.id)) fail('DUPLICATE_LINE');
      seen.add(p.id);
      new InventoryItem(p).ensureSellable(qty);
      return { product: p, quantity: qty };
    });
    const totalCents = new SaleSummary(lines).total.cents;
    const sale = add('sales', {
      number: `SO-${String(list('sales').length + 1).padStart(4, '0')}`,
      status: 'CONFIRMED',
      total: totalCents / 100,
      createdAt: now(),
      userId: user.id,
    });
    for (const { product: p, quantity } of lines) {
      add('sale_lines', {
        saleId: sale.id,
        productId: p.id,
        name: p.name,
        quantity,
        price: p.price,
        cost: p.cost,
      });
      move(p, -quantity, 'SALE', sale.number);
    }
    add('payments', { saleId: sale.id, amount: sale.total, method: 'DEMO', createdAt: now() });
    add('sales_receipts', {
      saleId: sale.id,
      number: `DEMO-${sale.number}`,
      total: sale.total,
      createdAt: now(),
      fiscal: false,
    });
    return { status: 201, body: sale };
  }
  if (resource === 'sales' && method === 'POST' && action === 'cancel') {
    const sale = get('sales', key);
    if (sale.status === 'CANCELLED') fail('ALREADY_CANCELLED', 409);
    if (list('dispatch_lines').some((l) => l.saleId === key)) fail('SALE_DISPATCHED', 409);
    if (list('returns').some((r) => r.saleId === key)) fail('SALE_HAS_RETURN', 409);
    for (const line of list('sale_lines').filter((l) => l.saleId === key))
      move(findProduct(line.productId), line.quantity, 'CANCELLATION', sale.number);
    sale.status = 'CANCELLED';
    sale.cancellationReason = text(b.reason ?? 'Demo cancellation');
    sale.cancelledAt = now();
    return sale;
  }
  if (resource === 'dispatches' && method === 'POST' && !key) {
    get('drivers', b.driverId);
    get('vehicles', b.vehicleId);
    const destination = new Address(b.destination).value;
    if (!Array.isArray(b.saleIds) || !b.saleIds.length) fail('EMPTY_LINES');
    const sales = [...new Set(b.saleIds)].map((saleId) => get('sales', saleId));
    if (
      sales.some(
        (x) => x.status !== 'CONFIRMED' || list('dispatch_lines').some((l) => l.saleId === x.id),
      )
    )
      fail('SALE_DISPATCHED', 409);
    if (sales.some((sale) => list('returns').some((r) => r.saleId === sale.id)))
      fail('SALE_HAS_RETURN', 409);
    const d = add('dispatches', {
      number: `DP-${String(list('dispatches').length + 1).padStart(4, '0')}`,
      driverId: b.driverId,
      vehicleId: b.vehicleId,
      destination,
      status: 'PENDING',
      createdAt: now(),
    });
    for (const sale of sales)
      for (const line of list('sale_lines').filter((l) => l.saleId === sale.id))
        add('dispatch_lines', {
          dispatchId: d.id,
          saleId: sale.id,
          saleLineId: line.id,
          productId: line.productId,
          quantity: line.quantity,
        });
    add('dispatch_stops', { dispatchId: d.id, sequence: 1, address: destination });
    return { status: 201, body: d };
  }
  if (resource === 'dispatches' && method === 'PATCH' && key && !action) {
    const d = get('dispatches', key);
    const next = { PENDING: 'IN_TRANSIT', IN_TRANSIT: 'DELIVERED' }[d.status];
    if (!next || b.status !== next) fail('INVALID_TRANSITION', 409);
    if (
      next === 'IN_TRANSIT' &&
      list('dispatches').some(
        (x) =>
          x.id !== key &&
          x.status === 'IN_TRANSIT' &&
          (x.driverId === d.driverId || x.vehicleId === d.vehicleId),
      )
    )
      fail('RESOURCE_BUSY', 409);
    if (next === 'DELIVERED') {
      const recipient = text(b.recipient);
      add('delivery_attempts', {
        dispatchId: key,
        recipient,
        status: 'DELIVERED',
        createdAt: now(),
      });
    }
    const manifest = new DispatchManifest(d);
    manifest.transition(next);
    d.status = manifest.status;
    return d;
  }
  if (resource === 'dispatches' && method === 'POST' && action === 'incidents') {
    get('dispatches', key);
    return {
      status: 201,
      body: add('dispatch_incidents', {
        dispatchId: key,
        description: text(b.description, 5, 500),
        createdAt: now(),
      }),
    };
  }
  if (resource === 'returns' && method === 'POST' && !key) {
    const sale = get('sales', b.saleId);
    if (sale.status !== 'CONFIRMED') fail('INVALID_STATUS');
    if (
      list('dispatch_lines').some(
        (l) => l.saleId === sale.id && get('dispatches', l.dispatchId).status !== 'DELIVERED',
      )
    )
      fail('INVALID_TRANSITION', 409);
    const line = get('sale_lines', b.saleLineId);
    if (line.saleId !== sale.id) fail('NOT_FOUND', 404);
    const qty = new Quantity(b.quantity, { positive: true }).value;
    const returned = list('return_lines')
      .filter((x) => x.saleLineId === line.id)
      .reduce((n, x) => n + x.quantity, 0);
    if (returned + qty > line.quantity) fail('EXCESS_RETURN', 409);
    if (!['RESTOCK', 'LOSS'].includes(b.disposition)) fail('INVALID_STATUS');
    const r = add('returns', { saleId: sale.id, reason: text(b.reason), createdAt: now() });
    add('return_lines', {
      returnId: r.id,
      saleLineId: line.id,
      productId: line.productId,
      quantity: qty,
      amount: (new Money(line.price).cents * qty) / 100,
      disposition: b.disposition,
    });
    if (b.disposition === 'RESTOCK') move(findProduct(line.productId), qty, 'RETURN', sale.number);
    return { status: 201, body: r };
  }
  if (resource === 'employees' && method === 'POST') {
    const email = text(b.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('INVALID_EMAIL');
    if (s.users.some((u) => u.email === email)) fail('EMAIL_EXISTS', 409);
    if (!['WAREHOUSE', 'SALES', 'LOGISTICS'].includes(b.role)) fail('INVALID_STATUS');
    // Provisioning only: no secret is exposed and account activation is not claimed.
    const u = add('users', { email, name: text(b.name), role: b.role, passwordDigest: null });
    return { status: 201, body: add('employees', { userId: u.id, name: u.name, role: u.role }) };
  }
  if (resource === 'notifications' && key && method === 'PATCH') {
    const n = get('notifications', key);
    n.read = true;
    return n;
  }
  if (resource === 'metrics' && method === 'GET') {
    allow('ADMIN');
    const confirmed = list('sales').filter((x) => x.status === 'CONFIRMED');
    const saleIds = new Set(confirmed.map((x) => x.id));
    const returned = list('return_lines');
    const refunds = returned.reduce((n, x) => n + new Money(x.amount).cents, 0);
    const revenue = confirmed.reduce((n, x) => n + new Money(x.total).cents, 0) - refunds;
    const cost = list('sale_lines')
      .filter((x) => saleIds.has(x.saleId))
      .reduce((n, x) => n + new Money(x.cost).cents * x.quantity, 0);
    const returnCost = returned
      .filter((r) => r.disposition === 'RESTOCK')
      .reduce((n, r) => n + new Money(get('sale_lines', r.saleLineId).cost).cents * r.quantity, 0);
    const loss = list('stock_movements')
      .filter((m) => m.type === 'LOSS')
      .reduce((n, m) => n + new Money(findProduct(m.productId).cost).cents * Math.abs(m.delta), 0);
    return {
      revenue: revenue / 100,
      grossMargin: (revenue - cost + returnCost - loss) / 100,
      inventoryValue:
        list('products').reduce((n, p) => n + new Money(p.cost).cents * p.quantity, 0) / 100,
      lowStock: list('products').filter((p) => p.quantity <= p.minimum).length,
      dispatches: list('dispatches').filter((d) => d.status === 'IN_TRANSIT').length,
      sales: confirmed.length,
    };
  }
  fail('NOT_FOUND', 404);
}
