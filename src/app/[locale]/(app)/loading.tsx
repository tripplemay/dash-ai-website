export default function AppLoading() {
  return (
    <div
      className="mx-auto flex min-h-[55vh] w-full max-w-[1200px] items-start px-7 py-10"
      aria-busy="true"
    >
      <div className="w-full animate-pulse space-y-5" aria-hidden="true">
        <div className="h-9 w-52 rounded-lg bg-[#E7EDF8]" />
        <div className="h-4 w-80 max-w-full rounded bg-[#EEF3FA]" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="overflow-hidden rounded-2xl border border-[#E7EDF8] bg-white">
              <div className="aspect-[16/10] bg-[#E7EDF8]" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-2/3 rounded bg-[#E7EDF8]" />
                <div className="h-3 w-full rounded bg-[#EEF3FA]" />
                <div className="h-9 w-full rounded-lg bg-[#EEF3FA]" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
