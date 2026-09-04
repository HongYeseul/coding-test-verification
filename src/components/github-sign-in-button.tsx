"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type GithubSignInButtonProps = {
  configured: boolean;
  nextPath?: string;
};

export function GithubSignInButton({
  configured,
  nextPath = "/dashboard",
}: GithubSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    if (!configured || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", nextPath);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (signInError) {
      setError("GitHub 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.");
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        disabled={!configured || loading}
        onClick={signIn}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--ink)] px-5 py-3 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#253148] disabled:cursor-not-allowed disabled:bg-[#9ca5b4] disabled:hover:translate-y-0"
      >
        {loading ? "GitHub로 이동 중..." : "GitHub로 계속하기"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
