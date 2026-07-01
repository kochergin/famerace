export function FormError({ error }: { error?: string | string[] }) {
  const message = Array.isArray(error) ? error[0] : error;
  if (!message) return null;
  return (
    <p className="rounded border border-pink/40 bg-pink/10 px-3 py-2 text-sm text-pink">{message}</p>
  );
}
