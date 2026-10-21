import { SkeletonGrid } from "@/components/PhotoGrid";

/** Route-level loading state for /e/[id] and /host/[id]. */
export default function AlbumSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading album" className="flex min-h-dvh w-full">
      <div className="fixed inset-y-0 left-0 hidden w-[244px] border-r border-line lg:block" />
      <div className="mx-auto w-full max-w-[935px] lg:pl-[244px] lg:pr-6">
        <div className="flex h-14 items-center px-[18px] lg:hidden">
          <span className="skeleton h-4 w-32 rounded-md" />
        </div>
        <div className="flex items-center gap-[22px] px-[18px] pt-1 lg:gap-16 lg:px-10 lg:pt-9">
          <span className="skeleton h-[88px] w-[88px] shrink-0 rounded-full lg:h-[150px] lg:w-[150px]" />
          <div className="flex flex-1 flex-col gap-2.5">
            <span className="skeleton h-5 w-3/4 rounded-md" />
            <span className="skeleton h-3 w-1/2 rounded-md" />
          </div>
        </div>
        <div className="mt-4 flex gap-1.5 px-[18px] lg:hidden">
          <span className="skeleton h-11 flex-1 rounded-full" />
          <span className="skeleton h-11 flex-1 rounded-full" />
          <span className="skeleton h-11 w-11 rounded-full" />
        </div>
        <div className="mt-4 flex gap-3 px-3.5 lg:mt-10">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="skeleton h-[62px] w-[62px] shrink-0 rounded-full lg:h-20 lg:w-20" />
          ))}
        </div>
        <div className="mt-3 h-11 border-b border-line lg:mt-9" />
        <SkeletonGrid />
      </div>
    </div>
  );
}
