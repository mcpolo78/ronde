import { STATUS_LABELS, type InterventionStatus, type Priority } from "@ronde/domain";
import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonClasses = (variant: ButtonVariant = "secondary", size: "sm" | "md" = "md") =>
  clsx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
    variant === "primary" && "bg-brand text-white hover:bg-brand-strong dark:text-zinc-950",
    variant === "secondary" && "border border-border bg-surface hover:bg-surface-muted",
    variant === "ghost" && "hover:bg-surface-muted",
    variant === "danger" && "border border-danger/40 bg-danger-soft text-danger hover:border-danger",
  );

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <button className={clsx(buttonClasses(variant, size), className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <Link className={clsx(buttonClasses(variant, size), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={clsx("rounded-xl border border-border bg-surface p-5 shadow-xs", className)}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

const STATUS_STYLE: Record<InterventionStatus, string> = {
  PLANNED: "text-[var(--status-planned)] bg-[var(--status-planned-bg)]",
  EN_ROUTE: "text-[var(--status-en-route)] bg-[var(--status-en-route-bg)]",
  ON_SITE: "text-[var(--status-on-site)] bg-[var(--status-on-site-bg)]",
  DONE: "text-[var(--status-done)] bg-[var(--status-done-bg)]",
  CANCELLED: "text-[var(--status-cancelled)] bg-[var(--status-cancelled-bg)]",
};

export function StatusBadge({ status, className }: { status: InterventionStatus; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLE[status],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "NORMAL" || priority === "LOW") {
    return <span className="text-xs text-muted">{PRIORITY_LABELS[priority]}</span>;
  }
  return (
    <span
      className={clsx(
        "rounded px-1.5 py-0.5 text-xs font-semibold",
        priority === "URGENT" ? "bg-danger text-white dark:text-zinc-950" : "bg-danger-soft text-danger",
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-lg bg-surface-muted", className)} />;
}

export const inputClasses =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm placeholder:text-muted " +
  "aria-[invalid=true]:border-danger";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
