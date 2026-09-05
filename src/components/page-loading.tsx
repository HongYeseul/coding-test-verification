export function PageLoading() {
  return (
    <main
      className="min-h-screen bg-[var(--background)] px-5 py-6 sm:px-8 lg:px-12"
      aria-busy="true"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <p role="status" className="font-semibold text-[var(--muted)]">
          화면을 불러오는 중입니다…
        </p>
        <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
          <div className="h-36 rounded-3xl bg-[var(--surface-subtle)]" />
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="h-64 rounded-3xl bg-[var(--surface-subtle)]" />
            <div className="h-64 rounded-3xl bg-[var(--surface-subtle)]" />
          </div>
        </div>
      </div>
    </main>
  );
}
