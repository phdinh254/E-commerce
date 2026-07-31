import Link from "next/link";
import { AlertCircle, Inbox, LockKeyhole, SearchX, WifiOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const iconMap = { empty: Inbox, error: AlertCircle, offline: WifiOff, forbidden: LockKeyhole, notFound: SearchX };
type StateKind = keyof typeof iconMap;

export function StatePanel({ kind = "empty", title, description, actionLabel, actionHref, onRetry }: { kind?: StateKind; title: string; description: string; actionLabel?: string; actionHref?: string; onRetry?: () => void }) {
  const Icon = iconMap[kind];
  return (
    <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon aria-hidden="true" /></span><h2 className="mt-5 text-xl font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>{actionLabel && actionHref ? <Link href={actionHref} className={cn(buttonVariants({ size: "lg" }), "mt-6")}>{actionLabel}</Link> : null}{actionLabel && onRetry ? <button type="button" className={cn(buttonVariants({ size: "lg" }), "mt-6")} onClick={onRetry}>{actionLabel}</button> : null}</div>
    </div>
  );
}
