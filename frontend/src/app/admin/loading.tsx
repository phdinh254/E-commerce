import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div aria-label="Đang tải dữ liệu" aria-busy="true">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-8 space-y-3 rounded-2xl border bg-card p-5">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
