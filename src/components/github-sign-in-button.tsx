"use client";

import { useState } from "react";

import { safeNextPath } from "@/lib/auth-navigation";

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

    try {
      const supabase = createClient();
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", safeNextPath(nextPath));
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (signInError) {
        throw signInError;
      }
    } catch {
      setError(
        "GitHub 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        disabled={!configured || loading}
        onClick={signIn}
        className="btn btn-primary min-h-12 w-full"
      >
        {loading ? "GitHub로 이동 중..." : "GitHub로 계속하기"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
