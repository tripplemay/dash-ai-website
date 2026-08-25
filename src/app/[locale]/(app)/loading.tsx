export default function AppLoading() {
  return (
    <div className="w-full px-5 py-7 sm:px-7 lg:py-10" aria-busy="true">
      <div className="animate-pulse space-y-8" aria-hidden="true">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="h-3 w-44 rounded bg-coral-100" />
            <div className="h-10 w-64 max-w-[80vw] rounded bg-indigo-100" />
            <div className="h-4 w-[min(640px,85vw)] rounded bg-neutral-100" />
            <div className="h-3 w-40 rounded bg-neutral-100" />
          </div>
          <div className="h-10 w-44 rounded-md bg-indigo-100" />
        </div>

        <div className="h-[76px] rounded-lg bg-indigo-100" />

        <section className="space-y-3">
          <div className="h-6 w-52 rounded bg-indigo-100" />
          <div className="h-4 w-80 max-w-full rounded bg-neutral-100" />
          <div className="h-14 rounded-lg border border-dashed border-indigo-100 bg-indigo-50/60" />
        </section>

        <section className="space-y-3">
          <div className="h-6 w-36 rounded bg-indigo-100" />
          <div className="h-4 w-64 max-w-full rounded bg-neutral-100" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="min-h-[142px] rounded-lg border border-neutral-200 bg-white p-5">
                <div className="size-10 rounded-md bg-neutral-100" />
                <div className="mt-4 h-4 w-2/3 rounded bg-neutral-100" />
                <div className="mt-2 h-3 w-full rounded bg-neutral-50" />
                <div className="mt-2 h-3 w-4/5 rounded bg-neutral-50" />
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <div className="space-y-3">
            <div className="h-6 w-44 rounded bg-indigo-100" />
            <div className="h-4 w-72 max-w-full rounded bg-neutral-100" />
            <div className="h-[260px] rounded-lg border border-neutral-200 bg-white" />
          </div>
          <div className="space-y-3">
            <div className="h-6 w-40 rounded bg-indigo-100" />
            <div className="h-4 w-56 max-w-full rounded bg-neutral-100" />
            <div className="h-[220px] rounded-lg border border-neutral-200 bg-white" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
