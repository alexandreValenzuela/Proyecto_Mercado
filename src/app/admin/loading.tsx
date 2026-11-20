export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="h-8 w-64 animate-pulse rounded-xl bg-surface-muted" />
      <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface-muted" />
    </div>
  );
}
