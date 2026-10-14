import { useColorScheme } from "react-native";
import type { InterventionStatus } from "@ronde/domain";

/** Mêmes tokens sémantiques que le back-office (apps/web/src/app/globals.css). */
const light = {
  background: "#f7f7f8",
  surface: "#ffffff",
  surfaceMuted: "#f1f1f3",
  border: "#e3e3e8",
  foreground: "#18181b",
  muted: "#5f5f6b",
  brand: "#0f766e",
  brandForeground: "#ffffff",
  brandSoft: "#e6f4f2",
  danger: "#b42318",
  dangerSoft: "#fdecea",
  warning: "#8a4b00",
  warningSoft: "#fdf0d8",
  status: {
    PLANNED: { fg: "#3f3f46", bg: "#ececef" },
    EN_ROUTE: { fg: "#8a4b00", bg: "#fdf0d8" },
    ON_SITE: { fg: "#1d4ed8", bg: "#e3ebfd" },
    DONE: { fg: "#166534", bg: "#e2f4e7" },
    CANCELLED: { fg: "#9f1239", bg: "#fce7ec" },
  } satisfies Record<InterventionStatus, { fg: string; bg: string }>,
};

const dark: typeof light = {
  background: "#0c0c0e",
  surface: "#151518",
  surfaceMuted: "#1d1d21",
  border: "#2b2b31",
  foreground: "#f1f1f3",
  muted: "#a1a1ab",
  brand: "#2dd4bf",
  brandForeground: "#0c0c0e",
  brandSoft: "#0f2e2b",
  danger: "#f97066",
  dangerSoft: "#3a1513",
  warning: "#fbbf24",
  warningSoft: "#3a2a0b",
  status: {
    PLANNED: { fg: "#d4d4d8", bg: "#27272a" },
    EN_ROUTE: { fg: "#fbbf24", bg: "#3a2a0b" },
    ON_SITE: { fg: "#93b4fd", bg: "#1a2648" },
    DONE: { fg: "#86efac", bg: "#11301d" },
    CANCELLED: { fg: "#fda4af", bg: "#3b1320" },
  },
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

/** Zones tactiles généreuses : l'app est utilisée debout, parfois avec des gants. */
export const TOUCH = 54;
export const RADIUS = 12;
