import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { categories } from './data.js';

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {super(message);}
}
function invalid(message: string): never { throw new ApiError(400, 'VALIDATION_ERROR', message); }
type Customer = {name:string; phone:string; address:string; email?:string};
type Item = {productId:string; quantity:number};
function validate(body: unknown): {customer:Customer; items:Item[]} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Dữ liệu đặt hàng không hợp lệ.');
  const b = body as Record<string,unknown>;
  if (b.paymentMethod !== 'COD') invalid('Chỉ hỗ trợ thanh toán khi nhận hàng (COD).');
  if (!b.customer || typeof b.customer !== 'object' || Array.isArray(b.customer)) invalid('Vui lòng nhập thông tin người nhận.');
  const c = b.customer as Record<string,unknown>;
  const field = (key:string, min:number, max:number) => {
    const value = c[key];
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) invalid(`Thông tin ${key} không hợp lệ.`);
    return (value as string).trim();
  };
  const customer:Customer = {name:field('name',2,100), phone:field('phone',9,20), address:field('address',5,500)};
  if (!/^[+\d ()-]{9,20}$/.test(customer.phone) || customer.phone.replace(/\D/g,'').length < 9) invalid('Số điện thoại không hợp lệ.');
  if (c.email !== undefined && c.email !== '') {
    if (typeof c.email !== 'string' || c.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) invalid('Email không hợp lệ.');
    customer.email = (c.email as string).trim();
  }
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 100) invalid('Giỏ hàng phải có từ 1 đến 100 sản phẩm.');
  const seen = new Set<string>();
  const items = (b.items as unknown[]).map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Sản phẩm không hợp lệ.');
    const i = value as Record<string,unknown>;
    if (typeof i.productId !== 'string' || !i.productId.trim() || i.productId.length > 100 || seen.has(i.productId)) invalid('Mã sản phẩm không hợp lệ hoặc bị trùng.');
    if (!Number.isSafeInteger(i.quantity) || (i.quantity as number) < 1 || (i.quantity as number) > 100) invalid('Số lượng phải là số nguyên từ 1 đến 100.');
    seen.add(i.productId as string);
    return {productId:i.productId as string, quantity:i.quantity as number};
  });
  return {customer, items};
}

export function createApp(pool: pg.Pool) {
  const app = express();
  app.use(cors({origin:process.env.CORS_ORIGIN || 'http://localhost:5173'}));
  app.use(express.json({limit:'100kb'}));
  const route = (fn:express.RequestHandler):express.RequestHandler => (req,res,next) => {Promise.resolve(fn(req,res,next)).catch(next);};
  app.get('/api/health', route(async (_req,res) => {await pool.query('SELECT 1'); res.json({status:'ok'});}));
  app.get('/api/categories', (_req,res) => {res.json({categories});});
  app.get('/api/products', route(async (req,res) => {
    if ((req.query.q !== undefined && typeof req.query.q !== 'string') || (req.query.category !== undefined && typeof req.query.category !== 'string')) invalid('Bộ lọc không hợp lệ.');
    const q = (req.query.q as string || '').trim();
    const category = req.query.category as string || '';
    const values:string[] = []; const clauses:string[] = [];
    if(q) {values.push('%'+q.replace(/[\\%_]/g,'\\$&')+'%'); clauses.push(`(name ILIKE $${values.length} OR brand ILIKE $${values.length})`);}
    if(category) {values.push(category); clauses.push(`category = $${values.length}`);}
    const result = await pool.query('SELECT * FROM products'+(clauses.length ? ' WHERE '+clauses.join(' AND ') : '')+' ORDER BY id', values);
    res.json({products:result.rows});
  }));
  app.get('/api/products/:id', route(async (req,res) => {
    const result = await pool.query('SELECT * FROM products WHERE id=$1',[req.params.id]);
    if(!result.rows[0]) throw new ApiError(404,'NOT_FOUND','Không tìm thấy sản phẩm.');
    res.json({product:result.rows[0]});
  }));
  app.post('/api/orders', route(async (req,res) => {
    const {customer,items} = validate(req.body);
    const client = await pool.connect();
    let releaseError: Error | undefined;
    try {
      await client.query('BEGIN');
      const orderItems = [];
      // Use a total, locale-independent order, even for canonically equivalent IDs.
      for(const item of [...items].sort((a,b)=>a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)) {
        const result = await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[item.productId]);
        const p = result.rows[0];
        if(!p) throw new ApiError(404,'NOT_FOUND','Không tìm thấy sản phẩm trong giỏ hàng.');
        if(p.stock < item.quantity) throw new ApiError(409,'OUT_OF_STOCK',`${p.name} không đủ số lượng trong kho.`);
        const changed = await client.query('UPDATE products SET stock = stock - CAST($1 AS INTEGER) WHERE id=$2 AND stock >= CAST($1 AS INTEGER) RETURNING id',[item.quantity,item.productId]);
        if(changed.rowCount !== 1) throw new ApiError(409,'OUT_OF_STOCK',`${p.name} không đủ số lượng trong kho.`);
        orderItems.push({productId:p.id as string,name:p.name as string,quantity:item.quantity,unitPrice:Number(p.price),lineTotal:Number(p.price)*item.quantity});
      }
      const total = orderItems.reduce((sum,item)=>sum+item.lineTotal,0);
      const id = randomUUID(); const createdAt = new Date().toISOString();
      await client.query('INSERT INTO orders (id,customer,payment_method,status,total,created_at) VALUES ($1,$2,$3,$4,$5,$6)',[id,JSON.stringify(customer),'COD','pending',total,createdAt]);
      for(const i of orderItems) await client.query('INSERT INTO order_items (order_id,product_id,name,quantity,unit_price,line_total) VALUES ($1,$2,$3,$4,$5,$6)',[id,i.productId,i.name,i.quantity,i.unitPrice,i.lineTotal]);
      await client.query('COMMIT');
      res.status(201).json({order:{id,customer,paymentMethod:'COD',status:'pending',items:orderItems,total,createdAt}});
    } catch(error) {
      try {await client.query('ROLLBACK');} catch(rollbackError) {
        // Never return a connection with a possibly open transaction to the pool.
        releaseError = rollbackError instanceof Error ? rollbackError : new Error('Rollback failed');
        console.error('Order rollback failed', releaseError);
      }
      throw error;
    } finally {client.release(releaseError);}
  }));
  app.use((_req,_res,next) => next(new ApiError(404,'NOT_FOUND','Không tìm thấy đường dẫn.')));
  const errors:ErrorRequestHandler = (error,_req,res,_next) => {
    if(error instanceof ApiError) {res.status(error.status).json({error:{code:error.code,message:error.message}}); return;}
    if(error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {res.status(400).json({error:{code:'VALIDATION_ERROR',message:'JSON không hợp lệ hoặc vượt kích thước cho phép.'}}); return;}
    console.error(error);
    res.status(500).json({error:{code:'INTERNAL_ERROR',message:'Không thể xử lý yêu cầu. Vui lòng thử lại.'}});
  };
  app.use(errors);
  return app;
}
