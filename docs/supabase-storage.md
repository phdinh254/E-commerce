# Supabase Storage

Phạm vi sử dụng Supabase trong dự án này **chỉ giới hạn ở Supabase Storage**
(lưu trữ file/object) để phục vụ nhu cầu lưu ảnh và tài nguyên tĩnh ở các
giai đoạn sau (ảnh sản phẩm, banner, v.v.). Supabase **không** được dùng làm
database nghiệp vụ, không dùng Supabase Auth, và không thay thế PostgreSQL.

## Sự khác nhau giữa PostgreSQL của ứng dụng và Supabase Storage

| | PostgreSQL (self-hosted / Docker) | Supabase Storage |
|---|---|---|
| Vai trò | Source of truth cho toàn bộ dữ liệu nghiệp vụ (users, orders, products, ...) | Chỉ lưu file nhị phân (ảnh, tài liệu) và metadata liên quan đến file |
| Truy cập | TypeORM, migration, transaction | Supabase JS SDK (service role key), thông qua `StorageProvider` abstraction |
| Quản lý bởi | Đội backend, chạy trong Docker Compose | Dự án Supabase riêng (cloud), do người vận hành cấu hình |
| Auth | Không dùng Supabase Auth — auth thực hiện bằng NestJS Passport + JWT | Không liên quan đến auth người dùng cuối |

Ứng dụng backend không bao giờ được lưu dữ liệu nghiệp vụ (đơn hàng, người
dùng, sản phẩm...) vào Supabase. Supabase Storage chỉ lưu file, còn đường
dẫn/metadata của file (nếu cần liên kết với entity nghiệp vụ) sẽ được lưu
trong PostgreSQL của ứng dụng ở các giai đoạn sau.

## Kiến trúc trong mã nguồn

- `src/infrastructure/storage/storage.interface.ts` định nghĩa interface
  `StorageProvider` (`upload`, `remove`, `getSignedUrl`, `getBucketName`) để
  các module nghiệp vụ không phụ thuộc trực tiếp vào Supabase SDK. Cũng định
  nghĩa `StorageUnavailableError` (lỗi hạ tầng — map sang 503) và
  `StorageConflictError` (đụng `object_path`, `upsert: false` — map sang 409).
- `src/infrastructure/storage/supabase-storage.provider.ts` là adapter cụ
  thể triển khai `StorageProvider` bằng `@supabase/supabase-js`.
- **Kể từ Chương 11**, adapter này được `ProductsModule` sử dụng thật thông
  qua `ProductImagesService` (`src/modules/products/images/`) để upload/xóa
  ảnh sản phẩm — xem báo cáo Chương 11 (Ch11-B98 → Ch11-B106) để biết chi
  tiết endpoint, schema, business rules.
- Nếu biến môi trường `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` chưa được
  cấu hình, provider sẽ log cảnh báo khi khởi động và ném
  `StorageUnavailableError` rõ ràng nếu có code gọi
  `upload`/`remove`/`getSignedUrl` — không có hành vi giả lập ngầm.
- Test (unit/e2e) dùng `test/utils/fake-storage.provider.ts` — một adapter
  in-memory implement cùng interface — thay vì gọi Supabase thật, vì môi
  trường CI/dev ở đây không có Supabase test project/credential.

## Biến môi trường

| Biến | Mục đích |
|---|---|
| `SUPABASE_URL` | URL của project Supabase (ví dụ `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **chỉ dùng ở backend**, không bao giờ để lộ ra frontend |
| `SUPABASE_STORAGE_BUCKET` | Tên bucket mặc định dùng để lưu file của ứng dụng (`product-images`) |
| `SUPABASE_SIGNED_URL_TTL_SECONDS` | Thời gian sống (giây) của signed URL trả về cho client — mặc định 3600, không lưu vào DB |

Các biến này chỉ dành cho Supabase Storage. Dự án không dùng
`SUPABASE_DATABASE_URL` hay bất kỳ biến kết nối database Supabase nào.

Kể từ Chương 11, ba biến `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/
`SUPABASE_STORAGE_BUCKET` là **bắt buộc khi `NODE_ENV=production`**
(`src/config/env.validation.ts` fail-fast nếu thiếu) — vì upload/CRUD ảnh
sản phẩm giờ là endpoint thật, không còn là hạ tầng "chưa dùng tới" như
Giai đoạn 1. Development/test vẫn cho phép để trống.

## Việc người vận hành phải làm thủ công (chưa được tự động hoá)

Các bước dưới đây phải được thực hiện thủ công trên Supabase Dashboard bởi
người vận hành có quyền truy cập project Supabase thật. Tài liệu này **không
khẳng định các bước này đã được thực hiện** — đó là việc của người vận hành:

1. **Tạo project Supabase** (nếu chưa có) tại https://supabase.com.
2. **Tạo bucket Storage**:
   - Vào **Storage** → **New bucket**.
   - Đặt tên bucket trùng với giá trị sẽ cấu hình ở `SUPABASE_STORAGE_BUCKET`.
   - Bucket phải được tạo ở chế độ **Private** (không bật "Public bucket").
3. **Cấu hình policy truy cập bucket**:
   - Vì bucket là private, mọi truy cập đọc/ghi phải đi qua service role key
     (ở backend) hoặc signed URL có thời hạn — không cấp quyền anon truy cập
     trực tiếp.
   - Nếu cần cho phép service role thao tác, đảm bảo Row Level Security (RLS)
     trên `storage.objects` không chặn các thao tác của service role (mặc
     định service role bỏ qua RLS, nhưng cần xác nhận lại cấu hình dự án).
4. **Lấy Service Role Key**:
   - Vào **Project Settings** → **API** → copy **service_role key**.
   - Lưu key này vào biến môi trường `SUPABASE_SERVICE_ROLE_KEY` trên môi
     trường chạy backend (không commit vào Git, không đưa vào log).
5. **Cập nhật `.env`** (không phải `.env.example`) với `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` thật.

## Truy cập file (từ Chương 11)

Bucket `product-images` là **private**. Client không bao giờ nhận một public
URL cố định — mọi response ảnh sản phẩm trả về một **signed URL** được tạo
mới (`getSignedUrl`, TTL = `SUPABASE_SIGNED_URL_TTL_SECONDS`) tại thời điểm
trả response, không lưu URL này vào PostgreSQL (chỉ lưu `storage_bucket` +
`object_path`). Frontend làm mới URL bằng cách gọi lại endpoint GET ảnh khi
URL cũ hết hạn.

Endpoint upload (Ch11-B101/B102) validate:

- Allowlist định dạng: `image/jpeg`, `image/png`, `image/webp` — **không**
  cho SVG (có thể chứa `<script>`), HTML, PDF, hay file đổi đuôi giả.
- Xác thực bằng **magic bytes** (`src/common/utils/image-signature.util.ts`),
  không tin `file.mimetype` hay phần mở rộng do client gửi.
- Giới hạn kích thước (5MB/ảnh) và số lượng (tối đa 10 ảnh/lần upload nhiều).
- Object path do backend sinh (`products/{productId}/{uuid}.{ext}` — xem
  `src/modules/products/images/object-path.util.ts`), client không được gửi
  path/bucket của riêng mình.

Chi tiết đầy đủ (schema, CRUD, liên kết Variant, compensation khi
Storage/DB lệch nhau, ma trận quyền, Swagger) nằm trong báo cáo Chương 11.
