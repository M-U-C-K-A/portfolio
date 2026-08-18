"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="label border border-ink px-4 py-3 text-ink transition-colors hover:bg-ink hover:text-paper"
    >
      {label}
    </button>
  );
}
