type StatusMessageProps = {
  error?: string;
  message?: string;
};

export function StatusMessage({ error, message }: StatusMessageProps) {
  if (!error && !message) {
    return null;
  }

  return (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm font-semibold ${
        error
          ? "bg-red-50 text-red-700"
          : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
      }`}
    >
      {error ?? message}
    </p>
  );
}
