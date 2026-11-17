# Shared API contract

Frontend owns apps/web/**; backend owns apps/api/**; QA owns tests/**; DevOps owns compose.yaml, Dockerfile.web, Dockerfile.api, nginx.conf, .dockerignore, .env.example, README.md. Manager owns other root files. Do not edit another owner's paths.

React+TS+Vite web on 5173; Express+TS API on 3001; PostgreSQL. npm workspaces. Node 18 compatibility (Vite 5). API prefix /api. Vite proxy /api to API. All prices are integer VND, no cents; shipping is zero. COD only.

Product: {id:string, name:string, category: 'CPU'|'GPU'|'MAINBOARD'|'RAM'|'SSD'|'PSU', brand:string, price:number, stock:number, description:string, specs:Record<string,string>, image:string}. image may be empty; frontend render attractive local category artwork fallback.

GET /api/health -> {status:'ok'} (DB checked).
GET /api/categories -> {categories:[{id:string,name:string}]}.
GET /api/products?q=&category= -> {products:Product[]}. case insensitive name/brand search, category exact; empty result [].
GET /api/products/:id -> {product:Product}; missing 404.
POST /api/orders body {customer:{name:string,phone:string,address:string,email?:string},paymentMethod:'COD',items:[{productId:string,quantity:number}]}. Optional unknown client price fields ignored; server reads DB prices. Reject duplicate product IDs, empty items, invalid quantities, invalid customer, unsupported payment. Return 201 {order:{id:string,customer:{name,phone,address,email?},paymentMethod:'COD',status:'pending',items:[{productId,name,quantity,unitPrice,lineTotal}],total:number,createdAt:string}}. Errors {error:{code:string,message:string}}; 400 VALIDATION_ERROR; 404 NOT_FOUND; 409 OUT_OF_STOCK; 500 INTERNAL_ERROR. Lock stock rows in stable ID order, insert order/items and decrement stock atomically in one transaction.

Backend export createApp(pool) from src/app.ts, separate src/index.ts listener. DATABASE_URL env; PORT=3001; CORS_ORIGIN=http://localhost:5173. db:migrate and db:seed scripts, repeat-safe seeds with >=12 attractive sample products covering all six categories. Include a seeded zero-stock product and one stock=1 product so concurrency QA can test a disposable database. Production requires real PostgreSQL; optional pg-mem fallback ONLY via explicit DEMO_DB=memory for local verification without Docker; clearly document its limitations, do not claim it validates PostgreSQL locks.

QA integration tests use TEST_API_URL=http://localhost:3001/api; tests may use DATABASE_URL with pg for reset of disposable test stock. No application path writes. DevOps use npm install then npm run build, migration and seed at startup or documented explicit commands. Report modified files, commands, results and blockers.
