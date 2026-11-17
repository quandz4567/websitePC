CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 category TEXT NOT NULL CHECK (category IN ('CPU','GPU','MAINBOARD','RAM','SSD','PSU')),
 brand TEXT NOT NULL,
 price INTEGER NOT NULL CHECK (price >= 0),
 stock INTEGER NOT NULL CHECK (stock >= 0),
 description TEXT NOT NULL,
 specs JSONB NOT NULL,
 image TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY,
 customer JSONB NOT NULL,
 payment_method TEXT NOT NULL CHECK (payment_method = 'COD'),
 status TEXT NOT NULL DEFAULT 'pending',
 total BIGINT NOT NULL CHECK (total >= 0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
 order_id TEXT NOT NULL REFERENCES orders(id),
 product_id TEXT NOT NULL REFERENCES products(id),
 name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK (quantity > 0),
 unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
 line_total BIGINT NOT NULL CHECK (line_total >= 0),
 PRIMARY KEY (order_id, product_id)
);
