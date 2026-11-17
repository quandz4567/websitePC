# PC Station — cửa hàng linh kiện PC

Demo tiếng Việt dùng React + TypeScript + Vite, Express + TypeScript và PostgreSQL. Giá nguyên VND, miễn phí giao hàng, thanh toán COD. Hợp đồng API ở [API-CONTRACT.md](./API-CONTRACT.md).

## Khởi động bằng Docker (khuyến nghị)

Cài Docker Desktop, bật Linux containers, mở PowerShell tại thư mục dự án:

```powershell
Copy-Item .env.example .env
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
Invoke-RestMethod http://localhost:3001/api/health
Invoke-RestMethod http://localhost:8080/api/health
```

Mở **http://localhost:8080**. Compose đọc `.env` ở thư mục gốc để lấy mật khẩu DB, rồi truyền `DATABASE_URL` nội bộ vào API. API tự chạy migration và seed sau khi PostgreSQL sẵn sàng; web chờ API khỏe. Dữ liệu lưu trong volume `pgdata`. Các cổng chỉ mở trên localhost. Đây là cấu hình phát triển local; thay mật khẩu trước khi dùng ở môi trường khác.

```powershell
docker compose logs -f api
docker compose exec api npm run db:migrate
docker compose exec api npm run db:seed
docker compose down
```

Migration và seed có thể chạy lại. Seed chỉ thêm sản phẩm chưa có, giữ nguyên tồn kho và đơn hàng; chạy seed không đặt lại dữ liệu cho kiểm thử đồng thời. Không xóa volume nếu cần giữ đơn hàng. Nếu đổi mật khẩu sau khi volume đã khởi tạo, cần cập nhật mật khẩu role PostgreSQL hiện có; biến môi trường chỉ áp dụng lúc tạo DB lần đầu. Mật khẩu Compose được ghép trực tiếp vào URL: dùng chữ, số, dấu gạch dưới hoặc gạch ngang. Cần Docker Compose v2 hỗ trợ `up --wait`; nếu hết thời gian chờ, xem `docker compose ps` và `docker compose logs db api web`.

## Chạy phát triển trên máy

Cần Node.js 18.18+ (khuyến nghị Node 22), npm và PostgreSQL 16. Có thể chỉ chạy PostgreSQL qua Docker:

```powershell
Copy-Item .env.example .env
Copy-Item .env.example apps/api/.env
docker compose up -d --wait db
npm ci
npm run db:migrate
npm run db:seed
npm run dev:api
```

Ở terminal thứ hai:

```powershell
npm run dev:web
```

Mở **http://localhost:5173**. Vite chuyển tiếp `/api` đến cổng 3001. Các lệnh npm workspace chạy API tại `apps/api`, nên dotenv đọc `apps/api/.env`; file `.env` gốc chỉ dành cho Compose. Nếu đổi mật khẩu, đồng bộ `POSTGRES_PASSWORD` trong `.env` gốc và `DATABASE_URL` trong `apps/api/.env`. Nếu dùng PostgreSQL cài sẵn, tạo database/user và cập nhật `DATABASE_URL` trong `apps/api/.env`, rồi bỏ lệnh Docker. Giá trị mẫu dùng user `pcstore`, mật khẩu `pcstore_local`, database `pcstore`, khớp Compose.

## Demo khi chưa cài PostgreSQL/Docker

```powershell
npm ci
$env:DEMO_DB = 'memory'
npm run dev:api
```

Sau đó chạy `npm run dev:web` ở terminal khác. Chế độ này tự khởi tạo dữ liệu trong bộ nhớ, mất đơn và tồn kho khi khởi động lại. Chỉ dùng để xem giao diện và luồng COD; **không chứng minh được khóa dòng hoặc tính đúng đắn khi đặt đơn đồng thời trên PostgreSQL**. Xóa biến bằng `Remove-Item Env:DEMO_DB` trước khi quay lại DB thật.

Không chạy lệnh migrate/seed riêng trong chế độ bộ nhớ: mỗi tiến trình có DB riêng và API đã tự khởi tạo dữ liệu. Lệnh migrate riêng còn có thể lỗi `NotSupported` của pg-mem khi chạy lại migration trên DB vừa tự khởi tạo. Các lệnh migrate/seed thủ công ở trên dành cho PostgreSQL thật.

## Build và kiểm tra

```powershell
npm run build
```

Sau khi đã cấu hình DB, migrate và seed, chạy API đã build bằng `npm run start -w apps/api`. Để xem frontend đã build, mở terminal khác chạy `npm run preview -w apps/web -- --port 5173` và truy cập **http://localhost:5173**; Vite preview dùng proxy `/api` đã cấu hình đến API 3001. Các lệnh này cần giữ terminal chạy trong lúc kiểm tra.

Với API đang chạy, mở terminal khác:

```powershell
$env:TEST_API_URL = 'http://localhost:3001/api'
npm test
```

Kiểm thử có thể tạo đơn và thay đổi tồn kho: chỉ dùng dữ liệu demo/DB kiểm thử riêng. Để kiểm tra đồng thời, chạy API trên PostgreSQL kiểm thử vừa seed rồi đặt `$env:TEST_POSTGRES_CONCURRENCY = '1'` trước `npm test`. Không bật cờ này với demo bộ nhớ. Chi tiết ở [hướng dẫn QA](./tests/QA.md).

Kiểm tra thủ công: tìm CPU → mở chi tiết → thêm giỏ → điều chỉnh số lượng → nhập tên, điện thoại, địa chỉ → đặt COD → xem mã đơn và tổng tiền. Kiểm tra thêm lọc GPU, tìm từ khóa không có kết quả, sản phẩm hết hàng và giao diện trên điện thoại.

## Trạng thái xác minh môi trường

Rà soát ngày 2026-11-17: không tìm thấy Docker CLI hoặc `psql` trong PATH, nên chưa chạy được `docker compose config`, build image, Nginx hoặc transaction/khóa dòng trên PostgreSQL thật tại đây. Node hiện có là 18.12.0, thấp hơn phiên bản khuyến nghị. `npm run build` đã qua; API đã build khởi động được trên demo bộ nhớ cổng 3015. `npm test` trả mã 0; chạy trực tiếp `node tests/api.test.mjs` đã hiển thị tám nhóm kiểm thử API thành công, với bài đồng thời PostgreSQL bỏ qua. Lệnh seed đã build chạy được trong bộ nhớ; lệnh migrate riêng lỗi pg-mem như mô tả ở trên. Những kết quả này không xác minh stack Docker hoặc migration/seed trên PostgreSQL thật.
