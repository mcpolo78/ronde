"use client";

import clsx from "clsx";
import { CalendarRange, LayoutDashboard, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/planning", label: "Planning", icon: CalendarRange },
  { href: "/interventions", label: "Interventions", icon: ListChecks },
  { href: "/interventions/new", label: "Nouvelle intervention", icon: Plus },
] as const;

export function MainNav() {
  return <NavList pathname={usePathname()} />;
}

/** Version sans lien actif : rendue dans le shell statique, avant que l'URL soit connue. */
export function MainNavFallback() {
  return <NavList pathname={null} />;
}

function NavList({ pathname }: { pathname: string | null }) {
  const isActive = (href: string) =>
    pathname === null
      ? false
      : href === "/"
      ? pathname === "/"
      : href === "/interventions"
        ? pathname.startsWith("/interventions") && pathname !== "/interventions/new"
        : pathname.startsWith(href);

  return (
    <nav aria-label="Navigation principale">
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm whitespace-nowrap transition-colors",
                isActive(href)
                  ? "bg-brand-soft font-medium text-brand-strong"
                  : "text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
