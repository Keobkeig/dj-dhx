import '../App.css'

import React from 'react'

interface Track {
  id: string
  title: string
  artist: string
  playing: boolean
  position: 'left' | 'right'
}

interface MiniVinylRecordProps {
  track?: Track
  compact?: boolean
}

export default function MiniVinylRecord({ track, compact }: MiniVinylRecordProps) {
  if (!track) return null

  const Disc = (
    <div className="w-20 h-20 relative pointer-events-none">
      <div
        className={`
          w-20 h-20 rounded-full bg-black border-2 border-gray-700 relative shadow-lg
          ${track.playing ? 'animate-spin' : ''}
        `}
        style={{ animationDuration: '2s' }}
      >
        <div className="absolute inset-2 rounded-full border border-gray-600 opacity-70" />
        <div className="absolute inset-4 rounded-full border border-gray-700 opacity-50" />
        <div className="absolute inset-6 rounded-full border border-gray-800 opacity-30" />
        <div className="absolute inset-8 rounded-full bg-red-600 flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-black" />
        </div>
      </div>
    </div>
  )

  if (compact) {
    // Only the disc: exact 80×80 box — this is what the overlay should measure
    return Disc
  }

  // Original version (disc + labels below increases height)
  return (
    <div className="flex flex-col items-center pointer-events-none">
      {Disc}
      <div className="mt-1 text-center w-20">
        <div className="text-[10px] font-semibold truncate futuristic-font w-full">
          {track.title}
        </div>
        <div className="text-[8px] text-gray-400 truncate futuristic-font w-full">
          {track.artist}
        </div>
      </div>
    </div>
  )
}