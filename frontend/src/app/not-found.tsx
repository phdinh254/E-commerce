import { StatePanel } from "@/components/feedback/state-panel";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-24 sm:px-6 lg:px-8">
      <StatePanel
        kind="notFound"
        title="Không tìm thấy trang"
        description="Đường dẫn này có thể đã thay đổi hoặc nội dung không còn tồn tại."
        actionLabel="Về trang chủ"
        actionHref="/"
      />
    </main>
  );
}
