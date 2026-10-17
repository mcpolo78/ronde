"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <h2 className="text-lg font-semibold">Le service démarre</h2>
      <p className="mt-2 text-sm text-neutral-600">
        L&apos;API met parfois une minute à se réveiller après une période d&apos;inactivité. Réessayez dans un instant.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Réessayer
      </button>
    </div>
  );
}
