import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/container";

interface SectionProps extends React.ComponentProps<"section"> {
  containerClassName?: string;
}

export function Section({ className, containerClassName, children, ...props }: SectionProps) {
  return (
    <section className={cn("py-14 sm:py-18 lg:py-22", className)} {...props}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
