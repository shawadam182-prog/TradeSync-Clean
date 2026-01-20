import React from 'react';

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

// Table row skeleton
export const TableRowSkeleton: React.FC<{ cols?: number }> = ({ cols = 5 }) => (
  <tr className="border-b border-slate-100">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="py-4 px-4">
        <Skeleton className="h-4 w-full max-w-[120px]" />
      </td>
    ))}
  </tr>
);

// Card skeleton for lists
export const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <Skeleton className="h-4 w-48" />
    <div className="flex gap-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-24" />
    </div>
  </div>
);

// Stats card skeleton
export const StatCardSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
    <Skeleton className="h-12 w-12 rounded-xl" />
    <div className="space-y-2">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
);

// Home dashboard skeleton
export const HomeSkeleton: React.FC = () => (
  <div className="space-y-8">
    {/* Header */}
    <div className="flex justify-between items-end">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-12 w-24 rounded-2xl" />
    </div>

    {/* Quick actions */}
    <div className="flex gap-3">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-14 w-32 rounded-2xl" />
      ))}
    </div>

    {/* Stats */}
    <div className="bg-white rounded-[32px] border p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
      </div>
    </div>

    {/* Next job card */}
    <Skeleton className="h-64 w-full rounded-[48px]" />
  </div>
);

// Expenses list skeleton
export const ExpensesListSkeleton: React.FC = () => (
  <div className="space-y-4">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="bg-white rounded-xl border p-4 flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-16" />
      </div>
    ))}
  </div>
);

// Quote list skeleton
export const QuotesListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
  </div>
);

// VAT summary skeleton
export const VATSummarySkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border p-6 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
    <div className="bg-white rounded-2xl border p-6">
      <Skeleton className="h-64 w-full" />
    </div>
  </div>
);

// Schedule skeleton
export const ScheduleSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32 rounded-xl" />
    </div>
    <div className="bg-white rounded-2xl border p-4">
      <div className="grid grid-cols-7 gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 mt-4">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  </div>
);

// Customer list skeleton
export const CustomerListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="bg-white rounded-xl border p-4 flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    ))}
  </div>
);

// Job pack list skeleton
export const JobPackListSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
    {[1, 2, 3, 4, 5, 6].map(i => (
      <div key={i} className="bg-white rounded-xl border p-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12 rounded-md" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-5 rounded-md ml-auto" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2 w-20 ml-auto" />
        </div>
      </div>
    ))}
  </div>
);

// Filing cabinet skeleton
export const FilingCabinetSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32 rounded-xl" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <div key={i} className="bg-white rounded-xl border p-4 space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  </div>
);

// Reconciliation skeleton
export const ReconciliationSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 border rounded-xl">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 border rounded-xl">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export { Skeleton };
