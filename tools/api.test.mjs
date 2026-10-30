import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  seed,
  handle,
  normalizeBody,
  Sku,
  Quantity,
  Money,
  Address,
  tables,
} from '../public/mock/engine.mjs';
import { createDemoServer } from './demo-server.mjs';
async function fixture(role = 'admin') {
  let state = await seed();
  const login = handle(
    state,
    'POST',
    '/auth/login',
    await normalizeBody(
      { email: `${role}@demo.ai-todu.test`, password: 'DemoOnly2026!' },
      '/auth/login',
    ),
  );
  state = login.state;
  const token = login.body.token;
  return {
    get state() {
      return state;
    },
    call(method, path, body = {}, override = token) {
      const r = handle(state, method, path, body, override);
      state = r.state;
      return r;
    },
  };
}
test('35 named collections with no duplicate physical names', () => {
  const list = Object.values(tables).flat();
  assert.equal(list.length, 35);
  assert.equal(new Set(list).size, 35);
  assert.ok(list.every((n) => /^[a-z_]+$/.test(n)));
});
test('value objects reject invalid quantities, money precision and SKU', () => {
  assert.throws(() => new Quantity(-1));
  assert.throws(() => new Quantity(1.5));
  assert.throws(() => new Quantity(0, { positive: true }));
  assert.throws(() => new Money(1.001));
  assert.equal(new Money(0.1).cents, 10);
  assert.equal(new Sku(' ab-12 ').value, 'AB-12');
  assert.throws(() => new Address('x'));
});
test('wrong password, missing authentication and non-admin reporting denied', async () => {
  const f = await fixture('warehouse');
  assert.equal(f.call('GET', '/metrics').status, 403);
  assert.equal(f.call('GET', '/products', {}, '').status, 401);
  assert.equal(
    f.call('POST', '/auth/login', { email: 'admin@demo.ai-todu.test', passwordDigest: 'bad' })
      .status,
    401,
  );
});
test('overselling rejects complete transaction and leaves stock and sales untouched', async () => {
  const f = await fixture();
  const before = structuredClone(f.state);
  assert.equal(
    f.call('POST', '/sales', {
      lines: [
        { productId: 'p-tomato', quantity: 1 },
        { productId: 'p-rice', quantity: 9 },
      ],
    }).status,
    409,
  );
  assert.deepEqual(f.state, before);
});
test('stock cannot become negative or fractional through movements', async () => {
  const f = await fixture();
  for (const qty of [-1, 1.5, 0])
    assert.equal(
      f.call('POST', '/movements', {
        productId: 'p-rice',
        quantity: qty,
        type: 'RECEIPT',
        reason: 'Test entry',
      }).status,
      422,
    );
  assert.equal(
    f.call('POST', '/movements', {
      productId: 'p-rice',
      quantity: 9,
      type: 'ISSUE',
      reason: 'Test issue',
    }).status,
    409,
  );
  assert.equal(f.state.products[0].quantity, 8);
});
test('SKU uniqueness is case-insensitive and products start at zero', async () => {
  const f = await fixture();
  assert.equal(
    f.call('POST', '/products', { sku: 'rice-050', name: 'duplicate', price: 1, cost: 1 }).status,
    409,
  );
  const r = f.call('POST', '/products', { sku: 'NEW-01', name: 'New article', price: 5, cost: 3 });
  assert.equal(r.body.quantity, 0);
});
test('conservation does not change with quantity and blocks sales', async () => {
  const f = await fixture();
  f.call('PATCH', '/products/p-rice', { conservation: 'QUARANTINED' });
  f.call('POST', '/movements', {
    productId: 'p-rice',
    quantity: 2,
    type: 'RECEIPT',
    reason: 'Test receipt',
  });
  assert.equal(f.state.products[0].conservation, 'QUARANTINED');
  assert.equal(
    f.call('POST', '/sales', { lines: [{ productId: 'p-rice', quantity: 1 }] }).status,
    409,
  );
});
test('sale updates metrics, movements and historical receipt; cancellation restores exactly once', async () => {
  const f = await fixture();
  const sale = f.call('POST', '/sales', { lines: [{ productId: 'p-rice', quantity: 2 }] }).body;
  assert.equal(f.call('GET', '/metrics').body.revenue, 290);
  assert.equal(f.call('GET', '/metrics').body.grossMargin, 70);
  assert.equal(f.state.products[0].quantity, 6);
  assert.equal(f.state.sales_receipts[0].total, 290);
  assert.equal(f.call('POST', `/sales/${sale.id}/cancel`).status, 200);
  assert.equal(f.state.products[0].quantity, 8);
  assert.equal(f.call('POST', `/sales/${sale.id}/cancel`).status, 409);
  assert.equal(f.call('GET', '/metrics').body.revenue, 0);
});
test('purchase partial receipt rejects excess and duplicate lines atomically', async () => {
  const f = await fixture();
  const order = f.call('POST', '/purchases', {
    supplierId: 'supplier-1',
    lines: [{ productId: 'p-rice', quantity: 4, cost: 100 }],
  }).body;
  const line = f.state.purchase_order_lines[0];
  assert.equal(
    f.call('POST', `/purchases/${order.id}/receipts`, { lines: [{ lineId: line.id, quantity: 2 }] })
      .body.status,
    'PARTIAL',
  );
  assert.equal(f.state.products[0].quantity, 10);
  assert.equal(
    f.call('POST', `/purchases/${order.id}/receipts`, { lines: [{ lineId: line.id, quantity: 3 }] })
      .status,
    409,
  );
  assert.equal(f.state.products[0].quantity, 10);
  assert.equal(
    f.call('POST', `/purchases/${order.id}/receipts`, { lines: [{ lineId: line.id, quantity: 2 }] })
      .body.status,
    'RECEIVED',
  );
});
test('dispatch groups actual sales, prevents duplicate dispatch and enforces transitions and busy resources', async () => {
  const f = await fixture();
  const sale = () =>
    f.call('POST', '/sales', { lines: [{ productId: 'p-rice', quantity: 1 }] }).body;
  const a = sale(),
    b = sale();
  const create = (ids) =>
    f.call('POST', '/dispatches', {
      saleIds: ids,
      driverId: 'driver-1',
      vehicleId: 'vehicle-1',
      destination: 'Demo destination 123',
    });
  const d = create([a.id]).body;
  assert.equal(create([a.id]).status, 409);
  assert.equal(
    f.call('PATCH', `/dispatches/${d.id}`, { status: 'DELIVERED', recipient: 'Demo recipient' })
      .status,
    409,
  );
  assert.equal(f.call('PATCH', `/dispatches/${d.id}`, { status: 'IN_TRANSIT' }).status, 200);
  const d2 = create([b.id]).body;
  assert.equal(f.call('PATCH', `/dispatches/${d2.id}`, { status: 'IN_TRANSIT' }).status, 409);
  assert.equal(f.call('POST', `/sales/${a.id}/cancel`).status, 409);
  assert.equal(
    f.call('PATCH', `/dispatches/${d.id}`, { status: 'DELIVERED', recipient: 'Demo recipient' })
      .status,
    200,
  );
  assert.equal(f.state.delivery_attempts.length, 1);
  assert.equal(f.call('PATCH', `/dispatches/${d.id}`, {}).status, 409);
  assert.equal(f.state.dispatches.find((x) => x.id === d.id).status, 'DELIVERED');
});
test('return limit and restock disposition keep stock and revenue consistent', async () => {
  const f = await fixture();
  const sale = f.call('POST', '/sales', { lines: [{ productId: 'p-rice', quantity: 2 }] }).body;
  const line = f.state.sale_lines[0];
  const r = {
    saleId: sale.id,
    saleLineId: line.id,
    quantity: 1,
    disposition: 'RESTOCK',
    reason: 'Customer return',
  };
  assert.equal(f.call('POST', '/returns', r).status, 201);
  assert.equal(f.state.products[0].quantity, 7);
  assert.equal(f.call('GET', '/metrics').body.revenue, 145);
  assert.equal(f.call('POST', '/returns', { ...r, quantity: 2 }).status, 409);
});
test('tenant isolation and route authorization apply to direct API calls', async () => {
  const f = await fixture();
  const b = await normalizeBody(
    {
      company: 'Other company',
      name: 'Other admin',
      email: 'other@example.test',
      password: 'DemoOnly2026!',
    },
    '/auth/register',
  );
  f.call('POST', '/auth/register', b);
  const login = f.call(
    'POST',
    '/auth/login',
    await normalizeBody({ email: b.email, password: 'DemoOnly2026!' }, '/auth/login'),
  );
  const token = login.body.token;
  assert.equal(f.call('GET', '/products', {}, token).body.items.length, 0);
  assert.equal(f.call('PATCH', '/products/p-rice', { conservation: 'DAMAGED' }, token).status, 404);
});
test('HTTP transport persists a completed transaction across server restart and handles concurrent stock checks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aitodu-api-'));
  const options = { dataFile: join(directory, 'state.json') };
  let server = await createDemoServer(options);
  const listen = async (s) => {
    await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${s.address().port}/api/v1`;
  };
  let base = await listen(server);
  const request = async (method, path, body, token) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    let login = await (
      await request('POST', '/auth/login', {
        email: 'admin@demo.ai-todu.test',
        password: 'DemoOnly2026!',
      })
    ).json();
    const results = await Promise.all([
      request('POST', '/sales', { lines: [{ productId: 'p-rice', quantity: 5 }] }, login.token),
      request('POST', '/sales', { lines: [{ productId: 'p-rice', quantity: 5 }] }, login.token),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    await new Promise((resolve) => server.close(resolve));
    server = await createDemoServer(options);
    base = await listen(server);
    const products = await (await request('GET', '/products', undefined, login.token)).json();
    assert.equal(products.items.find((p) => p.id === 'p-rice').quantity, 3);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test('returns cannot race a dispatch and returned sales are excluded from the dispatch queue', async () => {
  const f = await fixture();
  const sale = f.call('POST', '/sales', { lines: [{ productId: 'p-rice', quantity: 2 }] }).body;
  const line = f.state.sale_lines[0];
  const body = {
    saleId: sale.id,
    saleLineId: line.id,
    quantity: 1,
    disposition: 'RESTOCK',
    reason: 'Demo return',
  };
  const dispatch = f.call('POST', '/dispatches', {
    saleIds: [sale.id],
    driverId: 'driver-1',
    vehicleId: 'vehicle-1',
    destination: 'Demo destination 123',
  }).body;
  assert.equal(f.call('POST', '/returns', body).status, 409);
  f.call('PATCH', `/dispatches/${dispatch.id}`, { status: 'IN_TRANSIT' });
  f.call('PATCH', `/dispatches/${dispatch.id}`, {
    status: 'DELIVERED',
    recipient: 'Demo recipient',
  });
  assert.equal(f.call('POST', '/returns', body).status, 201);
  const sale2 = f.call('POST', '/sales', { lines: [{ productId: 'p-rice', quantity: 1 }] }).body;
  const line2 = f.state.sale_lines.find((x) => x.saleId === sale2.id);
  assert.equal(
    f.call('POST', '/returns', { ...body, saleId: sale2.id, saleLineId: line2.id }).status,
    201,
  );
  assert.ok(!f.call('GET', '/dispatch-candidates').body.items.some((x) => x.id === sale2.id));
  assert.equal(
    f.call('POST', '/dispatches', {
      saleIds: [sale2.id],
      driverId: 'driver-1',
      vehicleId: 'vehicle-1',
      destination: 'Demo destination 123',
    }).status,
    409,
  );
});
test('existing v1 demo records migrate without losing historical receipts', async () => {
  const f = await fixture();
  f.call('POST', '/sales', { lines: [{ productId: 'p-rice', quantity: 1 }] });
  const old = structuredClone(f.state);
  old.version = 1;
  old.receipts_sales = old.sales_receipts;
  delete old.sales_receipts;
  const result = handle(
    old,
    'POST',
    '/auth/login',
    await normalizeBody(
      { email: 'admin@demo.ai-todu.test', password: 'DemoOnly2026!' },
      '/auth/login',
    ),
  );
  assert.equal(result.status, 200);
  assert.equal(result.state.version, 2);
  assert.equal(result.state.sales_receipts.length, 1);
  assert.equal(result.state.sales_receipts[0].number, 'DEMO-SO-0001');
});
