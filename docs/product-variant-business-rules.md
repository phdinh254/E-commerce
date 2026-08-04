# Business requirements — Product Variant (Chương 10, Bài 87)

## Khái niệm

**Product** (đã có từ Chương 9) là sản phẩm cha: tên, slug, SKU cha, mô tả,
category, ảnh đại diện, `price` (giá cơ sở), trạng thái, `isFeatured`.
Chương 10 **không đổi ý nghĩa** của bất kỳ field nào trên `Product` — đặc
biệt `Product.price` vẫn là giá hiển thị mặc định của Chương 9, không bị
thay bằng "giá thấp nhất trong các variant" hay bất kỳ giá trị suy diễn nào.

**ProductOption** là một chiều phân loại dùng để tạo tổ hợp biến thể, ví
dụ "Màu sắc", "Kích thước". Option luôn thuộc đúng một Product; option của
Product A không dùng được cho Product B (không có bảng option dùng chung
toàn hệ thống trong Chương 10).

**ProductOptionValue** là một giá trị cụ thể của một Option, ví dụ Option
"Màu sắc" có các value "Đỏ", "Xanh", "Đen". Value luôn thuộc đúng một
Option.

**ProductVariant** là đơn vị có thể bán được, được tạo từ **đúng một
value của mỗi Option** thuộc Product đó. Ví dụ Product có 2 option (Màu
sắc, Kích thước) thì mỗi variant phải chọn đúng 1 màu + đúng 1 size — không
được thiếu, không được chọn 2 màu, không được dùng màu của Product khác.

**ProductAttribute** là thông số mô tả (Xuất xứ, Chất liệu, Bảo hành...),
**không** tham gia tạo tổ hợp SKU và **không** phải ProductOption. Thêm/sửa
attribute không bao giờ tạo variant mới, không ảnh hưởng combination key.

## Product đơn giản và Product có variant

Chương 10 không bắt buộc mọi Product phải có variant. Một Product chưa có
option/variant nào vẫn bán được nguyên trạng theo `Product.price` (hành vi
Chương 9, không đổi). Product có option nhưng chưa tạo variant nào cũng là
trạng thái hợp lệ (ví dụ admin đang cấu hình dở).

## Giá và tồn kho

- `ProductVariant.price` là giá cụ thể tại **thời điểm tạo variant**. Nếu
  client không truyền `price` khi tạo variant, backend lấy
  `Product.price` hiện tại làm giá khởi tạo — đây là hành vi **snapshot
  một lần**, không phải liên kết sống: sau khi variant đã tồn tại, việc
  sửa `Product.price` **không** âm thầm cập nhật giá các variant đã có.
- `ProductVariant.stock` là số lượng tồn kho hiện tại của riêng variant đó
  — một con số quản trị đặt lại (`PATCH` là thao tác "set tuyệt đối", không
  phải delta/reservation). Cart, Order, giữ/nhả tồn kho khi đặt hàng
  **không** thuộc Chương 10 — đó là Inventory/Cart/Order ở chương sau.
- Giá và tồn kho không bao giờ âm — được validate cả ở tầng ứng dụng lẫn
  `CHECK` constraint trong PostgreSQL.

## SKU

- `Product.sku` (Chương 9) là mã sản phẩm cha, không đổi.
- `ProductVariant.sku` unique **trong toàn bộ bảng `product_variants`**
  (không phải chỉ trong phạm vi một Product), chuẩn hóa uppercase + trim ở
  backend, giống policy `Product.sku`.
- **Không** dùng chung namespace unique với `Product.sku` — nghĩa là một
  giá trị có thể tồn tại đồng thời là `Product.sku` của sản phẩm này và
  `ProductVariant.sku` của một variant thuộc sản phẩm khác mà database
  không cấm. Đây là giới hạn được chấp nhận có chủ đích: gộp namespace đòi
  hỏi một shared-registry chống race (ví dụ một bảng SKU dùng chung với
  unique constraint) — không có yêu cầu rõ ràng nào trong Chương 10 đòi
  hỏi điều này, và refactor `Product.sku` của Chương 9 sang cơ chế đó là
  ngoài phạm vi khi chưa có bằng chứng cần thiết.
- Ràng buộc duy nhất có thật ở tầng ứng dụng: một variant **không được**
  trùng SKU với chính `Product.sku` của sản phẩm cha nó (kiểm tra service
  trước khi insert, ngoài unique constraint DB).

## Tính duy nhất tổ hợp (combination uniqueness)

Mỗi tổ hợp (option → value) chỉ được tạo variant **một lần** cho mỗi
Product. Backend tự sinh `combinationKey` canonical từ danh sách
`(optionId, optionValueId)` đã sort ổn định theo `optionId` — client gửi
`optionValueIds` theo thứ tự bất kỳ vẫn ra cùng key, và bị chặn trùng bởi
unique constraint `(product_id, combination_key)` ở database, không chỉ
kiểm tra bằng SELECT.

## Public visibility

- Public chỉ thấy option/value/variant/attribute của Product `isActive=true`
  và chưa `deletedAt` (giữ nguyên policy Product Chương 9).
- Public chỉ thấy `ProductVariant.isActive=true`.
- Public chỉ thấy `ProductAttribute.isVisible=true` và chưa bị xóa mềm.
- Admin (ADMIN role) được thao tác option/variant/attribute của Product
  **inactive** (đang cấu hình trước khi bật bán), nhưng **không** được thao
  tác Product đã **soft-delete** — thao tác trên Product đã xóa luôn trả 404,
  kể cả với ADMIN, vì Product đã xóa được coi là không còn tồn tại theo góc
  nhìn nghiệp vụ.

## Chính sách vòng đời sau khi đã có variant (an toàn theo mặc định)

Đây là quyết định thiết kế của Chương 10, không suy ra từ code nào có sẵn
trước đó (vì Variant hoàn toàn chưa tồn tại trước Chương 10):

- **Cho phép** thêm value mới vào option đã có (không phá vỡ variant hiện
  tại — variant cũ vẫn hợp lệ, chỉ đơn giản là chưa có variant nào dùng
  value mới đó).
- **Không cho phép** thêm option mới cho Product **đã có ít nhất một
  variant** — nếu cho phép, mọi variant hiện tại sẽ ngay lập tức trở thành
  "thiếu option" theo định nghĩa combination hợp lệ, và Chương 10 không
  xây cơ chế migrate/backfill tổ hợp cho variant cũ. Bị chặn ở tầng service
  (409 Conflict), có test xác nhận.
- **Không cho phép** xóa option hoặc option value đang được ít nhất một
  variant sử dụng — Chương 10 **không cung cấp** endpoint xóa
  option/option value (chỉ có tạo và thêm value), nên rủi ro này chủ yếu
  được phòng ngừa bằng thiết kế API (không có route để xóa), củng cố thêm
  bằng `FOREIGN KEY ... ON DELETE RESTRICT` từ join table tới
  `product_option_values` để chặn cả những đường xóa ngoài API (migration
  thủ công, thao tác trực tiếp DB).
- **Không tự động sinh Cartesian product** — variant chỉ được tạo khi admin
  gửi yêu cầu rõ ràng với danh sách `optionValueIds` cụ thể (Bài 93).

## Audit log

Mọi thay đổi `price`/`stock` của variant tạo bản ghi audit bất biến
(`product_variant_change_logs`) trong **cùng transaction** với việc ghi đè
giá trị mới — không có endpoint sửa/xóa audit qua API công khai hay admin.
Actor luôn lấy từ JWT đã xác thực (`request.user`), không bao giờ tin
`actorUserId` do client gửi trong body. Xem chi tiết ở
Bài 89/96/97 trong báo cáo Chương 10.

## Quan hệ với cache Chương 9

`ProductsCacheService` (search/featured cache) chỉ cache field `Product`
gốc — không chứa option/variant/attribute. Chương 10 **không** thay đổi
schema cache, **không** thay `Product.price` hiển thị trong cache bằng giá
variant, và vì vậy **không cần invalidation Product cache** khi
option/variant/attribute thay đổi — các entity mới hoàn toàn nằm ngoài
payload đã cache. Endpoint option/variant/attribute là endpoint mới, chưa
được cache trong Chương 10 (chưa có bằng chứng cần thiết — có thể bổ sung ở
chương sau nếu đo được nhu cầu thật).
