"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          router.replace("/login");
          router.refresh();
        })
      }
      className="rounded-md p-2 text-muted hover:bg-surface-muted hover:text-foreground"
      aria-label="Se déconnecter"
      title="Se déconnecter"
    >
      <LogOut aria-hidden className="size-4" />
    </button>
  );
}
