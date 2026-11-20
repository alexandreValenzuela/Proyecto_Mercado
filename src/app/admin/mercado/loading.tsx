export default function MarketLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <div className="h-9 w-72 animate-pulse rounded-xl bg-surface-muted" />
      <div className="mt-6 h-20 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
      <div className="mt-6 h-48 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />
      </div>
    </main>
  );
}
