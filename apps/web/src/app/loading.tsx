export default function Loading() {
  return (
    <div className="fade-up space-y-6 py-8">
      <div className="skeleton h-12 w-2/3 max-w-md" />
      <div className="skeleton h-4 w-1/2 max-w-sm" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-44" />
        ))}
      </div>
    </div>
  );
}
