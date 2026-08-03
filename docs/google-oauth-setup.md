# Cấu hình Google OAuth ("Đăng nhập bằng Google")

Google OAuth là tính năng tùy chọn. Nếu không cấu hình, `GET /auth/google`
và `GET /auth/google/callback` trả về `503 GOOGLE_OAUTH_NOT_CONFIGURED`
thay vì khởi động một luồng OAuth hỏng.

## 1. Tạo OAuth consent screen

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → chọn hoặc
   tạo một project.
2. **APIs & Services → OAuth consent screen**.
3. User type: **External** (trừ khi bạn dùng Google Workspace nội bộ).
4. Điền tên ứng dụng, email hỗ trợ, email liên hệ nhà phát triển.
5. Scopes: thêm `userinfo.email` và `userinfo.profile` (đây là scope
   `email`/`profile` mà backend yêu cầu — xem `google.strategy.ts`).
6. Ở môi trường phát triển, thêm tài khoản Google của bạn vào **Test users**
   nếu app còn ở trạng thái "Testing".

## 2. Tạo OAuth client ID (Web application)

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized JavaScript origins**: origin của **frontend** (nơi trình
   duyệt render trang, không phải backend):
   - Development: `http://localhost:3001`
   - Production: origin thật của frontend, ví dụ `https://shop.example.com`
4. **Authorized redirect URIs**: URL callback của **backend** — phải khớp
   chính xác với `GOOGLE_CALLBACK_URL` bên dưới, bao gồm cả `/api/v1` prefix:
   - Development: `http://localhost:3000/api/v1/auth/google/callback`
   - Production: `https://api.example.com/api/v1/auth/google/callback`
5. Lưu lại **Client ID** và **Client Secret**.

## 3. Biến môi trường

Thêm vào `.env` của backend (không commit file `.env` thật):

```env
GOOGLE_CLIENT_ID=<client-id-từ-bước-2>
GOOGLE_CLIENT_SECRET=<client-secret-từ-bước-2>
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
```

`FRONTEND_URL` (đã có sẵn trong `.env`) được dùng để redirect trình duyệt về
`${FRONTEND_URL}/auth/google/callback` sau khi backend xử lý xong — trang đó
chỉ gọi `/auth/refresh` để lấy access token/user từ cookie phiên đã được
backend đặt, **không có token nào nằm trong URL**.

Nếu để trống cả ba biến, tính năng tự động tắt (xem
`GoogleOAuthConfig.isConfigured` trong `src/config/configuration.ts`).

## 4. Development vs Production

| | Development | Production |
| --- | --- | --- |
| JavaScript origin | `http://localhost:3001` | origin frontend thật (HTTPS) |
| Redirect URI | `http://localhost:3000/api/v1/auth/google/callback` | origin backend thật + `/api/v1/auth/google/callback` (HTTPS) |
| `COOKIE_SECURE` | `false` (HTTP local) | `true` (bắt buộc dùng HTTPS) |
| OAuth consent screen | "Testing" + test users | "In production" (đã qua review nếu dùng scope nhạy cảm) |

Mỗi origin/redirect URI khác nhau (kể cả khác cổng) cần được khai báo riêng
trong cùng một OAuth client, hoặc tạo client riêng cho từng môi trường —
khuyến nghị tạo **client riêng cho development và production** để có thể
thu hồi từng cái độc lập.

## 5. Thu hồi hoặc xoay secret khi bị lộ

1. **Credentials → chọn OAuth client → Reset secret** (hoặc xóa client và
   tạo lại nếu muốn đổi cả Client ID).
2. Cập nhật `GOOGLE_CLIENT_SECRET` (và `GOOGLE_CLIENT_ID` nếu đổi) ở mọi nơi
   đang chạy backend (không commit vào git).
3. Restart backend để nạp secret mới — vì `GoogleStrategy` đọc secret một
   lần lúc khởi động (`ConfigService` trong constructor), không hot-reload.
4. Vì access/refresh token của ứng dụng do backend tự phát hành (không phải
   token của Google), việc xoay secret Google **không** cần thu hồi
   `refresh_tokens`/`oauth_identities` hiện có — người dùng đã liên kết vẫn
   đăng nhập lại được bình thường sau khi secret mới có hiệu lực.

## 6. Trạng thái kiểm chứng

Việc cấu hình repository (biến môi trường, module, entity, migration,
guard chống CSRF `state`, quy tắc account-linking) đã hoàn thành và có test
tự động (mock ranh giới Google OAuth, không gọi Google thật).

**Đăng nhập Google với credentials thật: CHƯA KIỂM CHỨNG VỚI GOOGLE THẬT** —
cần người có quyền truy cập Google Cloud Console của dự án tạo OAuth client
theo hướng dẫn trên, điền vào `.env`, rồi thao tác thử trên trình duyệt.
