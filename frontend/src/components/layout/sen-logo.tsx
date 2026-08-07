import { cn } from "@/lib/utils";

interface SenLogoProps extends React.ComponentPropsWithoutRef<"svg"> {
  size?: number | string;
}

export function SenLogo({ size = 36, className, ...props }: SenLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("select-none", className)}
      aria-hidden="true"
      {...props}
    >
      {/* Back curve (Forest Green) */}
      <path
        d="M 48 18 C 50 18 64 30 62 50 C 60 70 30 68 32 88 C 33 94 48 95 48 95"
        stroke="#2d7748"
        strokeWidth="16"
        strokeLinecap="round"
      />
      {/* Front curve (Olive Green) */}
      <path
        d="M 54 8 C 54 8 32 22 34 42 C 36 62 58 58 56 76 C 55 82 48 84 48 84"
        stroke="#a6b36d"
        strokeWidth="16"
        strokeLinecap="round"
      />
    </svg>
  );
}
