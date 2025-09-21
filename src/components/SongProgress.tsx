import React from 'react'
import { cn } from '@/lib/utils'

interface SongProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  leftProgress: { currentTime: number; duration: number }
  rightProgress: { currentTime: number; duration: number }
  leftPlaying: boolean
  rightPlaying: boolean
}

export const SongProgress = React.forwardRef<HTMLDivElement, SongProgressProps>(
  ({ className, leftProgress, rightProgress, leftPlaying, rightPlaying, ...props }, ref) => {
    const leftProgressPercent = leftProgress.duration > 0 ? (leftProgress.currentTime / leftProgress.duration) * 100 : 0
    const rightProgressPercent = rightProgress.duration > 0 ? (rightProgress.currentTime / rightProgress.duration) * 100 : 0

    return (
      <div
        ref={ref}
        className={cn(
          "fixed inset-x-0 top-0 z-50 h-2 bg-gray-800/50",
          className,
        )}
        {...props}
      >
        {/* Left track progress bar (normal direction) */}
        <div
          className={cn(
            "absolute top-0 left-0 h-1 origin-left bg-gradient-to-r from-[#f97316] to-[#fb923c] transition-all duration-300",
            leftPlaying ? "animate-pulse" : ""
          )}
          style={{
            width: `${Math.min(leftProgressPercent, 100)}%`,
          }}
        />

        {/* Right track progress bar (reverse direction) */}
        <div
          className={cn(
            "absolute bottom-0 right-0 h-1 origin-right bg-gradient-to-l from-[#a855f7] to-[#c084fc] transition-all duration-300",
            rightPlaying ? "animate-pulse" : ""
          )}
          style={{
            width: `${Math.min(rightProgressPercent, 100)}%`,
          }}
        />
      </div>
    )
  }
)

SongProgress.displayName = "SongProgress"