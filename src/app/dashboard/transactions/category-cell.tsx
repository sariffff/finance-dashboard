"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createRuleAction, setCategoryAction } from "./actions";

type CategoryOption = { id: string; name: string };

const sourceLabels: Record<string, string> = {
  rule: "กฎ",
  ai: "AI",
  user: "คุณเลือก",
};

export function CategoryCell({
  transactionId,
  categoryId,
  categorySource,
  options,
  suggestedPattern,
}: {
  transactionId: string;
  categoryId: string | null;
  categorySource: string | null;
  options: CategoryOption[];
  /** Pre-filled text for "use this for every transaction containing …". */
  suggestedPattern: string;
}) {
  const [pending, startTransition] = useTransition();
  const [askRule, setAskRule] = useState<string | null>(null);
  const [pattern, setPattern] = useState(suggestedPattern);
  const [message, setMessage] = useState<string | null>(null);

  function onChange(nextCategoryId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await setCategoryAction(transactionId, nextCategoryId);
      if (result.ok) setAskRule(nextCategoryId);
      else setMessage(result.error);
    });
  }

  function saveRule() {
    if (!askRule) return;
    startTransition(async () => {
      const result = await createRuleAction(pattern, askRule);
      if (result.ok) {
        setAskRule(null);
        setMessage(result.updated > 0 ? `อัปเดตรายการอื่นอีก ${result.updated} รายการ` : "บันทึกกฎแล้ว");
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div className="grid min-w-48 gap-1.5">
      <div className="flex items-center gap-2">
        <select
          aria-label="หมวดหมู่"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          value={categoryId ?? ""}
          disabled={pending}
          onChange={(event) => onChange(event.target.value)}
        >
          {!categoryId && <option value="">ยังไม่จัดหมวด</option>}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        {categorySource && (
          <span className="shrink-0 text-xs text-muted-foreground">{sourceLabels[categorySource]}</span>
        )}
      </div>

      {askRule && (
        <div className="grid gap-2 rounded-lg border bg-muted/40 p-2 text-sm">
          <label htmlFor={`pattern-${transactionId}`}>ใช้หมวดนี้กับทุกรายการที่มีข้อความนี้ไหม?</label>
          <Input
            id={`pattern-${transactionId}`}
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={saveRule}>
              ใช้ทุกครั้ง
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setAskRule(null)}>
              เฉพาะรายการนี้
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
