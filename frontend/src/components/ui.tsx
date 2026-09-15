/** Shared UI primitives — one consistent visual language across pages. */

import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-ink-600 bg-ink-900/70 ${className}`}>{children}</div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">{children}</p>;
}

export function PrimaryButton({
  onClick,
  disabled,
  children,
  className = "",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  onClick,
  disabled,
  children,
  className = "",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border border-ink-600 bg-ink-800 px-5 py-2.5 font-mono text-xs text-slate-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

const TONES = {
  error: "bg-rose-500/10 text-rose-300 ring-rose-400/20",
  warning: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  success: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
} as const;

export function Banner({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <p className={`rounded-lg px-4 py-3 text-xs leading-relaxed ring-1 ${TONES[tone]}`}>{children}</p>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
