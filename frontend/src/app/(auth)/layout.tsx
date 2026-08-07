import Image from "next/image";
import Link from "next/link";
import { SenLogo } from "@/components/layout/sen-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-2">
      <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-14">
        <Link href="/" className="flex w-fit items-center gap-2 rounded-lg">
          <SenLogo size={36} />
          <span className="font-semibold">SEN</span>
        </Link>
        <div className="my-auto flex justify-center py-14">{children}</div>
        <p className="text-xs text-muted-foreground">
          Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật.
        </p>
      </section>
      <section className="relative hidden overflow-hidden bg-muted lg:block">
        <Image
          src="/images/hero-commerce.png"
          alt="Sản phẩm nổi bật tại SEN"
          fill
          priority
          sizes="50vw"
          className="object-cover object-center dark:brightness-[0.72]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-12 pt-36 text-white">
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-[-0.04em]">
            Sản phẩm được tuyển chọn kỹ lưỡng, trải nghiệm mua sắm được thiết kế rõ ràng.
          </p>
        </div>
      </section>
    </main>
  );
}
