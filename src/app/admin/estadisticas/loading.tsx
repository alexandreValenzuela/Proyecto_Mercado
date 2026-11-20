export default function StatisticsLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <div className="h-9 w-64 animate-pulse rounded-xl bg-surface-muted" />
      <div className="mt-6 h-24 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
      <div className="mt-6 h-80 animate-pulse rounded-2xl bg-surface-muted" />
    </main>
  );
}
