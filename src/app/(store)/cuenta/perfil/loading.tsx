export default function ProfileLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-surface-muted" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="h-64 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
      </div>
    </main>
  );
}
