import { useState, useCallback, useEffect } from 'react'
import './App.css'
import PulsatingButton from '@/components/ui/pulsating-button'

type PadType = 'drums' | 'bass' | 'melodic' | 'fx' | 'vocal' | 'perc' | 'stop' | 'mute'

interface Pad {
  id: string
  type: PadType
  active: boolean
  channel: number
  row: number
  col: number
  label: string
  keyBinding: string
  isOneShot?: boolean
  soundFile?: string | null
}

interface Track {
  id: string
  title: string
  artist: string
  playing: boolean
  position: 'left' | 'right'
}

function App() {
  const [pads, setPads] = useState<Pad[]>([])
  const [tracks, setTracks] = useState<Track[]>([
    { id: '1', title: 'Uptown Funk', artist: 'Bruno Mars', playing: true, position: 'left' },
    { id: '2', title: 'Good 4 U', artist: 'Olivia Rodrigo', playing: false, position: 'right' }
  ])
  const [activeChannels, setActiveChannels] = useState<boolean[]>(new Array(8).fill(false))
  const [mutedChannels, setMutedChannels] = useState<boolean[]>(new Array(8).fill(false))
  const [shiftPressed, setShiftPressed] = useState<boolean>(false)
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set())
  const [globalPaused, setGlobalPaused] = useState<boolean>(false)
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map())

  // 8x8 keyboard mapping
  const keyMap: { [key: string]: string } = {
    '1': '0-0', '2': '0-1', '3': '0-2', '4': '0-3', '5': '0-4', '6': '0-5', '7': '0-6', '8': '0-7',
    'q': '1-0', 'w': '1-1', 'e': '1-2', 'r': '1-3', 't': '1-4', 'y': '1-5', 'u': '1-6', 'i': '1-7',
    'a': '2-0', 's': '2-1', 'd': '2-2', 'f': '2-3', 'g': '2-4', 'h': '2-5', 'j': '2-6', 'k': '2-7',
    'z': '3-0', 'x': '3-1', 'c': '3-2', 'v': '3-3', 'b': '3-4', 'n': '3-5', 'm': '3-6', ',': '3-7'
  }

  // Audio management
  const preloadAudio = useCallback((soundFile: string) => {
    if (!soundFile || audioElements.has(soundFile)) return

    const audio = new Audio(soundFile)
    audio.preload = 'auto'
    audio.loop = true
    audio.volume = 0.7

    setAudioElements(prev => new Map(prev.set(soundFile, audio)))
  }, [audioElements])

  const playAudio = useCallback((soundFile: string, isOneShot: boolean = false) => {
    if (!soundFile || globalPaused) return

    const audio = audioElements.get(soundFile)
    if (!audio) {
      // Preload and play
      const newAudio = new Audio(soundFile)
      newAudio.volume = 0.7
      newAudio.loop = !isOneShot
      setAudioElements(prev => new Map(prev.set(soundFile, newAudio)))
      newAudio.play().catch(console.error)
    } else {
      audio.currentTime = 0
      audio.loop = !isOneShot
      audio.play().catch(console.error)
    }
  }, [audioElements, globalPaused])

  const stopAudio = useCallback((soundFile: string) => {
    if (!soundFile) return

    const audio = audioElements.get(soundFile)
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
  }, [audioElements])

  const pauseAllAudio = useCallback(() => {
    audioElements.forEach(audio => {
      if (!audio.paused) {
        audio.pause()
      }
    })
  }, [audioElements])

  const resumeAllAudio = useCallback(() => {
    audioElements.forEach(audio => {
      if (audio.paused && audio.currentTime > 0) {
        audio.play().catch(console.error)
      }
    })
  }, [audioElements])

  // Initialize 8x8 grid with 48 sounds + stop/mute
  useEffect(() => {
    const initialPads: Pad[] = []

    // Create a completely organized 8x8 grid
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        let soundType: PadType
        let soundFile: string | null = null
        let keyBinding = ''
        let label = ''

        if (row === 6) {
          // Row 6: STOP pads for each column
          soundType = 'stop'
          label = 'STOP'
        } else if (row === 7) {
          // Row 7: MUTE pads for each column
          soundType = 'mute'
          label = 'MUTE'
        } else {
          // Rows 0-5: 48 sounds (6 rows × 8 columns)
          const soundIndex = (row * 8) + col + 1
          const basePath = '/Viral Hip Hop Project/Samples/Imported/'

          // Organize sounds by type across the grid
          if (col < 2) {
            // Columns 0-1: DRUMS
            soundType = 'drums'
            label = `DRUMS ${soundIndex}`
            soundFile = `${basePath}DRUMS ${((soundIndex - 1) % 6) + 1}.wav`
          } else if (col === 2) {
            // Column 2: BASS
            soundType = 'bass'
            label = `BASS ${soundIndex}`
            soundFile = `${basePath}BASS ${((soundIndex - 1) % 6) + 1}.wav`
          } else if (col < 5) {
            // Columns 3-4: MELODIC
            soundType = 'melodic'
            label = `MELODIC ${soundIndex}`
            soundFile = `${basePath}MELODICS ${((soundIndex - 1) % 12) + 1}.wav`
          } else if (col < 7) {
            // Columns 5-6: FX
            soundType = 'fx'
            label = `FX ${soundIndex}`
            soundFile = `${basePath}FX ${((soundIndex - 1) % 12) + 1}.wav`
          } else {
            // Column 7: VOCAL
            soundType = 'vocal'
            label = `VOCAL ${soundIndex}`
            soundFile = `${basePath}FREE ${((soundIndex - 1) % 6) + 1}.wav`
          }

          // Add keyboard bindings for top 4 rows
          if (row < 4) {
            const keyRows = [
              ['1', '2', '3', '4', '5', '6', '7', '8'],
              ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I'],
              ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K'],
              ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',']
            ]
            keyBinding = keyRows[row][col] || ''
          }
        }

        initialPads.push({
          id: `${row}-${col}`,
          type: soundType,
          active: false,
          channel: col,
          row,
          col,
          label,
          keyBinding,
          isOneShot: soundType === 'fx' || soundType === 'vocal',
          soundFile
        })
      }
    }

    console.log('Generated pads:', initialPads.length, 'pads') // Debug log
    setPads(initialPads)

    // Preload audio files
    initialPads.forEach(pad => {
      if (pad.soundFile) {
        preloadAudio(pad.soundFile)
      }
    })
  }, [preloadAudio])

  const handlePadClick = useCallback((pad: Pad) => {
    console.log('Pad clicked:', pad.id, pad.type, pad.label, pad.soundFile) // Debug log

    // Add physical feedback
    setPressedPads(prev => new Set([...prev, pad.id]))
    setTimeout(() => {
      setPressedPads(prev => {
        const newSet = new Set(prev)
        newSet.delete(pad.id)
        return newSet
      })
    }, 150)

    if (pad.type === 'stop') {
      // Stop all loops in this channel and stop their audio
      setPads(prev => prev.map(p => {
        if (p.channel === pad.channel && !p.isOneShot && p.active) {
          if (p.soundFile) stopAudio(p.soundFile)
          return { ...p, active: false }
        }
        return p
      }))
      setActiveChannels(prev => {
        const newChannels = [...prev]
        newChannels[pad.channel] = false
        return newChannels
      })
    } else if (pad.type === 'mute') {
      // Toggle mute for this channel
      setMutedChannels(prev => {
        const newMuted = [...prev]
        newMuted[pad.channel] = !newMuted[pad.channel]
        return newMuted
      })
    } else {
      // Regular sound pads - only one active per column
      setPads(prev => prev.map(p => {
        if (p.id === pad.id) {
          const newActive = !p.active
          if (newActive && p.soundFile && !mutedChannels[p.channel]) {
            playAudio(p.soundFile, p.isOneShot)
          } else if (!newActive && p.soundFile) {
            stopAudio(p.soundFile)
          }
          return { ...p, active: newActive }
        }
        // Stop all other pads in the same column (not stop/mute pads)
        if (p.channel === pad.channel && p.type !== 'stop' && p.type !== 'mute' && p.id !== pad.id && p.active) {
          if (p.soundFile) stopAudio(p.soundFile)
          return { ...p, active: false }
        }
        return p
      }))

      setActiveChannels(prev => {
        const newChannels = [...prev]
        newChannels[pad.channel] = !pad.active
        return newChannels
      })
    }
  }, [stopAudio, playAudio, mutedChannels])

  // Keyboard event handling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      // Handle spacebar for global pause/unpause
      if (key === ' ') {
        event.preventDefault()
        setGlobalPaused(prev => {
          const newPaused = !prev
          if (newPaused) {
            pauseAllAudio()
          } else {
            resumeAllAudio()
          }
          return newPaused
        })
        return
      }

      // Handle shift key for bottom layer
      if (key === 'shift') {
        setShiftPressed(true)
        return
      }

      // Find pad by key mapping
      const padId = keyMap[key]
      if (padId) {
        const pad = pads.find(p => p.id === padId)
        if (pad) {
          handlePadClick(pad)
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setShiftPressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [pads, handlePadClick])

  const getPadColor = (pad: Pad): string => {
    // Colors based on the reference image - organized by sound type
    const baseColors = {
      drums: shiftPressed ? 'bg-blue-800' : 'bg-blue-600',
      bass: shiftPressed ? 'bg-blue-800' : 'bg-blue-600',
      melodic: shiftPressed ? 'bg-purple-800' : 'bg-purple-600',
      fx: shiftPressed ? 'bg-blue-700' : 'bg-blue-500',
      vocal: shiftPressed ? 'bg-blue-700' : 'bg-blue-500',
      perc: shiftPressed ? 'bg-purple-800' : 'bg-purple-600',
      stop: 'bg-red-600',
      mute: 'bg-gray-600'
    }

    let colorClass = baseColors[pad.type]

    // Physical feedback - glow effect when pressed
    if (pressedPads.has(pad.id)) {
      colorClass += ' ring-4 ring-yellow-400 brightness-150 scale-95'
    } else if (pad.active) {
      colorClass += ' ring-4 ring-white brightness-125'
    } else {
      colorClass += ' hover:brightness-110'
    }

    // Muted channels effect
    if (mutedChannels[pad.channel] && pad.type !== 'stop' && pad.type !== 'mute') {
      colorClass += ' opacity-50'
    }

    return colorClass
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="flex items-center justify-center w-full max-w-7xl mb-8">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mr-4">
            <div className="w-8 h-8 bg-black transform rotate-45"></div>
          </div>
          <h1 className="text-4xl font-bold tracking-wider">LAUNCHPAD</h1>
          <span className="ml-4 px-3 py-1 bg-gray-700 rounded text-sm">INTRO</span>
        </div>
      </div>

      <div className="flex items-center justify-center w-full max-w-7xl">
        {/* Left Vinyl */}
        <div className="flex-1 flex justify-center">
          <VinylRecord track={tracks[0]} />
        </div>

        {/* Launchpad Grid - Fixed 8x8 */}
        <div className="mx-8 flex-shrink-0">
          <div className="grid grid-cols-8 gap-1 p-6 bg-gray-900 rounded-lg shadow-2xl border-4 border-gray-800 w-fit mx-auto"
               style={{
                 display: 'grid',
                 gridTemplateColumns: 'repeat(8, 80px)',
                 gridTemplateRows: 'repeat(8, 80px)'
               }}>
            {pads.map((pad) => {
              const ButtonComponent = pad.active ? PulsatingButton : 'button'
              const pulseColor = pad.type === 'drums' ? '#3b82f6' :
                                pad.type === 'bass' ? '#3b82f6' :
                                pad.type === 'melodic' ? '#8b5cf6' :
                                pad.type === 'fx' ? '#06b6d4' :
                                pad.type === 'vocal' ? '#06b6d4' :
                                pad.type === 'perc' ? '#8b5cf6' :
                                pad.type === 'stop' ? '#ef4444' : '#6b7280'

              return (
                <ButtonComponent
                  key={pad.id}
                  onClick={() => handlePadClick(pad)}
                  className={`
                    w-20 h-20 rounded-lg transition-all duration-150 transform
                    ${getPadColor(pad)}
                    border-2 border-gray-800 hover:border-gray-600
                    flex flex-col items-center justify-center
                    text-sm font-bold text-white/90
                    relative overflow-hidden
                    min-w-[80px] min-h-[80px]
                  `}
                  pulseColor={pad.active ? pulseColor : undefined}
                  duration={pad.active ? "2s" : undefined}
                  title={`${pad.label} - Channel ${pad.channel + 1}${pad.keyBinding ? ` - Key: ${pad.keyBinding}` : ''}`}
                >
                  {/* Circular icon for loops, arrow for one-shots */}
                  <div className="absolute top-1 left-1">
                    {pad.isOneShot ? (
                      <div className="text-white/40 text-xs">→</div>
                    ) : (
                      <div className="text-white/40 text-xs">↻</div>
                    )}
                  </div>

                  {/* Key binding */}
                  {pad.keyBinding && (
                    <div className="text-white/60 text-[10px] mb-1">{pad.keyBinding}</div>
                  )}

                  {/* Label */}
                  <div className="text-[9px] leading-tight text-center px-1">
                    {pad.label}
                  </div>

                </ButtonComponent>
              )
            })}
          </div>

          {/* Indicators */}
          <div className="mt-4 text-center space-y-2">
            {globalPaused && (
              <div className="inline-flex items-center px-3 py-1 bg-red-600 rounded-full text-white font-bold text-sm">
                ⏸ PAUSED - Press SPACEBAR to resume
              </div>
            )}
          </div>
        </div>

        {/* Right Vinyl */}
        <div className="flex-1 flex justify-center">
          <VinylRecord track={tracks[1]} />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center space-x-6 text-sm text-gray-400">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
          Hardware support
        </div>
        <div className="flex items-center space-x-2">
          <span>Hotkeys:</span>
          <kbd className="px-2 py-1 bg-gray-800 rounded">P</kbd>
          <span>/</span>
          <kbd className="px-2 py-1 bg-gray-800 rounded">I</kbd>
          <kbd className="px-2 py-1 bg-gray-800 rounded">?</kbd>
        </div>
      </div>
    </div>
  )
}

interface VinylRecordProps {
  track: Track
}

function VinylRecord({ track }: VinylRecordProps) {
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

        {/* Center label */}
        <div className="absolute inset-20 rounded-full bg-red-600 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-black" />
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

export default App
