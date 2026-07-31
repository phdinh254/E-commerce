import Link from "next/link";
import { Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { NewsletterForm } from "@/components/forms/newsletter-form";

const promises = [
  { icon: Truck, title: "Giao hàng toàn quốc", text: "Theo dõi rõ từng chặng" },
  { icon: RotateCcw, title: "Đổi trả 30 ngày", text: "Quy trình minh bạch" },
  { icon: ShieldCheck, title: "Thanh toán an toàn", text: "Xác nhận qua PayOS" },
  { icon: Headphones, title: "Hỗ trợ tận tâm", text: "Phản hồi trong giờ làm việc" },
];

export function ServicePromises() {
  return (
    <div className="grid border-y sm:grid-cols-2 lg:grid-cols-4">
      {promises.map(({ icon: Icon, title, text }, index) => (
        <div key={title} className={`flex gap-3 px-4 py-5 sm:px-6 ${index > 0 ? "lg:border-l" : ""}`}>
          <Icon className="mt-0.5 size-5 text-primary" aria-hidden="true" />
          <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{text}</p></div>
        </div>
      ))}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <Container className="py-12">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <p className="text-xl font-semibold tracking-[-0.03em]">Cobalt Market</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Chọn lọc thiết bị công nghệ và đồ dùng hiện đại, chú trọng trải nghiệm sử dụng lâu dài.</p>
            <div className="mt-6"><p className="mb-2 text-sm font-medium">Nhận tin sản phẩm mới</p><NewsletterForm /></div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div><p className="text-sm font-semibold">Mua sắm</p><div className="mt-4 grid gap-3 text-sm text-muted-foreground"><Link href="/products">Tất cả sản phẩm</Link><Link href="/search">Tìm kiếm</Link><Link href="/cart">Giỏ hàng</Link></div></div>
            <div><p className="text-sm font-semibold">Tài khoản</p><div className="mt-4 grid gap-3 text-sm text-muted-foreground"><Link href="/login">Đăng nhập</Link><Link href="/account/orders">Đơn hàng</Link><Link href="/account/addresses">Sổ địa chỉ</Link></div></div>
            <div><p className="text-sm font-semibold">Thông tin</p><div className="mt-4 grid gap-3 text-sm text-muted-foreground"><Link href="/products">Chính sách đổi trả</Link><Link href="/products">Chính sách bảo mật</Link><Link href="/admin">Quản trị</Link></div></div>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between"><p>© 2026 Cobalt Market. Bản quyền được bảo lưu.</p><p>Giá hiển thị đã bao gồm thuế theo quy định.</p></div>
      </Container>
    </footer>
  );
}
