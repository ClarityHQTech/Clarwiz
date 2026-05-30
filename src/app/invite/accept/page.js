"use client";

import { ui } from "@/lib/brandUi";
import { useEffect, useState, Suspense } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function InviteAcceptContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [message, setMessage] = useState("Accepting your invitation…");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError("Missing invitation token.");
      return;
    }
    if (status === "loading") return;
    if (status === "unauthenticated") {
      setMessage("Sign in with Google to accept this invitation.");
      return;
    }

    const accept = async () => {
      try {
        const res = await fetch("/api/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to accept invitation");
          return;
        }
        router.replace("/dashboard");
      } catch {
        setError("Something went wrong. Please try again.");
      }
    };

    accept();
  }, [status, token, router]);

  if (!token) {
    return (
      <div className={`${ui.page} min-h-screen flex items-center justify-center p-6`}>
        <p className="text-red-600">Invalid invitation link.</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className={`${ui.page} min-h-screen flex flex-col items-center justify-center gap-4 p-6`}>
        <h1 className={ui.titleSm}>Workspace invitation</h1>
        <p className="text-brand-stone text-center max-w-md">{message}</p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: `/invite/accept?token=${token}` })}
          className={ui.btnPrimary}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className={`${ui.page} min-h-screen flex flex-col items-center justify-center gap-2 p-6`}>
      {error ? (
        <p className="text-red-600 text-center max-w-md">{error}</p>
      ) : (
        <p className="text-brand-stone">{message}</p>
      )}
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className={`${ui.page} min-h-screen flex items-center justify-center text-brand-stone`}>Loading…</div>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  );
}
