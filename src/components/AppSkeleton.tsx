'use client'

import Image from 'next/image'

export default function AppSkeleton() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-10 px-4">
      <div className="relative w-[90vw] max-w-2xl aspect-[16/9] animate-pulse">
        <Image
          src="/rogo.jpg"
          alt="Unit Catcher"
          fill
          priority
          sizes="(max-width: 768px) 90vw, 672px"
          className="object-contain"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 rounded-full bg-foreground/70 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-4 h-4 rounded-full bg-foreground/70 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-4 h-4 rounded-full bg-foreground/70 animate-bounce" />
      </div>
    </div>
  )
}
