import { Skeleton } from "@/components/ui/skeleton";

export function ProductGridSkeleton() {
  return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index}><Skeleton className="aspect-square rounded-2xl" /><Skeleton className="mt-4 h-4 w-1/3" /><Skeleton className="mt-2 h-5 w-4/5" /><Skeleton className="mt-3 h-6 w-1/2" /></div>)}</div>;
}

export function PageSkeleton() {
  return <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8"><Skeleton className="h-9 w-64" /><Skeleton className="mt-3 h-5 w-full max-w-xl" /><div className="mt-10"><ProductGridSkeleton /></div></div>;
}
