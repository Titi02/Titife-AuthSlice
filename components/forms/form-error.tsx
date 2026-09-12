export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      className="text-sm"
      style={{ color: "var(--color-error-color)" }}
      role="alert"
    >
      {message}
    </p>
  );
}
