export function PageLoading() {
  return (
    <main
      className="mx-auto w-full max-w-[1024px] px-3 py-4 sm:px-8 sm:py-6"
      aria-busy="true"
    >
      <p role="status" className="text-[15px] text-sub">
        화면을 불러오는 중입니다…
      </p>
      <div
        aria-hidden="true"
        className="mt-5 space-y-6 motion-safe:animate-pulse"
      >
        <div className="h-16 rounded-xl bg-soft" />
        <div className="h-56 rounded-xl bg-soft" />
        <div className="h-64 rounded-xl bg-soft" />
      </div>
    </main>
  );
}
