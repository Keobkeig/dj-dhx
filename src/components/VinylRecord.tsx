import React from 'react'

interface Track {
  id: string
  title: string
  artist: string
  playing: boolean
  position: 'left' | 'right'
}

interface VinylRecordProps {
  track: Track
}

export default function VinylRecord({ track }: VinylRecordProps) {
  console.log('Rendering VinylRecord for track:', track.title, track.playing)

  return (
    <div className="relative">
      <div
        className={`
          w-48 h-48 rounded-full bg-black border-8 border-gray-800 relative overflow-hidden
          ${track.playing ? 'animate-spin' : ''}
        `}
        style={{ animationDuration: '3s' }}
      >
        {/* Vinyl grooves */}
        <div className="absolute inset-4 rounded-full border border-gray-700" />
        <div className="absolute inset-8 rounded-full border border-gray-700" />
        <div className="absolute inset-12 rounded-full border border-gray-700" />
        <div className="absolute inset-16 rounded-full border border-gray-700" />

        {/* Center label with track info */}
        <div className="absolute inset-20 rounded-full bg-red-600 flex flex-col items-center justify-center text-white text-center p-2">
          <div className="text-[8px] font-bold truncate w-full leading-tight">{track.title}</div>
          <div className="text-[6px] truncate w-full opacity-80">{track.artist}</div>
          <div className="w-1 h-1 rounded-full bg-black mt-1" />
        </div>

        {/* Reflection effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
      </div>

      {/* Track info */}
      <div className="mt-4 text-center">
        <div className="text-sm font-semibold truncate">{track.title}</div>
        <div className="text-xs text-gray-400 truncate">{track.artist}</div>
        <div className={`text-xs mt-1 ${
          track.playing ? 'text-green-400' : 'text-gray-500'
        }`}>
          {track.playing ? '● PLAYING' : '⏸ PAUSED'}
        </div>
      </div>
    </div>
  )
}