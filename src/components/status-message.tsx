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
      className={`rounded-lg bg-soft px-4 py-3 text-[13px] ${
        error ? "text-danger" : "text-brand"
      }`}
    >
      {error ?? message}
    </p>
  );
}
