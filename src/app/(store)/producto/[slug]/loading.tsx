export default function ProductLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-2xl bg-surface-muted" />
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded-xl bg-surface-muted" />
          <div className="h-10 w-1/3 animate-pulse rounded-xl bg-surface-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-surface-muted" />
        </div>
      </div>
    </main>
  );
}
