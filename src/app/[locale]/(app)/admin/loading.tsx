export default function AdminLoading() {
  return (
    <>
      <div className="animate-pulse space-y-7" aria-busy="true">
        <div className="space-y-3" aria-hidden="true">
          <div className="h-7 w-44 rounded bg-indigo-100" />
          <div className="h-4 w-72 max-w-full rounded bg-neutral-100" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-32 rounded-lg border border-neutral-200 bg-white" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </>
  );
}
