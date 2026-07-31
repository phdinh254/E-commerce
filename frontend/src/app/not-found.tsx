import { StatePanel } from "@/components/feedback/state-panel";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-24 sm:px-6 lg:px-8">
      <StatePanel
        kind="notFound"
        title="Kh?ng t?m th?y trang"
        description="???ng d?n n?y c? th? ?? thay ??i ho?c n?i dung kh?ng c?n t?n t?i."
        actionLabel="V? trang ch?"
        actionHref="/"
      />
    </main>
  );
}
