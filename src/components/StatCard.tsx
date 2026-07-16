export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
