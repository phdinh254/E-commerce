import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-2">
      <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-14"><Link href="/" className="flex w-fit items-center gap-2 rounded-lg"><span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">C</span><span className="font-semibold">Cobalt Market</span></Link><div className="my-auto flex justify-center py-14">{children}</div><p className="text-xs text-muted-foreground">B?ng vi?c ti?p t?c, b?n ??ng ? v?i ?i?u kho?n s? d?ng v? ch?nh s?ch b?o m?t.</p></section>
      <section className="relative hidden overflow-hidden bg-muted lg:block"><Image src="/images/hero-commerce.png" alt="S?n ph?m n?i b?t c?a Cobalt Market" fill priority sizes="50vw" className="object-cover object-center dark:brightness-[0.72]" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-12 pt-36 text-white"><p className="max-w-md text-3xl font-semibold leading-tight tracking-[-0.04em]">S?n ph?m ???c ch?n k?. Tr?i nghi?m ???c l?m r?.</p></div></section>
    </main>
  );
}
