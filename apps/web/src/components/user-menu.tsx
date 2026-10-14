import { getViewer } from "@/lib/viewer";
import { SignOutButton } from "./sign-out-button";

export async function UserMenu() {
  const viewer = await getViewer();
  const initials = viewer.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong"
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{viewer.name}</p>
        <p className="truncate text-xs text-muted">{viewer.email}</p>
      </div>
      <SignOutButton />
    </div>
  );
}
