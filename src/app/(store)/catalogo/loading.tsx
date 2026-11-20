export default function CatalogLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-surface-muted" />
      <div className="mt-8 h-32 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="mt-8 grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
          <div key={index} className="h-72 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
    </main>
  );
}
