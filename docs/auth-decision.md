# Quyết định kiến trúc Auth — Chương 5 (Bài 38)

## Bối cảnh

Trước khi triển khai Chương 5, backend đã có sẵn một hệ thống authentication
hoàn chỉnh, đã có migration chạy thật và có test bao phủ:

- `AuthModule` (NestJS): JWT access token (15 phút) + refresh token
  (7 ngày, lưu **hash** SHA-256 trong Postgres, không lưu raw token).
- Refresh token **rotation** với transaction + `pessimistic_write` lock,
  chống race condition khi rotate đồng thời (xem
  `refresh-tokens.repository.ts` và `test/auth.e2e-spec.ts`).
- `RolesGuard` kiểm tra role phía backend, không tin dữ liệu từ client.
- Cookie `refresh_token`: `httpOnly`, `sameSite=lax`, `secure` theo env,
  domain cấu hình được.
- CORS: allowlist tường minh (`CORS_ORIGINS`) + `credentials: true`, không
  wildcard.
- `MailModule`/`MailService` (nodemailer) đã tồn tại, cấu hình qua
  `ConfigService`, dùng Mailpit ở dev.

Frontend (Next.js App Router) và backend (NestJS) là **hai origin/process
độc lập**, không phải một ứng dụng Next.js độc chiếm cả FE lẫn BE.

## So sánh

| Tiêu chí             | Auth hiện tại (JWT + refresh rotation) | Better Auth | Quyết định |
| --------------------- | --------------------------------------- | ----------- | ---------- |
| Quản lý session       | Access token JWT (stateless) + refresh token đối chiếu DB, rotation, reuse-detection đã có test | Session store riêng (DB/adapter), invalidation tức thời | Giữ hiện tại — reuse-detection đã chứng minh hoạt động qua test đồng thời |
| Cookie                | `refresh_token` httpOnly/sameSite/secure đã cấu hình theo domain thật | Yêu cầu cấu hình cookie riêng, có thể xung đột tên/domain với cookie hiện tại | Giữ hiện tại |
| Refresh token         | Đã có, hash SHA-256, rotate atomic, revoke-all-on-reuse | Có cơ chế riêng, không tương thích schema hiện tại | Giữ hiện tại |
| Xác minh email        | Chưa có (bổ sung ở Bài 35-37, 40-45 dưới dạng mở rộng AuthModule) | Có sẵn plugin nhưng buộc dùng schema/bảng của Better Auth | Tự bổ sung trên schema hiện tại, không đổi nguồn auth |
| Đặt lại mật khẩu      | Chưa có (bổ sung cùng đợt) | Có sẵn plugin | Tự bổ sung trên schema hiện tại |
| Tích hợp Next.js      | Không cần — frontend chỉ gọi REST API qua `axios` | Thiết kế tối ưu khi Better Auth server nằm trong chính Next.js app | Không áp dụng vì auth backend đã tách riêng ở NestJS |
| Backend NestJS         | Là chủ sở hữu duy nhất của auth logic | Không có adapter chính thức "NestJS làm nguồn auth" — phải tự viết cầu nối, tự tin cookie ký bởi hệ khác | Rủi ro, không cần thiết |
| Database schema        | `users`, `refresh_tokens` đã có migration chạy thật, có FK, index, cascade | Yêu cầu bảng `session`, `account`, `verification` riêng, không khớp `UserEntity` hiện tại (`passwordHash`, `role`, `status` enum tự định nghĩa) | Đổi sang Better Auth đòi hỏi migrate/merge schema, rủi ro mất dữ liệu đăng nhập |
| Migration người dùng   | Không cần — user đã tồn tại đúng schema hiện tại | Cần kế hoạch migrate toàn bộ user sang bảng mới hoặc viết adapter ánh xạ, chưa có kế hoạch nào được duyệt | Không có kế hoạch migrate an toàn trong phạm vi chương này |
| Kiểm thử              | `test/auth.e2e-spec.ts` đã cover register/login/refresh-rotation/logout/me, kể cả race condition | Phải viết lại toàn bộ bộ test đó cho hệ mới | Giữ test hiện có, chỉ bổ sung test cho phần mới |
| Rủi ro chuyển đổi      | Không có (không đổi gì) | Cao: hai nguồn session cùng lúc, phá vỡ cookie/CORS đang hoạt động, đổi API contract `/auth/*` mà frontend đang dùng thật | Rủi ro vượt quá lợi ích trong phạm vi "email service" |

## Quyết định: **Phương án C — Giữ Auth hiện tại**

Lý do:

1. Auth hiện tại **đã hoạt động đúng, có test, có migration chạy thật**.
   Đây không phải một prototype cần thay thế.
2. Better Auth **chưa từng được cài** trong repo (không có trong
   `package.json`/lockfile của backend lẫn frontend) — cài mới đồng nghĩa
   tạo ra **nguồn xác thực thứ hai**, điều bị cấm rõ ràng trong quy tắc dự án
   ("Không được duy trì hai nguồn session cùng có quyền xác thực").
3. Frontend/backend là hai origin khác nhau; kiến trúc lý tưởng của Better
   Auth (browser → Next.js catch-all → Better Auth server → DB, NestJS chỉ
   xác minh session) đòi hỏi thiết kế lại toàn bộ cookie/CORS/API contract
   hiện có — vượt phạm vi "hoàn thiện email service".
4. Không có kế hoạch migrate schema `users`/`refresh_tokens` sang schema
   Better Auth được duyệt trước — cài đặt mà chưa có kế hoạch này là vi phạm
   trực tiếp nguyên tắc "không tự động gộp tài khoản... khi chưa có quy tắc".

## Hệ quả cho Bài 39–45

- **Bài 39** (kiến trúc Better Auth): không áp dụng — không thiết kế kiến
  trúc cho một hệ thống không được cài.
- **Bài 40** (service xác minh session backend): đã tồn tại dưới dạng
  `JwtStrategy` + `JwtAuthGuard` (`src/modules/auth/strategies/jwt.strategy.ts`,
  `src/modules/auth/guards/jwt-auth.guard.ts`) — xác minh access token JWT,
  không tin `userId`/`role` từ client, trả `AuthenticatedUser` tối thiểu.
  Không cần tạo thêm service riêng.
- **Bài 41** (endpoint truy vấn session): đã tồn tại là `GET /api/v1/auth/me`
  — trả `UserResponseDto` (không có `passwordHash`), 401 khi thiếu/token
  không hợp lệ. Không tạo endpoint trùng lặp.
- **Bài 42–44** (Better Auth client, server Next.js, catch-all route):
  **KHÔNG ÁP DỤNG** — không cài Better Auth nên không có các thành phần này.
- **Bài 45** (hook gửi email từ frontend): vẫn triển khai, nhưng hook gọi
  các endpoint REST mới của `AuthModule` hiện tại
  (`/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`,
  `/auth/resend-verification`) thay vì Better Auth action.
