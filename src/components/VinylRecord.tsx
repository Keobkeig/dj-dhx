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
    <div className="relative group">
      {/* Container that clips the vinyl to show only half - vertical half */}
      <div className="w-48 h-96 overflow-hidden relative">
        <div
          className={`
            w-96 h-96 rounded-full bg-black border-8 border-gray-800 relative shadow-2xl
            ${track.playing ? 'animate-spin' : ''}
          `}
          style={{
            animationDuration: '2s',
            position: 'absolute',
            top: '0',
            left: track.position === 'left' ? '0' : '-192px'
          }}
        >
          {/* Vinyl grooves - more pronounced */}
          <div className="absolute inset-6 rounded-full border-2 border-gray-600 opacity-70" />
          <div className="absolute inset-12 rounded-full border border-gray-650 opacity-60" />
          <div className="absolute inset-16 rounded-full border border-gray-700 opacity-50" />
          <div className="absolute inset-20 rounded-full border border-gray-750 opacity-40" />
          <div className="absolute inset-24 rounded-full border border-gray-800 opacity-30" />
          <div className="absolute inset-28 rounded-full border border-gray-850 opacity-25" />

          {/* Center label - just the center hole */}
          <div className="absolute inset-32 rounded-full bg-red-600 flex flex-col items-center justify-center text-white text-center p-3">
            <div className="w-2 h-2 rounded-full bg-black" />
          </div>

          {/* Enhanced reflection effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 via-white/5 to-transparent" />
          <div className="absolute top-6 left-6 w-24 h-24 rounded-full bg-gradient-to-br from-white/15 to-transparent blur-sm" />
        </div>
      </div>

      {/* Track info */}
      <div className="mt-4 text-center w-48">   {/* lock width same as vinyl */}
        <div className="text-sm font-semibold truncate futuristic-font w-full">
          {track.title}
        </div>
        <div className="text-xs text-gray-400 truncate futuristic-font w-full">
          {track.artist}
        </div>
        <div
          className={`text-xs mt-1 futuristic-font ${
            track.playing ? 'text-green-400' : 'text-gray-500'
          }`}
        >
          {track.playing ? 'PLAYING' : 'PAUSED'}
        </div>
      </div>
    </div>
  )
}