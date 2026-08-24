export default function AdminReportsLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="panel rounded-[36px] p-6 sm:p-8 lg:p-10">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400"
              style={{ animationDelay: "120ms" }}
            />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300"
              style={{ animationDelay: "240ms" }}
            />
          </span>
          <span>Loading reports...</span>
        </div>
      </section>
    </main>
  );
}
