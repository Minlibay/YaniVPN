"use client";

import { useState } from "react";

export function CopyField({ value, mono }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <code
        className={`flex-1 overflow-x-auto whitespace-pre rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 rounded-lg border border-surface-border px-3 text-xs text-slate-300 hover:bg-white/5"
      >
        {copied ? "Скопировано" : "Копировать"}
      </button>
    </div>
  );
}
