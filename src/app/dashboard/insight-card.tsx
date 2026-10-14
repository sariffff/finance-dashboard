import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDefaultInsightWriter, getMonthlyInsight } from "@/lib/insights";

/**
 * The month's written summary. Rendered in its own Suspense boundary: a
 * first visit may wait on the AI, and the rest of the dashboard shouldn't.
 */
export async function InsightCard({ userId, month }: { userId: string; month: string }) {
  const insight = await getMonthlyInsight(userId, month, getDefaultInsightWriter());
  if (!insight) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>สรุปเดือนนี้</CardTitle>
        <CardDescription>
          {insight.source === "ai"
            ? "เขียนโดย AI จากยอดสรุป — ตัวเลขทุกตัวคำนวณจากข้อมูลจริง"
            : "สรุปอัตโนมัติจากยอดรวมของเดือน"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid list-disc gap-1.5 pl-5 text-sm leading-relaxed">
          {insight.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function InsightCardSkeleton() {
  return (
    <div className="grid gap-3 rounded-xl border p-6" aria-busy="true" aria-label="กำลังสรุป">
      <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
    </div>
  );
}
