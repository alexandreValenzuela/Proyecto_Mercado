export default function AboutLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="h-10 w-56 animate-pulse rounded-xl bg-surface-muted" />
      <div className="mt-6 h-24 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {[0, 1].map((index) => (
          <div key={index} className="h-40 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
    </main>
  );
}
