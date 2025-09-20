import React from 'react'
import { cn } from '@/lib/utils'

interface SongProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  currentTime: number
  duration: number
  isPlaying: boolean
}

export const SongProgress = React.forwardRef<HTMLDivElement, SongProgressProps>(
  ({ className, currentTime, duration, isPlaying, ...props }, ref) => {
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    return (
      <div
        ref={ref}
        className={cn(
          "fixed inset-x-0 top-0 z-50 h-1 bg-gray-800/50",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full origin-left bg-gradient-to-r from-[#A97CF8] via-[#F38CB8] to-[#FDCC92] transition-all duration-300",
            isPlaying ? "animate-pulse" : ""
          )}
          style={{
            width: `${Math.min(progress, 100)}%`,
          }}
        />
      </div>
    )
  }
)

SongProgress.displayName = "SongProgress"