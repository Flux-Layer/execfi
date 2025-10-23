'use client';

type SeedRowProps = {
  label: string;
  value: string;
};

export function SeedRow({ label, value }: SeedRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="break-all rounded-xl bg-slate-900/80 px-2 py-1 text-[11px] font-mono text-slate-200">
        {value || '—'}
      </p>
    </div>
  );
}
