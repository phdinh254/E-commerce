# E-commerce Backend

Backend Giai đoạn 1: nền tảng NestJS + TypeORM + PostgreSQL + Redis/BullMQ,
authentication (JWT + refresh token rotation), Swagger, i18n, Docker.

Kiến trúc: Modular Monolith (chưa tách microservices). Xem chi tiết công
nghệ và ranh giới phạm vi trong phần "Kiến trúc" bên dưới.

## Yêu cầu hệ thống

- Node.js 22+
- pnpm 10+ (`corepack enable` nếu chưa có)
- Docker Desktop (dùng cho PostgreSQL, Redis, Mailpit, và chạy backend qua
  Docker Compose)

## Cài đặt

```bash
cd backend
pnpm install
```

## Tạo file `.env`

```bash
cp .env.example .env
```

Sau đó cập nhật các giá trị thật (mật khẩu DB, JWT secrets ngẫu nhiên, ...).
Không commit `.env` vào Git — chỉ `.env.example` được commit.

Sinh JWT secret ngẫu nhiên:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Chạy local (không qua Docker cho backend)

Yêu cầu PostgreSQL và Redis đang chạy (có thể dùng Docker Compose chỉ cho
hai service này):

```bash
# từ thư mục gốc repo
docker compose up -d postgres redis mailpit
```

Sau đó chạy backend ở chế độ dev:

```bash
cd backend
pnpm start:dev
```

Backend chạy tại `http://localhost:3000/api`.

## Chạy toàn bộ qua Docker Compose

```bash
# từ thư mục gốc repo
docker compose up -d --build
```

Lệnh này khởi động `postgres`, `redis`, `mailpit`, và `backend` (build từ
`backend/Dockerfile`). Backend chờ các dependency đạt trạng thái healthy
trước khi được coi là sẵn sàng.

Dừng và xoá:

```bash
docker compose down        # dừng, giữ lại volume dữ liệu
docker compose down -v     # dừng và xoá luôn volume (mất dữ liệu Postgres/Redis)
```

Xem log:

```bash
docker compose logs -f backend
```

## Migration

TypeORM migration, **không** dùng `synchronize: true` ở bất kỳ môi trường
nào.

```bash
cd backend

# Chạy migration
pnpm migration:run

# Xem trạng thái migration
pnpm migration:show

# Revert migration gần nhất
pnpm migration:revert

# Tạo migration trống mới (đặt tên rõ ràng)
pnpm migration:create src/database/migrations/TenMigration

# Sinh migration từ thay đổi entity (cần DB đang chạy và đã đồng bộ trạng thái trước đó)
pnpm migration:generate src/database/migrations/TenMigration
```

Nếu chạy backend qua Docker Compose, chạy migration bên trong container:

```bash
docker compose exec backend pnpm migration:run
```

## Seed tài khoản admin

Seed đọc `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_FULL_NAME`
từ `.env`. Chạy lại nhiều lần sẽ không tạo trùng (idempotent — bỏ qua nếu
email đã tồn tại).

```bash
cd backend
pnpm seed:admin
```

## Chạy test

Unit test:

```bash
cd backend
pnpm test
```

E2E test (cần PostgreSQL + Redis test riêng, dùng `docker-compose.test.yml`
ở thư mục gốc — chạy trên cổng khác với môi trường dev để không xung đột):

```bash
# từ thư mục gốc repo
docker compose -f docker-compose.test.yml up -d

cd backend
NODE_ENV=test pnpm migration:run   # chạy migration cho DB test (đọc .env.test)
pnpm test:e2e
```

Dừng môi trường test:

```bash
docker compose -f docker-compose.test.yml down -v
```

## Mở Swagger

Sau khi backend chạy:

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`

## Kiểm tra Mailpit

Mailpit chặn toàn bộ email gửi trong môi trường dev/test, không gửi ra bên
ngoài. Xem hộp thư tại:

```
http://localhost:8025
```

## Dừng và xoá môi trường

```bash
docker compose down -v
docker compose -f docker-compose.test.yml down -v
```

## Xử lý lỗi thường gặp

- **`ECONNREFUSED` khi kết nối PostgreSQL/Redis**: kiểm tra container đã
  `healthy` chưa bằng `docker ps`, và các giá trị `DATABASE_HOST` /
  `REDIS_HOST` trong `.env` khớp với service đang chạy (`localhost` khi chạy
  backend ngoài Docker, tên service `postgres`/`redis` khi backend cũng chạy
  trong Docker Compose).
- **Migration báo bảng đã tồn tại**: có thể migration đã chạy trước đó;
  kiểm tra bằng `pnpm migration:show`.
- **429 Too Many Requests khi test đăng nhập/đăng ký liên tục**: đây là rate
  limit qua Redis theo thiết kế (5–20 request/phút tuỳ endpoint). Đợi hết
  cửa sổ thời gian hoặc flush Redis test (`FLUSHDB`) giữa các lần chạy test.
- **Lỗi build native module (`argon2`) trên Windows**: cần Visual Studio
  Build Tools (C++ build tools) đã cài, hoặc dùng Docker để build thay vì
  build native trên máy host.
- **Swagger không hiển thị endpoint mới**: đảm bảo controller đã được khai
  báo trong module và module đã được import vào `AppModule`.

## Kiến trúc

Xem chi tiết ràng buộc kiến trúc, phạm vi Giai đoạn 1, và các module chưa
triển khai trong tài liệu nội bộ dự án. Tóm tắt nhanh:

- NestJS + TypeScript (strict mode), TypeORM, PostgreSQL (source of truth),
  Redis (cache/BullMQ/rate limit), BullMQ (background job), Nodemailer +
  Mailpit (email dev), nestjs-i18n (vi mặc định, en), Swagger/OpenAPI.
- Authentication: NestJS Passport + JWT, Argon2 hash mật khẩu, refresh token
  rotation lưu hash trong PostgreSQL, refresh token qua cookie HttpOnly.
- Supabase **chỉ** dùng cho Storage (xem `docs/supabase-storage.md`), không
  dùng làm database nghiệp vụ.
- Giai đoạn 1 **chưa** triển khai Product, Category, Variant, Inventory,
  Cart, Checkout, Order, Payment, Promotion, Review, Admin Dashboard,
  Elasticsearch.
