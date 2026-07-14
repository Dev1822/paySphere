export function Skeleton({ className = "" }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="flex-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <Skeleton className="h-3 w-28 mb-3" />
      <Skeleton className="h-8 w-40 mb-3" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function EmployeeCardSkeleton() {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>

      {/* Salary */}
      <div className="bg-gray-50 p-3 rounded-lg space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>

      {/* Button */}
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

export function EmployeeBreakdownSkeleton() {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>

      {/* Breakdown rows */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      </div>

      <div className="h-px bg-gray-200 my-4" />

      {/* Net */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}
