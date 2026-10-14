"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Label } from "@/components/ui/label";

export function MonthPicker({
  months,
  selected,
}: {
  months: { value: string; label: string }[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(month: string) {
    const params = new URLSearchParams(searchParams);
    params.set("month", month);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params}`));
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="month" className="shrink-0">
        เดือน
      </Label>
      <select
        id="month"
        value={selected}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {months.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </select>
    </div>
  );
}
