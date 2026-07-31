import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingDisplay({ rating, count, compact = false, className }: { rating: number; count?: number; compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-sm", className)} aria-label={`${rating} trên 5 sao${count ? `, ${count} đánh giá` : ""}`}>
      <Star className="size-4 fill-warning text-warning" aria-hidden="true" />
      <span className="font-medium">{rating.toFixed(1)}</span>
      {!compact && count !== undefined ? <span className="text-muted-foreground">({count} đánh giá)</span> : null}
    </div>
  );
}
