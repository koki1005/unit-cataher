'use client'

export default function AppSkeleton() {
  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-30 px-3 py-2 flex items-center gap-2">
        <div className="h-9 w-44 rounded-full bg-white/10 backdrop-blur-md backdrop-saturate-150 border border-white/20 shadow-sm animate-pulse" />
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-md backdrop-saturate-150 border border-white/20 shadow-sm animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-md backdrop-saturate-150 border border-white/20 shadow-sm animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-md backdrop-saturate-150 border border-white/20 shadow-sm animate-pulse" />
        </div>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-[60px] rounded-xl border-[3px] border-zinc-700/40 bg-muted/40 animate-pulse"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
