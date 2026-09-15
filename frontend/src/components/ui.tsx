/** Shared UI primitives — one visual language across both themes. */

import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs uppercase tracking-[0.25em] text-faint">{children}</p>;
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
      className={`w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-contrast shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto ${className}`}
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
      className={`w-full rounded-lg border border-line2 bg-surface px-5 py-2.5 font-mono text-xs text-muted transition hover:border-accent/40 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto ${className}`}
    >
      {children}
    </button>
  );
}

const TONES = {
  error: "bg-stop/10 text-stop ring-stop/25",
  warning: "bg-warn/10 text-warn ring-warn/25",
  success: "bg-ok/10 text-ok ring-ok/25",
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
