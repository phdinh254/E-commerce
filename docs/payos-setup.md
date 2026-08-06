# Cấu hình PayOS ("Thanh toán online") + ngrok cho môi trường development

PayOS là tính năng tùy chọn. Nếu `PAYOS_ENABLED=false` (mặc định),
`POST /checkout/payos` và mọi endpoint liên quan trả về
`503 PAYMENT_PROVIDER_UNAVAILABLE` thay vì khởi động một luồng thanh toán
hỏng. Toàn bộ test tự động (unit + e2e) dùng `FakePayOsGateway` — **không
bao giờ gọi PayOS thật** — nên checklist dưới đây chỉ cần thực hiện khi
muốn kiểm chứng luồng PayOS thật end-to-end (điều mà môi trường phát triển
chuẩn của Chương 17 không có sẵn credential/tunnel để tự làm).

## 1. Tạo tài khoản test PayOS

1. Vào [PayOS](https://payos.vn/) → đăng ký tài khoản merchant (có gói
   sandbox/test miễn phí cho việc tích hợp).
2. Vào **Kênh thanh toán** (hoặc mục tương đương trong dashboard) → tạo một
   "Kênh thanh toán" mới cho ứng dụng.
3. Lấy 3 giá trị credential của kênh vừa tạo:
   - **Client ID**
   - **API Key**
   - **Checksum Key** — dùng để verify chữ ký webhook (`payos.webhooks.verify`
     trong `payos-gateway.service.ts`) và ký request tạo link thanh toán.

Không commit 3 giá trị này vào git dưới bất kỳ hình thức nào (kể cả trong
comment, log, hay file test).

## 2. Cài đặt ngrok để nhận webhook trên máy local

PayOS gọi webhook (`POST /api/v1/payments/payos/webhook`) đến một URL công
khai — `localhost:3000` của bạn không thể nhận request từ internet, nên cần
một tunnel:

```bash
# Cài ngrok: https://ngrok.com/download
ngrok http 3000
```

Ngrok in ra một URL dạng `https://<random>.ngrok-free.app` — đây là origin
công khai trỏ vào backend local của bạn (port 3000, khớp `PORT` trong
`.env`).

## 3. Đăng ký webhook URL với PayOS

Trong dashboard PayOS của kênh thanh toán, đăng ký webhook URL:

```
https://<random>.ngrok-free.app/api/v1/payments/payos/webhook
```

PayOS sẽ gửi một request xác thực đến URL này (tương ứng
`payos.webhooks.confirm(url)` trong SDK — có thể gọi từ dashboard hoặc từ
một script riêng dùng `@payos/node`, backend hiện chưa expose endpoint này
vì nó là thao tác cấu hình một lần, không phải một phần của runtime API).

## 4. Biến môi trường

Thêm vào `.env` của backend (không commit file `.env` thật):

```env
PAYOS_ENABLED=true
PAYOS_CLIENT_ID=<client-id-từ-bước-1>
PAYOS_API_KEY=<api-key-từ-bước-1>
PAYOS_CHECKSUM_KEY=<checksum-key-từ-bước-1>
PAYOS_RETURN_URL=http://localhost:3001/payment-result
PAYOS_CANCEL_URL=http://localhost:3001/payment-result
PAYOS_REQUEST_TIMEOUT_MS=15000
PAYOS_SYNC_COOLDOWN_SECONDS=10
```

`PAYOS_RETURN_URL`/`PAYOS_CANCEL_URL` trỏ về **frontend** (nơi
`payment-result/page.tsx` đọc `orderId` từ query string rồi gọi
`GET /orders/:orderId/payment-status` — không bao giờ tin trực tiếp bất kỳ
tham số nào PayOS gắn vào URL redirect, xem comment trong
`payment-result-panel.tsx`).

Nếu để trống `PAYOS_CLIENT_ID`/`PAYOS_API_KEY`/`PAYOS_CHECKSUM_KEY` (hoặc
`PAYOS_ENABLED=false`), tính năng tự động tắt — xem `PayOsConfig.enabled`
trong `src/config/configuration.ts`, cùng pattern với
`GoogleOAuthConfig.isConfigured`.

## 5. Kiểm thử thủ công luồng thật

1. Khởi động backend (`pnpm start:dev`), frontend (`pnpm dev`), và `ngrok
   http 3000` (giữ terminal ngrok mở suốt phiên test — mỗi lần khởi động lại
   ngrok free-tier sẽ đổi URL, cần đăng ký lại webhook ở bước 3).
2. Đăng nhập, thêm sản phẩm vào giỏ, vào `/checkout`, chọn "Thanh toán qua
   PayOS", điền địa chỉ giao hàng, bấm thanh toán.
3. Trình duyệt chuyển đến trang PayOS thật — hoàn tất một giao dịch test
   (PayOS sandbox thường có sẵn tài khoản/thẻ demo trong dashboard).
4. PayOS gọi webhook qua tunnel ngrok → backend verify chữ ký, cập nhật
   `Payment.status = PAID`, `Order.status PENDING_PAYMENT -> PAID`, redeem
   coupon (nếu có) — xem `PaymentTransitionService`.
5. PayOS redirect trình duyệt về `PAYOS_RETURN_URL?...` → trang
   `payment-result` gọi `GET /orders/:orderId/payment-status`, polling mỗi
   3 giây cho đến khi `isTerminal: true`.
6. Nếu webhook đến chậm hoặc bị chặn, dùng nút "Kiểm tra lại ngay" trên
   trang `payment-result` (gọi `POST /payments/:paymentId/sync` — đường dự
   phòng, dùng chung transition logic với webhook).

## 6. Xoay credential khi bị lộ

1. Trong dashboard PayOS, tạo lại **API Key**/**Checksum Key** cho kênh
   thanh toán (hoặc tạo kênh mới nếu muốn đổi cả Client ID).
2. Cập nhật `.env` ở mọi nơi đang chạy backend — không commit vào git.
3. Restart backend để nạp credential mới (`PayOsGatewayService` đọc config
   một lần lúc khởi tạo client, không hot-reload).
4. Hủy đăng ký webhook URL cũ nếu ngrok URL đã đổi hoặc không còn dùng.

## 7. Trạng thái kiểm chứng

Toàn bộ luồng nghiệp vụ (schema, migration, gateway abstraction,
webhook idempotency + signature verification, transition guard, checkout
COD/PayOS, status/sync endpoint, frontend checkout + return page) đã được
triển khai và kiểm chứng bằng test tự động chạy với `FakePayOsGateway`
(unit test + e2e test trên PostgreSQL thật) — **không gọi PayOS thật ở bất
kỳ đâu trong bộ test**.

**Luồng PayOS thật (credential thật + ngrok + giao dịch thật trên dashboard
PayOS): CHƯA KIỂM CHỨNG / BỊ CHẶN** — môi trường thực hiện Chương 17 này
không có tài khoản test PayOS thật cũng như tunnel ngrok đang chạy. Cần
người có quyền tạo tài khoản PayOS thực hiện checklist ở mục 1–5 phía trên.
