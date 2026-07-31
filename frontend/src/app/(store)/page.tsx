import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { commerceRepository } from "@/lib/data/commerce-repository";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ServicePromises } from "@/components/layout/site-footer";
import { ProductGrid } from "@/components/commerce/product-grid";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const [products, categories] = await Promise.all([commerceRepository.getProducts(), commerceRepository.getCategories()]);
  const featured = products.filter((product) => product.featured).slice(0, 4);
  const newest = products.filter((product) => product.isNew).slice(0, 4);
  return (
    <>
      <section className="py-5 sm:py-7">
        <Container>
          <div className="relative min-h-[560px] overflow-hidden rounded-2xl border bg-card sm:min-h-[520px] lg:min-h-[600px]">
            <Image src="/images/hero-commerce.png" alt="Bộ sưu tập thiết bị công nghệ Cobalt Market" fill priority sizes="(max-width: 1400px) 100vw, 1400px" className="object-cover object-[62%_center] dark:brightness-[0.72]" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklch,var(--card)_98%,transparent)_0%,color-mix(in_oklch,var(--card)_88%,transparent)_37%,transparent_67%)]" />
            <div className="relative z-10 flex min-h-[560px] max-w-xl flex-col justify-center px-6 py-16 sm:min-h-[520px] sm:px-10 lg:min-h-[600px] lg:px-16">
              <p className="text-sm font-semibold text-primary">Bộ sưu tập mới</p>
              <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-5xl lg:text-6xl">Thiết kế tốt cho nhịp sống hiện đại.</h1>
              <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">Từng sản phẩm được chọn lọc dựa trên chất lượng, công năng và trải nghiệm sử dụng lâu dài.</p>
              <div className="mt-8 flex flex-wrap gap-3"><Link href="/products" className={cn(buttonVariants({ size: "lg" }), "h-12 px-5")}>Khám phá sản phẩm<ArrowRight aria-hidden="true" /></Link><Link href="/products?sort=newest" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 bg-card/85 px-5")}>Hàng mới về</Link></div>
            </div>
          </div>
        </Container>
      </section>

      <Section className="pt-8">
        <div className="mb-7"><h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Mua theo nhu cầu</h2><p className="mt-2 text-muted-foreground">Tìm đúng nhóm sản phẩm cho công việc, di chuyển và giải trí.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{categories.map((category, index) => <Link key={category.id} href={`/products?category=${category.slug}`} className={cn("group rounded-2xl border bg-card p-5 transition-colors hover:border-primary/45 hover:bg-accent/45", index === 0 ? "lg:col-span-2 lg:row-span-2 lg:min-h-64" : "lg:col-span-2")}><div className="flex h-full flex-col justify-between gap-8"><div><h3 className={cn("font-semibold tracking-[-0.02em]", index === 0 ? "text-2xl" : "text-lg")}>{category.name}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{category.description}</p></div><span className="flex items-center gap-2 text-sm font-medium text-primary">{category.productCount} sản phẩm<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span></div></Link>)}</div>
      </Section>

      <Section className="bg-card/55">
        <div className="mb-8 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Sản phẩm nổi bật</h2><p className="mt-2 text-muted-foreground">Những lựa chọn được quan tâm nhiều trong tuần.</p></div><Link href="/products" className="hidden text-sm font-semibold text-primary sm:block">Xem tất cả</Link></div>
        <ProductGrid products={featured} />
      </Section>

      <Section>
        <div className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14"><h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Công nghệ vừa đủ, trải nghiệm tốt hơn.</h2><p className="mt-4 max-w-lg leading-7 text-muted-foreground">Flow S2 tập trung vào sức khỏe, thời lượng pin và khả năng hiển thị thông tin nhanh, không thêm những tính năng gây xao nhãng.</p><Link href="/products/dong-ho-flow-s2" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-7 w-fit")}>Xem Flow S2<ArrowRight aria-hidden="true" /></Link></div>
          <div className="relative min-h-80 bg-muted lg:min-h-[500px]"><Image src="/images/smartwatch-silver.png" alt="Đồng hồ thông minh Flow S2 màu bạc" fill sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" /></div>
        </div>
      </Section>

      <Section className="pt-4">
        <div className="mb-8"><h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Mới về</h2><p className="mt-2 text-muted-foreground">Thiết kế mới dành cho không gian sống và thói quen hằng ngày.</p></div>
        <ProductGrid products={newest} />
      </Section>

      <Section className="pb-8">
        <div className="rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10"><h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Thương hiệu được tuyển chọn</h2><div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-primary-foreground/20 sm:grid-cols-5">{["Auralab", "Morrow", "Kanso", "Ordinary", "Loom"].map((brand) => <div key={brand} className="grid min-h-24 place-items-center bg-primary px-4 text-lg font-semibold tracking-[-0.03em]">{brand}</div>)}</div></div>
      </Section>
      <Container><ServicePromises /></Container>
    </>
  );
}
