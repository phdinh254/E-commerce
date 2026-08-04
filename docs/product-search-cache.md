# Vì sao cache cho tìm kiếm sản phẩm (Chương 9, Bài 83)

## Đường đi của một request search

`GET /api/v1/products?search=...` chạy một query PostgreSQL có `ILIKE` trên
`name`/`sku`/`short_description`, cộng `ORDER BY` (ranking hoặc cột thường)
và `LIMIT/OFFSET`. Trong một storefront thực tế, cùng một tổ hợp
(keyword, page, limit, sort, categoryId) — ví dụ trang chủ hoặc một từ khóa
phổ biến — thường được nhiều khách xem lại trong khoảng thời gian ngắn, và
kết quả của nó không đổi trừ khi có Product bị tạo/sửa/xóa. Đây chính là
tổ hợp: **truy vấn lặp lại + kết quả ổn định trong thời gian ngắn** — điều
kiện cache-aside phát huy tác dụng.

`GET /api/v1/products/featured` được gọi ở mọi lần tải trang landing —
tần suất đọc cao hơn nhiều so với tần suất một sản phẩm được gắn/gỡ
`isFeatured`.

## Cache mang lại gì (và không mang lại gì)

- Giảm số lần PostgreSQL phải thực thi cùng một truy vấn.
- Giảm latency cho các truy vấn phổ biến (đọc từ Redis thay vì quét bảng).
- Giảm tải PostgreSQL khi có nhiều request search/featured đồng thời.
- **Không** được tuyên bố là "nhanh hơn X%" — dự án này chưa benchmark.
  Thiết kế nhằm giảm truy vấn lặp lại; hiệu năng thực tế cần đo trong môi
  trường triển khai thật.

## Rủi ro và cách xử lý

- **Dữ liệu cũ (stale)**: cache tạo nguy cơ trả kết quả không còn đúng sau
  khi Product thay đổi. Đây là lý do cache invalidation (Bài 85) là *bắt
  buộc*, không phải tùy chọn — xem `ProductsCacheService` (generation-based
  invalidation, không dùng `KEYS`/`SCAN` trên request path).
- **TTL không thay thế invalidation**: TTL (`PRODUCT_SEARCH_CACHE_TTL_SECONDS`,
  `PRODUCT_FEATURED_CACHE_TTL_SECONDS`) chỉ là giới hạn *tối đa* thời gian
  một entry có thể sống sót nếu invalidation vì lý do nào đó không chạy
  (ví dụ Redis lỗi đúng lúc ghi). Nó là lưới an toàn cuối cùng, không phải
  cơ chế chính.
- **Redis không phải PostgreSQL**: PostgreSQL luôn là nguồn dữ liệu chuẩn
  (source of truth). Cache chỉ là bản sao có thời hạn của một *phần* kết
  quả truy vấn.
- **Redis có thể lỗi**: một request search/featured public không được phép
  trả lỗi chỉ vì Redis không khả dụng. `ProductsCacheService` bọc mọi lệnh
  Redis trong try/catch — GET lỗi coi như cache miss (rơi về PostgreSQL),
  SET lỗi bị bỏ qua (kết quả vẫn được trả về, chỉ là không được cache).

## Phạm vi

Bài 83 chỉ là phân tích/quyết định thiết kế — không có code. Việc triển
khai cụ thể nằm ở Bài 84 (`ProductsCacheService`, cache-aside cho search),
Bài 85 (invalidation), và Bài 86 (cache cho featured với TTL dài hơn).
