export default function StoreLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
      <div className="h-10 w-56 animate-pulse rounded-xl bg-surface-muted" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-72 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
    </main>
  );
}
