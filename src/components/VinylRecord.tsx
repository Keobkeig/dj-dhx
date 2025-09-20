import React from 'react'
import '../App.css'

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
          w-64 h-64 rounded-full bg-black border-8 border-gray-800 relative overflow-hidden shadow-2xl
          ${track.playing ? 'animate-spin' : ''}
        `}
        style={{ animationDuration: '2s' }}
      >
        {/* Vinyl grooves - more pronounced */}
        <div className="absolute inset-4 rounded-full border-2 border-gray-600 opacity-70" />
        <div className="absolute inset-8 rounded-full border border-gray-650 opacity-60" />
        <div className="absolute inset-12 rounded-full border border-gray-700 opacity-50" />
        <div className="absolute inset-16 rounded-full border border-gray-750 opacity-40" />
        <div className="absolute inset-20 rounded-full border border-gray-800 opacity-30" />

        {/* Center label with track info - adjusted for larger size */}
        <div className="absolute inset-24 rounded-full bg-red-600 flex flex-col items-center justify-center text-white text-center p-2">
          <div className="text-[10px] font-bold truncate w-full leading-tight">{track.title}</div>
          <div className="text-[8px] truncate w-full opacity-80">{track.artist}</div>
          <div className="w-1.5 h-1.5 rounded-full bg-black mt-1" />
        </div>

        {/* Enhanced reflection effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 via-white/5 to-transparent" />
        <div className="absolute top-4 left-4 w-16 h-16 rounded-full bg-gradient-to-br from-white/15 to-transparent blur-sm" />
      </div>

      {/* Track info */}
      <div className="mt-4 text-center">
        <div className="text-sm font-semibold truncate futuristic-font">{track.title}</div>
        <div className="text-xs text-gray-400 truncate futuristic-font">{track.artist}</div>
        <div className={`text-xs mt-1 futuristic-font ${
          track.playing ? 'text-green-400' : 'text-gray-500'
        }`}>
          {track.playing ? 'PLAYING' : 'PAUSED'}
        </div>
      </div>
    </div>
  )
}