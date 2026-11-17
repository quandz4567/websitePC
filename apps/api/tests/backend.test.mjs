import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';
import { createPool, migrate, seed } from '../dist/db.js';

const customer = { name: 'Khách kiểm thử', phone: '0901234567', address: '123 Nguyễn Huệ' };
const body = (items) => ({ customer, paymentMethod: 'COD', items });

async function serve(t, pool) {
  const server = createApp(pool).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const close = async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  };
  const request = async (path, payload) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, payload === undefined ? {} : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    return { status: response.status, data: await response.json() };
  };
  request.close = close;
  return request;
}

test('demo schema, repeat-safe seed, validation, DB prices and atomic rollback', async (t) => {
  const previous = process.env.DEMO_DB;
  process.env.DEMO_DB = 'memory';
  const pool = await createPool();
  if (previous === undefined) delete process.env.DEMO_DB;
  else process.env.DEMO_DB = previous;
  const request = await serve(t, pool);
  try {
  assert.equal((await request('/health')).data.status, 'ok');
  assert.equal((await request('/categories')).data.categories.length, 6);
  const products = (await request('/products')).data.products;
  assert.ok(products.length >= 12);
  assert.equal(new Set(products.map((p) => p.category)).size, 6);
  const available = products.find((p) => p.stock > 2);
  const empty = products.find((p) => p.stock === 0);
  assert.ok(empty);
  assert.ok(products.some((p) => p.stock === 1));
  assert.ok(products.every((p) => Number.isSafeInteger(p.price)));
  const item = { productId: available.id, quantity: 1 };

  for (const payload of [[], body([[]]), body([{ productId: '   ', quantity: 1 }]),
    { ...body([item]), customer: [] }, body([item, item]),
    ...[0, -1, 1.5, '1', null, 101].map((quantity) => body([{ ...item, quantity }])),
    { ...body([item]), paymentMethod: 'CARD' },
  ]) {
    const result = await request('/orders', payload);
    assert.equal(result.status, 400, JSON.stringify(payload));
    assert.equal(result.data.error.code, 'VALIDATION_ERROR');
  }
  // The available row is updated before the later missing/out-of-stock row fails.
  for (const productId of [empty.id, 'zz-missing-product']) {
    const result = await request('/orders', body([item, { productId, quantity: 1 }]));
    assert.equal(result.status, productId === empty.id ? 409 : 404);
    assert.equal((await request(`/products/${available.id}`)).data.product.stock, available.stock);
    assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM orders')).rows[0].count), 0);
    assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM order_items')).rows[0].count), 0);
  }
  const result = await request('/orders', {
    ...body([{ ...item, price: 1, unitPrice: 1, lineTotal: 1 }]), total: 1,
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.order.total, available.price);
  assert.equal(result.data.order.paymentMethod, 'COD');
  assert.equal(result.data.order.items[0].unitPrice, available.price);
  assert.equal((await pool.query('SELECT * FROM orders')).rows.length, 1);
  assert.equal((await pool.query('SELECT * FROM order_items')).rows.length, 1);
  await migrate(pool);
  await seed(pool);
  assert.equal((await request('/products')).data.products.length, products.length);
  assert.equal((await request(`/products/${available.id}`)).data.product.stock, available.stock - 1);
  assert.equal((await pool.query('SELECT * FROM orders')).rows.length, 1);
  } finally { await request.close(); await pool.end(); }
});

test('lock order is identical for reversed carts containing locale-equivalent IDs', async (t) => {
  const locks = [];
  let currentLocks;
  const pool = { connect: async () => ({
    async query(sql, values) {
      if (sql === 'BEGIN') { currentLocks = []; locks.push(currentLocks); }
      if (sql.startsWith('SELECT')) {
        currentLocks.push(values[0]);
        return { rows: [{ id: values[0], name: 'CPU', stock: 2, price: 1000 }] };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  }) };
  const request = await serve(t, pool);
  try {
  const ids = ['é', 'e\u0301'];
  assert.equal(ids[0].localeCompare(ids[1]), 0);
  for (const cart of [ids, [...ids].reverse()]) {
    assert.equal((await request('/orders', body(cart.map((productId) => ({ productId, quantity: 1 }))))).status, 201);
  }
  assert.deepEqual(locks[0], locks[1]);
  assert.deepEqual(locks[0], [...ids].sort());
  } finally { await request.close(); }
});

test('failed rollback discards the connection', async (t) => {
  const failure = new Error('connection lost during rollback');
  let releasedWith;
  const pool = { connect: async () => ({
    async query(sql) {
      if (sql === 'ROLLBACK') throw failure;
      return { rows: [] };
    },
    release(error) { releasedWith = error; },
  }) };
  const request = await serve(t, pool);
  const original = console.error;
  console.error = () => {};
  try {
    const result = await request('/orders', body([{ productId: 'missing', quantity: 1 }]));
    assert.equal(result.status, 404);
    assert.equal(releasedWith, failure);
  } finally { console.error = original; await request.close(); }
});
