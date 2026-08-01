# Bài 34 — Tạo Gmail App Password (development/demo)

Gmail SMTP chỉ dùng cho **development hoặc demo**. Không dùng Gmail SMTP cho
production — production nên dùng một nhà cung cấp email giao dịch chuyên
dụng (ngoài phạm vi chương này).

## 1. Bật xác minh 2 bước (bắt buộc)

App Password chỉ khả dụng khi tài khoản Google đã bật **xác minh hai bước
(2-Step Verification)**.

1. Vào https://myaccount.google.com/security
2. Mục "How you sign in to Google" → bật **2-Step Verification** nếu chưa bật.

## 2. Tạo App Password

1. Vẫn ở trang Security, tìm mục **App passwords** (chỉ hiện khi đã bật 2FA
   ở bước 1).
2. Chọn app "Mail", thiết bị "Other" → đặt tên gợi nhớ, ví dụ
   `ecommerce-backend-dev`.
3. Google sinh ra một chuỗi 16 ký tự (dạng `xxxx xxxx xxxx xxxx`). Đây là
   **App Password**, không phải mật khẩu Gmail thông thường.

## 3. Không dùng mật khẩu Gmail thông thường

- **Không bao giờ** đặt mật khẩu đăng nhập Gmail thật vào `SMTP_PASSWORD`.
  Google sẽ chặn đăng nhập SMTP bằng mật khẩu thường (kể cả khi 2FA tắt,
  Google đang loại bỏ dần "Less secure app access").
- App Password là secret có thể thu hồi độc lập với mật khẩu chính — đúng
  mục đích dùng cho tích hợp SMTP của backend.

## 4. Thu hồi App Password khi bị lộ

Nếu nghi ngờ App Password bị lộ (commit nhầm, log ra ngoài, chia sẻ sai
kênh...):

1. Vào lại https://myaccount.google.com/security → **App passwords**.
2. Xoá (Revoke) App Password tương ứng ngay lập tức.
3. Tạo App Password mới, cập nhật `SMTP_PASSWORD` trong `.env` (không commit
   file này — đã có trong `.gitignore`).
4. Khởi động lại backend để nạp lại cấu hình SMTP.

## 5. Biến môi trường tương ứng trong dự án

Dự án dùng convention `SMTP_*` (không phải `MAIL_*`), xem
`backend/.env.example`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-address@gmail.com
SMTP_PASSWORD=<App Password 16 ký tự, không có khoảng trắng>
SMTP_FROM=no-reply@example.com

# Dùng để build đường dẫn xác minh email / đặt lại mật khẩu trỏ về frontend
FRONTEND_URL=http://localhost:3001
APP_NAME=E-commerce
```

Ở development mặc định dự án dùng **Mailpit** (`SMTP_HOST=localhost`,
`SMTP_PORT=1025`, không cần user/password) — chỉ đổi sang Gmail SMTP khi cần
xem email demo bằng hộp thư Gmail thật.

**Không bao giờ** ghi App Password thật vào `.env.example`, mã nguồn, test
fixture, Dockerfile, `docker-compose.yml`, README hay log.
