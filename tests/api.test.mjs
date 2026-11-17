import test from 'node:test';
import assert from 'node:assert/strict';

const base = (process.env.TEST_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const customer = { name: 'Khách QA', phone: '0901234567', address: '123 Nguyễn Huệ, TP Hồ Chí Minh' };
async function request(path, body) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10000), ...(body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }) });
  return { status: response.status, body: await response.json() };
}
const orderBody = (items, extra = {}) => ({ customer, paymentMethod: 'COD', items, ...extra });
function error(result, status, code) {
  assert.equal(result.status, status, JSON.stringify(result.body));
  assert.equal(result.body.error.code, code);
  assert.equal(typeof result.body.error.message, 'string');
}

test('catalog and COD integration', async (t) => {
  const catalog = await request('/products');
  assert.equal(catalog.status, 200);
  const products = catalog.body.products;
  assert.ok(products.length >= 12, 'seed at least twelve products');
  const available = products.find((p) => p.stock > 2);
  const second = products.find((p) => p.stock > 2 && p.id !== available?.id);
  const empty = products.find((p) => p.stock === 0);
  assert.ok(available); assert.ok(second); assert.ok(empty);
  const item = { productId: available.id, quantity: 1 };

  await t.test('health, six categories, search, filter, detail and empty states', async () => {
    assert.equal((await request('/health')).body.status, 'ok');
    const categories = (await request('/categories')).body.categories;
    assert.deepEqual(categories.map((c) => c.id).sort(), ['CPU', 'GPU', 'MAINBOARD', 'PSU', 'RAM', 'SSD']);
    for (const category of categories) {
      const filtered = await request(`/products?category=${category.id}`);
      assert.ok(filtered.body.products.length > 0);
      assert.ok(filtered.body.products.every((p) => p.category === category.id));
    }
    const search = await request(`/products?q=${encodeURIComponent(available.brand.toUpperCase())}`);
    assert.ok(search.body.products.some((p) => p.id === available.id));
    assert.ok(search.body.products.every((p) => `${p.name} ${p.brand}`.toUpperCase().includes(available.brand.toUpperCase())));
    assert.deepEqual((await request('/products?q=qa-no-product-837492')).body.products, []);
    assert.deepEqual((await request(`/products/${available.id}`)).body.product, available);
    error(await request('/products/nonexistent-qa-product'), 404, 'NOT_FOUND');
  });

  await t.test('catalog schema uses integer VND and nonnegative stock', () => {
    assert.equal(new Set(products.map((p) => p.id)).size, products.length);
    for (const product of products) {
      for (const field of ['id', 'name', 'brand', 'description', 'image']) {
        assert.equal(typeof product[field], 'string', `${product.id}.${field}`);
      }
      assert.ok(Number.isSafeInteger(product.price) && product.price > 0);
      assert.ok(Number.isSafeInteger(product.stock) && product.stock >= 0);
      assert.ok(product.specs && typeof product.specs === 'object' && !Array.isArray(product.specs));
      assert.ok(Object.values(product.specs).every((value) => typeof value === 'string'));
    }
  });

  await t.test('search by name and brand combines with exact category filter', async () => {
    const queries = [available.name.toLowerCase(), available.brand.toLowerCase(), `  ${available.brand}  `, ''];
    for (const q of queries) {
      const result = await request(`/products?q=${encodeURIComponent(q)}&category=${available.category}`);
      assert.equal(result.status, 200);
      const needle = q.trim().toLowerCase();
      const expected = products.filter((p) => p.category === available.category &&
        (p.name.toLowerCase().includes(needle) || p.brand.toLowerCase().includes(needle)));
      assert.deepEqual(result.body.products.map((p) => p.id).sort(), expected.map((p) => p.id).sort());
    }
    for (const q of ['%', '_', "' OR 1=1 --"]) {
      const result = await request(`/products?q=${encodeURIComponent(q)}`);
      assert.equal(result.status, 200);
      const expected = products.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase()));
      assert.deepEqual(result.body.products.map((p) => p.id).sort(), expected.map((p) => p.id).sort());
    }
    const unknownCategory = await request('/products?category=UNKNOWN');
    assert.equal(unknownCategory.status, 200);
    assert.deepEqual(unknownCategory.body.products, []);
    for (const path of ['/products?q=x&q=y', '/products?category=CPU&category=GPU', '/products?q[x]=y']) {
      error(await request(path), 400, 'VALIDATION_ERROR');
    }
  });

  await t.test('invalid input, duplicate IDs and missing product', async () => {
    const malformed = await fetch(`${base}/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"customer":',
    });
    error({ status: malformed.status, body: await malformed.json() }, 400, 'VALIDATION_ERROR');
    const invalidBodies = [
      orderBody([]), orderBody([item], { paymentMethod: 'CARD' }),
      orderBody([item], { customer: { ...customer, name: '' } }),
      orderBody([item], { customer: { ...customer, phone: 'x' } }),
      orderBody([item], { customer: { ...customer, address: '' } }),
      orderBody([item, item]), ...[0, -1, 1.5, '1'].map((quantity) => orderBody([{ ...item, quantity }])),
    ];
    for (const body of invalidBodies) error(await request('/orders', body), 400, 'VALIDATION_ERROR');
    error(await request('/orders', orderBody([{ productId: 'nonexistent-qa-product', quantity: 1 }])), 404, 'NOT_FOUND');
  });

  await t.test('validation matrix rejects malformed shapes and boundary violations', async (t) => {
    const cases = [
      ['null body', null], ['array body', []], ['missing fields', {}],
      ['null customer', orderBody([item], { customer: null })],
      ['missing customer name', orderBody([item], { customer: { phone: customer.phone, address: customer.address } })],
      ['whitespace name', orderBody([item], { customer: { ...customer, name: '   ' } })],
      ['long name', orderBody([item], { customer: { ...customer, name: 'a'.repeat(101) } })],
      ['numeric phone', orderBody([item], { customer: { ...customer, phone: 901234567 } })],
      ['phone without enough digits', orderBody([item], { customer: { ...customer, phone: '---------'} })],
      ['long address', orderBody([item], { customer: { ...customer, address: 'a'.repeat(501) } })],
      ['invalid email', orderBody([item], { customer: { ...customer, email: 'invalid@' } })],
      ['non-string email', orderBody([item], { customer: { ...customer, email: 12 } })],
      ['missing payment', { customer, items: [item] }],
      ['missing items', { customer, paymentMethod: 'COD' }],
      ['object items', orderBody({ productId: available.id, quantity: 1 })],
      ['too many items', orderBody(Array.from({ length: 101 }, (_, i) => ({ productId: `qa-${i}`, quantity: 1 })))],
      ['null item', orderBody([null])], ['primitive item', orderBody([1])],
      ['empty product ID', orderBody([{ ...item, productId: '' }])],
      ['numeric product ID', orderBody([{ ...item, productId: 1 }])],
      ['long product ID', orderBody([{ ...item, productId: 'a'.repeat(101) }])],
      ...[null, true, 101, Number.MAX_SAFE_INTEGER + 1].map((quantity) =>
        [`invalid quantity ${quantity}`, orderBody([{ ...item, quantity }])]),
      ['missing quantity', orderBody([{ productId: available.id }])],
    ];
    for (const [name, body] of cases) {
      await t.test(name, async () => error(await request('/orders', body), 400, 'VALIDATION_ERROR'));
    }
    assert.equal((await request(`/products/${available.id}`)).body.product.stock, available.stock);
  });

  await t.test('out of stock rejects whole basket without decrement', async () => {
    error(await request('/orders', orderBody([item, { productId: empty.id, quantity: 1 }])), 409, 'OUT_OF_STOCK');
    assert.equal((await request(`/products/${available.id}`)).body.product.stock, available.stock);
    error(await request('/orders', orderBody([{ ...item, quantity: available.stock + 1 }])), 409, 'OUT_OF_STOCK');
    // Ensure a later missing product also rolls back an earlier stock update.
    error(await request('/orders', orderBody([item, { productId: 'zz-nonexistent-qa-product', quantity: 1 }])), 404, 'NOT_FOUND');
    assert.equal((await request(`/products/${available.id}`)).body.product.stock, available.stock);
  });

  await t.test('COD uses DB prices despite client forgery and decrements stock', async () => {
    const result = await request('/orders', orderBody([{ ...item, price: 1, unitPrice: 1, lineTotal: 1 }], { total: 1 }));
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const order = result.body.order;
    assert.ok(order.id); assert.ok(!Number.isNaN(Date.parse(order.createdAt)));
    assert.equal(order.status, 'pending'); assert.equal(order.paymentMethod, 'COD');
    assert.equal(order.total, available.price); assert.equal(order.items[0].unitPrice, available.price);
    assert.equal(order.items[0].lineTotal, available.price); assert.equal(order.items[0].quantity, 1);
    assert.equal(order.customer.phone, customer.phone);
    assert.equal((await request(`/products/${available.id}`)).body.product.stock, available.stock - 1);
  });

  await t.test('multi-item COD calculates quantity totals and preserves customer fields', async () => {
    const buyer = { ...customer, email: 'qa@example.com' };
    const result = await request('/orders', orderBody([
      { productId: second.id, quantity: 1, price: -999, unitPrice: 0, lineTotal: 0 },
      { ...item, quantity: 2, price: 0, unitPrice: 0, lineTotal: 0 },
    ], { customer: buyer, total: -1, status: 'paid', paymentStatus: 'paid' }));
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const { order } = result.body;
    assert.equal(order.paymentMethod, 'COD'); assert.equal(order.status, 'pending');
    assert.deepEqual(order.customer, buyer);
    assert.equal(order.items.length, 2);
    for (const [product, quantity] of [[available, 2], [second, 1]]) {
      const line = order.items.find((i) => i.productId === product.id);
      assert.ok(line);
      assert.equal(line.name, product.name); assert.equal(line.quantity, quantity);
      assert.equal(line.unitPrice, product.price); assert.equal(line.lineTotal, product.price * quantity);
    }
    assert.equal(order.total, available.price * 2 + second.price);
    assert.equal((await request(`/products/${available.id}`)).body.product.stock, available.stock - 3);
    assert.equal((await request(`/products/${second.id}`)).body.product.stock, second.stock - 1);
  });
});

test('PostgreSQL: two concurrent orders for the last unit', {
  skip: process.env.TEST_POSTGRES_CONCURRENCY !== '1' ? 'Set TEST_POSTGRES_CONCURRENCY=1 only against disposable real PostgreSQL, freshly seeded' : false,
}, async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Set TEST_DATABASE_URL to the disposable PostgreSQL database used by the API');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
  const version = await pool.query('SELECT version() AS version');
  assert.match(version.rows[0].version, /PostgreSQL/);
  const products = (await request('/products')).body.products;
  const product = products.find((p) => p.stock === 1);
  assert.ok(product, 'fresh seed needs a disposable product with stock=1');
  const before = await pool.query('SELECT stock FROM products WHERE id=$1', [product.id]);
  assert.equal(before.rows[0]?.stock, 1, 'API and TEST_DATABASE_URL must point at the same freshly seeded database');
  const countBefore = await pool.query('SELECT count(*)::int AS count FROM order_items WHERE product_id=$1', [product.id]);
  const body = orderBody([{ productId: product.id, quantity: 1 }]);
  const results = await Promise.all([request('/orders', body), request('/orders', body)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(results.find((r) => r.status === 409).body.error.code, 'OUT_OF_STOCK');
  assert.equal((await request(`/products/${product.id}`)).body.product.stock, 0);
  const winner = results.find((r) => r.status === 201).body.order;
  assert.equal(winner.total, product.price);
  const after = await pool.query('SELECT stock FROM products WHERE id=$1', [product.id]);
  assert.equal(after.rows[0].stock, 0);
  const countAfter = await pool.query('SELECT count(*)::int AS count FROM order_items WHERE product_id=$1', [product.id]);
  assert.equal(countAfter.rows[0].count, countBefore.rows[0].count + 1, 'only one order item may persist');
  const saved = await pool.query('SELECT status,total FROM orders WHERE id=$1', [winner.id]);
  assert.equal(saved.rows[0].status, 'pending');
  assert.equal(Number(saved.rows[0].total), product.price);
  } finally { await pool.end(); }
});
