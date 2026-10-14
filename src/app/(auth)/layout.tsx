import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-12">
      <Link href="/" className="text-lg font-semibold">
        Finance Dashboard
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
