import { useState, useCallback, useEffect, useRef } from 'react'
import './App.css'
import PulsatingButton from '@/components/ui/pulsating-button'
import VinylRecord from '@/components/VinylRecord'
import { SongProgress } from '@/components/SongProgress'
import { Upload, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'

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
  audioFile?: string
  duration?: number
  currentTime?: number
  bpm?: number
}

function App() {
  const [pads, setPads] = useState<Pad[]>([])
  const [tracks, setTracks] = useState<Track[]>([
    { id: '1', title: 'Load MP3 File', artist: 'Click to browse', playing: false, position: 'left', bpm: 120 },
    { id: '2', title: 'Load MP3 File', artist: 'Click to browse', playing: false, position: 'right', bpm: 120 }
  ])
  const [loadedTracks, setLoadedTracks] = useState<Track[]>([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0)
  const [songProgress, setSongProgress] = useState({ currentTime: 0, duration: 0 })
  const [activeChannels, setActiveChannels] = useState<boolean[]>(new Array(8).fill(false))
  const [mutedChannels, setMutedChannels] = useState<boolean[]>(new Array(8).fill(false))
  const [shiftPressed, setShiftPressed] = useState<boolean>(false)
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set())
  const [globalPaused, setGlobalPaused] = useState<boolean>(false)
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map())
  const [showHelp, setShowHelp] = useState<boolean>(false)
  const [showQueue, setShowQueue] = useState<boolean>(true)
  const [mainTrackAudio, setMainTrackAudio] = useState<HTMLAudioElement | null>(null)
  const [showBpmGuide, setShowBpmGuide] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentDeck, setCurrentDeck] = useState<'left' | 'right'>('left')
  const [queueSongs] = useState([
    { title: "Uptown Funk", artist: "Bruno Mars", status: "playing" },
    { title: "Good 4 U", artist: "Olivia Rodrigo", status: "queued" },
    { title: "Blinding Lights", artist: "The Weeknd", status: "queued" },
    { title: "Levitating", artist: "Dua Lipa", status: "queued" },
    { title: "Stay", artist: "The Kid LAROI", status: "queued" }
  ])

  // 8x8 keyboard mapping - each row has unique keys to avoid conflicts (updated)
  const keyMap: { [key: string]: string } = {
    // Row 0
    '1': '0-0', '2': '0-1', '3': '0-2', '4': '0-3', '5': '0-4', '6': '0-5', '7': '0-6', '8': '0-7',
    // Row 1
    'q': '1-0', 'w': '1-1', 'e': '1-2', 'r': '1-3', 't': '1-4', 'y': '1-5', 'u': '1-6', 'i': '1-7',
    // Row 2
    'a': '2-0', 's': '2-1', 'd': '2-2', 'f': '2-3', 'g': '2-4', 'h': '2-5', 'j': '2-6', 'k': '2-7',
    // Row 3
    'z': '3-0', 'x': '3-1', 'c': '3-2', 'v': '3-3', 'b': '3-4', 'n': '3-5', 'm': '3-6', ',': '3-7',
    // Row 4
    '!': '4-0', '@': '4-1', '#': '4-2', '$': '4-3', '%': '4-4', '^': '4-5', '&': '4-6', '*': '4-7',
    // Row 5
    'Q': '5-0', 'W': '5-1', 'E': '5-2', 'R': '5-3', 'T': '5-4', 'Y': '5-5', 'U': '5-6', 'O': '5-7',
    // Row 6
    'A': '6-0', 'S': '6-1', 'D': '6-2', 'F': '6-3', 'G': '6-4', 'H': '6-5', 'J': '6-6', 'L': '6-7',
    // Row 7
    'Z': '7-0', 'X': '7-1', 'C': '7-2', 'V': '7-3', 'B': '7-4', 'N': '7-5', 'M': '7-6', '<': '7-7'
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

    if (isOneShot) {
      // For one-shots, always create a new audio instance so they can overlap
      const newAudio = new Audio(soundFile)
      newAudio.volume = 0.7
      newAudio.loop = false
      // Clean up the audio element when it finishes playing
      newAudio.addEventListener('ended', () => {
        newAudio.remove()
      })
      newAudio.play().catch(console.error)
    } else {
      // For loops, use the existing behavior with stored audio elements
      const audio = audioElements.get(soundFile)
      if (!audio) {
        const newAudio = new Audio(soundFile)
        newAudio.volume = 0.7
        newAudio.loop = true
        setAudioElements(prev => new Map(prev.set(soundFile, newAudio)))
        newAudio.play().catch(console.error)
      } else {
        audio.currentTime = 0
        audio.loop = true
        audio.play().catch(console.error)
      }
    }
  }, [audioElements, globalPaused])

  // BPM Guide data based on energy building chart
  const bpmGuide = [
    { phase: 'Opening', bpmRange: '120-125', description: 'Ease the crowd into the vibe' },
    { phase: 'Build-up', bpmRange: '125-130', description: 'Gradually increase energy' },
    { phase: 'Peak time', bpmRange: '130-135', description: 'High-energy moments' },
    { phase: 'Cool down', bpmRange: '125-120', description: 'Wind down the set' }
  ]

  // File handling functions
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, position: 'left' | 'right') => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const newTracks: Track[] = []
    let loadedCount = 0

    Array.from(files).forEach((file, index) => {
      const isMP3 = file.type === 'audio/mp3' ||
                   file.type === 'audio/mpeg' ||
                   file.name.toLowerCase().endsWith('.mp3')

      if (!isMP3) {
        alert(`${file.name} is not an MP3 file`)
        return
      }

      const url = URL.createObjectURL(file)
      const audio = new Audio(url)

      audio.addEventListener('loadedmetadata', () => {
        const fileName = file.name.replace('.mp3', '')
        const parts = fileName.split(' - ')
        const title = parts.length > 1 ? parts[1] : fileName
        const artist = parts.length > 1 ? parts[0] : 'Unknown Artist'

        const newTrack: Track = {
          id: `loaded-${Date.now()}-${index}`,
          title,
          artist,
          playing: false,
          position: 'left',
          audioFile: url,
          duration: audio.duration,
          currentTime: 0,
          bpm: 120
        }

        newTracks.push(newTrack)
        loadedCount++

        if (loadedCount === files.length) {
          setLoadedTracks(prev => [...prev, ...newTracks])
          if (newTracks.length > 0) {
            const firstTrack = newTracks[0]
            setTracks(prev => prev.map(track =>
              track.position === position
                ? { ...firstTrack, position }
                : track
            ))
            setCurrentTrackIndex(loadedTracks.length) // Set to the first of the newly loaded tracks
          }
        }
      })
    })

    // Reset file input
    event.target.value = ''
  }, [loadedTracks])

  const togglePlayPause = useCallback(() => {
    // Check if any track is currently playing
    const playingTrack = tracks.find(t => t.playing)

    if (mainTrackAudio) {
      if (!mainTrackAudio.paused) {
        // Currently playing - pause it
        mainTrackAudio.pause()
        setTracks(prev => prev.map(track => ({ ...track, playing: false })))
      } else {
        // Currently paused - resume it
        mainTrackAudio.play().catch(console.error)
        setTracks(prev => prev.map(track =>
          track.id === playingTrack?.id ? { ...track, playing: true } : track
        ))
      }
      return
    }

    // If no mainTrackAudio but we have loaded tracks, try to start from loadedTracks
    if (loadedTracks.length === 0) {
      alert('No tracks loaded. Please load MP3 files first.')
      return
    }

    const currentTrack = loadedTracks[currentTrackIndex]
    if (!currentTrack?.audioFile) return

    const activePosition = tracks.find(t => t.playing)?.position || 'left'

    // Start new audio
    const newAudio = new Audio(currentTrack.audioFile)
    newAudio.volume = 0.8

    newAudio.addEventListener('timeupdate', () => {
      setSongProgress({
        currentTime: newAudio.currentTime,
        duration: newAudio.duration || 0
      })
      setTracks(prev => prev.map(t =>
        t.id === currentTrack.id
          ? { ...t, currentTime: newAudio.currentTime }
          : t
      ))
    })

    newAudio.addEventListener('loadedmetadata', () => {
      setSongProgress({
        currentTime: 0,
        duration: newAudio.duration || 0
      })
    })

    newAudio.addEventListener('ended', () => {
      // Auto advance to next track when song ends
      const nextIndex = (currentTrackIndex + 1) % loadedTracks.length
      setCurrentTrackIndex(nextIndex)
      const nextTrackData = loadedTracks[nextIndex]
      if (nextTrackData?.audioFile) {
        const autoAudio = new Audio(nextTrackData.audioFile)
        autoAudio.volume = 0.8
        setMainTrackAudio(autoAudio)
        autoAudio.play().catch(console.error)
      }
    })

    setMainTrackAudio(newAudio)
    newAudio.play().catch(console.error)

    setTracks(prev => prev.map(track => {
      if (track.position === activePosition) {
        return { ...currentTrack, position: activePosition, playing: true }
      }
      return { ...track, playing: false }
    }))
  }, [loadedTracks, currentTrackIndex, mainTrackAudio, tracks])

  const nextTrack = useCallback(() => {
    if (loadedTracks.length === 0) return

    const wasPlaying = tracks.some(t => t.playing)
    const nextIndex = (currentTrackIndex + 1) % loadedTracks.length
    setCurrentTrackIndex(nextIndex)

    const nextTrackData = loadedTracks[nextIndex]
    const activePosition = tracks.find(t => t.playing)?.position || 'left'

    // Stop current audio
    if (mainTrackAudio) {
      mainTrackAudio.pause()
      mainTrackAudio.currentTime = 0
    }

    // Update tracks display
    setTracks(prev => prev.map(track =>
      track.position === activePosition
        ? { ...nextTrackData, position: activePosition, playing: false }
        : { ...track, playing: false }
    ))

    // Auto-play if something was playing
    if (wasPlaying && nextTrackData?.audioFile) {
      setTimeout(() => {
        const newAudio = new Audio(nextTrackData.audioFile)
        newAudio.volume = 0.8

        newAudio.addEventListener('timeupdate', () => {
          setSongProgress({
            currentTime: newAudio.currentTime,
            duration: newAudio.duration || 0
          })
        })

        newAudio.addEventListener('loadedmetadata', () => {
          setSongProgress({
            currentTime: 0,
            duration: newAudio.duration || 0
          })
        })

        newAudio.addEventListener('ended', () => {
          nextTrack()
        })

        setMainTrackAudio(newAudio)
        newAudio.play().catch(console.error)

        setTracks(prev => prev.map(track =>
          track.position === activePosition
            ? { ...track, playing: true }
            : track
        ))
      }, 100)
    }
  }, [loadedTracks, currentTrackIndex, tracks, mainTrackAudio])

  const prevTrack = useCallback(() => {
    if (loadedTracks.length === 0) return

    const wasPlaying = tracks.some(t => t.playing)
    const prevIndex = currentTrackIndex === 0 ? loadedTracks.length - 1 : currentTrackIndex - 1
    setCurrentTrackIndex(prevIndex)

    const prevTrackData = loadedTracks[prevIndex]
    const activePosition = tracks.find(t => t.playing)?.position || 'left'

    // Stop current audio
    if (mainTrackAudio) {
      mainTrackAudio.pause()
      mainTrackAudio.currentTime = 0
    }

    // Update tracks display
    setTracks(prev => prev.map(track =>
      track.position === activePosition
        ? { ...prevTrackData, position: activePosition, playing: false }
        : { ...track, playing: false }
    ))

    // Auto-play if something was playing
    if (wasPlaying && prevTrackData?.audioFile) {
      setTimeout(() => {
        const newAudio = new Audio(prevTrackData.audioFile)
        newAudio.volume = 0.8

        newAudio.addEventListener('timeupdate', () => {
          setSongProgress({
            currentTime: newAudio.currentTime,
            duration: newAudio.duration || 0
          })
        })

        newAudio.addEventListener('loadedmetadata', () => {
          setSongProgress({
            currentTime: 0,
            duration: newAudio.duration || 0
          })
        })

        newAudio.addEventListener('ended', () => {
          // Auto advance to next track
          const nextIndex = (prevIndex + 1) % loadedTracks.length
          setCurrentTrackIndex(nextIndex)
        })

        setMainTrackAudio(newAudio)
        newAudio.play().catch(console.error)

        setTracks(prev => prev.map(track =>
          track.position === activePosition
            ? { ...track, playing: true }
            : track
        ))
      }, 100)
    }
  }, [loadedTracks, currentTrackIndex, tracks, mainTrackAudio])

  const handleVinylClick = useCallback((position: 'left' | 'right') => {
    const track = tracks.find(t => t.position === position)
    if (!track?.audioFile) {
      setCurrentDeck(position)
      fileInputRef.current?.click()
      return
    }

    togglePlayPause()
  }, [tracks, togglePlayPause])

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

  // Initialize 8x8 grid with sounds + stop/mute, new keyRows mapping
  useEffect(() => {
    const initialPads: Pad[] = []

    // Updated keyRows for all 8 rows (including STOP and MUTE)
    const keyRows = [
      ['1', '2', '3', '4', '5', '6', '7', '8'],      // Row 0
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i'],      // Row 1
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'],      // Row 2
      ['z', 'x', 'c', 'v', 'b', 'n', 'm', ','],      // Row 3
      ['!', '@', '#', '$', '%', '^', '&', '*'],      // Row 4
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'O'],      // Row 5
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'L'],      // Row 6
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '<']       // Row 7
    ]

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
        }

        // Assign keyBinding for all rows from keyRows
        keyBinding = keyRows[row][col] || ''

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
      if (pad.isOneShot) {
        // One-shot sounds: just play, no state management needed
        if (pad.soundFile && !mutedChannels[pad.channel]) {
          playAudio(pad.soundFile, true)
        }
      } else {
        // Loop sounds: toggleable behavior, only one active per column
        setPads(prev => prev.map(p => {
          if (p.id === pad.id) {
            const newActive = !p.active
            if (newActive && p.soundFile && !mutedChannels[p.channel]) {
              playAudio(p.soundFile, false)
            } else if (!newActive && p.soundFile) {
              stopAudio(p.soundFile)
            }
            return { ...p, active: newActive }
          }
          // Stop all other loop pads in the same column (not stop/mute pads or one-shots)
          if (p.channel === pad.channel && p.type !== 'stop' && p.type !== 'mute' && p.id !== pad.id && p.active && !p.isOneShot) {
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

      // Handle help modal
      if (key === '?' || key === '/') {
        event.preventDefault()
        setShowHelp(prev => !prev)
        return
      }

      // Handle queue toggle
      if (key === '.') {
        event.preventDefault()
        setShowQueue(prev => !prev)
        return
      }

      // Handle BPM guide toggle
      if (key === '~' || key === '`') {
        event.preventDefault()
        setShowBpmGuide(prev => !prev)
        return
      }

      // Handle main track playback controls
      if (key === '9') {
        event.preventDefault()
        togglePlayPause()
        return
      }

      if (key === 'o') {
        event.preventDefault()
        prevTrack()
        return
      }

      if (key === 'l') {
        event.preventDefault()
        nextTrack()
        return
      }

      // Handle shift key (keep for future audio splicing features)
      if (key === 'shift') {
        setShiftPressed(true)
        return
      }

      // Find pad by key mapping - prioritize case-sensitive match with shift
      let padId: string | undefined
      if (event.shiftKey) {
        // Prioritize exact case-sensitive match when shift is held
        padId = keyMap[event.key]
      } else {
        // Default to lowercase mappings
        padId = keyMap[event.key.toLowerCase()]
      }
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
    // Vibrant colors for each sound type
    const baseColors = {
      drums: shiftPressed ? 'bg-orange-700' : 'bg-orange-500',
      bass: shiftPressed ? 'bg-green-700' : 'bg-green-500',
      melodic: shiftPressed ? 'bg-purple-700' : 'bg-purple-500',
      fx: shiftPressed ? 'bg-cyan-700' : 'bg-cyan-500',
      vocal: shiftPressed ? 'bg-pink-700' : 'bg-pink-500',
      perc: shiftPressed ? 'bg-yellow-700' : 'bg-yellow-500',
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
    <div className="h-screen w-full bg-black text-white flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Song Progress Bar */}
      <SongProgress
        currentTime={songProgress.currentTime}
        duration={songProgress.duration}
        isPlaying={tracks.some(t => t.playing)}
      />
      {/* Header */}
      <div className="flex items-center justify-center w-full mb-4">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mr-4">
            <div className="w-8 h-8 bg-black transform rotate-45"></div>
          </div>
          <h1 className="text-4xl font-bold tracking-wider futuristic-font">DHX</h1>
          {/* <span className="ml-4 px-3 py-1 bg-gray-700 rounded text-sm">INTRO</span> */}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,audio/mp3"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, currentDeck)}
      />

      <div className="flex items-center justify-center w-full max-w-7xl gap-8">
        {/* Left Vinyl */}
        <div className="flex-shrink-0">
          <div onClick={() => handleVinylClick('left')} className="cursor-pointer">
            <VinylRecord track={tracks[0]} />
          </div>
        </div>

        {/* Launchpad Grid - Fixed 8x8 */}
        <div className="flex-shrink-0">
          <div className="grid grid-cols-8 gap-1 p-6 bg-gray-900 rounded-lg shadow-2xl border-4 border-gray-800 w-fit mx-auto"
               style={{
                 display: 'grid',
                 gridTemplateColumns: 'repeat(8, 80px)',
                 gridTemplateRows: 'repeat(8, 80px)'
               }}>
            {pads.map((pad) => {
              const pulseColor = pad.type === 'drums' ? '#f97316' :
                                pad.type === 'bass' ? '#10b981' :
                                pad.type === 'melodic' ? '#a855f7' :
                                pad.type === 'fx' ? '#06b6d4' :
                                pad.type === 'vocal' ? '#ec4899' :
                                pad.type === 'perc' ? '#eab308' :
                                pad.type === 'stop' ? '#ef4444' : '#6b7280'

              const commonProps = {
                onClick: () => handlePadClick(pad),
                className: `
                  w-20 h-20 rounded-lg transition-all duration-150 transform
                  ${getPadColor(pad)}
                  border-2 border-gray-800 hover:border-gray-600
                  flex flex-col items-center justify-center
                  text-sm font-bold text-white/90
                  relative overflow-hidden
                  min-w-[80px] min-h-[80px]
                `,
                title: `${pad.label} - Channel ${pad.channel + 1}${pad.keyBinding ? ` - Key: ${pad.keyBinding}` : ''}`
              }

              const padContent = (
                <>
                  {/* Circular icon for loops, arrow for one-shots - Fixed positioning */}
                  <div className="absolute top-1 left-1 pointer-events-none">
                    {pad.isOneShot ? (
                      <div className="text-white/40 text-xs">→</div>
                    ) : (
                      <div className="text-white/40 text-xs">↻</div>
                    )}
                  </div>

                  {/* Key binding (show only if shiftPressed) */}
                  {pad.keyBinding && shiftPressed && (
                    <div className="text-white/60 text-[10px] mb-1 pointer-events-none">{pad.keyBinding}</div>
                  )}

                  {/* Label */}
                  <div className="text-[9px] leading-tight text-center px-1 pointer-events-none">
                    {pad.label}
                  </div>
                </>
              )

              return pad.active ? (
                <PulsatingButton
                  key={pad.id}
                  {...commonProps}
                  pulseColor={pulseColor}
                  duration="2s"
                >
                  {padContent}
                </PulsatingButton>
              ) : (
                <button
                  key={pad.id}
                  {...commonProps}
                >
                  {padContent}
                </button>
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
            <div className="text-gray-400 text-sm space-x-2 futuristic-font">
              <span>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-white text-xs futuristic-font">?</kbd> for help</span>
              <span>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-white text-xs futuristic-font">~</kbd> for BPM guide</span>
            </div>
          </div>
        </div>

        {/* Right Vinyl */}
        <div className="flex-shrink-0">
          <div onClick={() => handleVinylClick('right')} className="cursor-pointer">
            <VinylRecord track={tracks[1]} />
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900/80 backdrop-blur-md rounded-lg p-8 max-w-2xl mx-4 border border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-white">Launchpad Controls</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="font-semibold text-white mb-2">Basic Controls:</h3>
                <ul className="space-y-1 ml-4">
                  <li>• Click pads to trigger sounds</li>
                  <li>• Use keyboard keys to trigger pads (see mapping below)</li>
                  <li>• Spacebar: Global pause/unpause</li>
                  <li>• Only one loop sound per column can be active</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Keyboard Mapping:</h3>
                <ul className="space-y-1 ml-4 text-sm">
                  <li>• <strong>Row 0-3:</strong> 1-8, QWERTY, ASDF, ZXCV</li>
                  <li>• <strong>Row 5:</strong> !@#$%^&* (Shift + 1-8)</li>
                  <li>• <strong>STOP:</strong> ASDFGHJK (uppercase)</li>
                  <li>• <strong>MUTE:</strong> ZXCVBNM&lt; (uppercase)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Sound Types:</h3>
                <ul className="space-y-1 ml-4">
                  <li>• <span className="text-orange-400">Orange</span>: Drums (loops)</li>
                  <li>• <span className="text-green-400">Green</span>: Bass (loops)</li>
                  <li>• <span className="text-purple-400">Purple</span>: Melodic (loops)</li>
                  <li>• <span className="text-cyan-400">Cyan</span>: FX (one-shots)</li>
                  <li>• <span className="text-pink-400">Pink</span>: Vocals (one-shots)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Main Track Controls:</h3>
                <ul className="space-y-1 ml-4">
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">9</kbd> Play/Pause main track</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">O</kbd> Previous track</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">L</kbd> Next track</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">.</kbd> Toggle queue</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">~</kbd> Toggle BPM guide</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* BPM Guide Box - Top Left */}
      <div
        className={`fixed top-4 left-4 w-80 z-40 bg-gray-900/80 backdrop-blur-md rounded-lg border border-gray-700 p-4 transition-all duration-300 ease-out ${
          showBpmGuide
            ? 'translate-x-0 translate-y-0 opacity-100 scale-100'
            : '-translate-x-8 -translate-y-8 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">BPM Guide</h3>
          <button
            onClick={() => setShowBpmGuide(false)}
            className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Current playing song info */}
        {(() => {
          const playingTrack = tracks.find(t => t.playing)
          return playingTrack ? (
            <div className="mb-4 p-3 bg-blue-600/20 rounded border border-blue-500/30">
              <div className="text-white font-medium text-sm truncate">{playingTrack.title}</div>
              <div className="text-gray-300 text-xs truncate">{playingTrack.artist}</div>
              <div className="text-green-400 text-xs mt-1 flex items-center">
                <Volume2 size={10} className="mr-1" />
                {playingTrack.bpm} BPM • Now Playing
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-gray-800/50 rounded">
              <div className="text-gray-400 text-xs">No track playing</div>
            </div>
          )
        })()}

        {/* BPM Guide Chart */}
        <div className="space-y-2">
          <h4 className="text-white text-xs font-medium mb-2">Energy Building Guide:</h4>
          {bpmGuide.map((guide, index) => (
            <div key={index} className="bg-gray-800/30 p-2 rounded text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="text-white font-medium">{guide.phase}</span>
                <span className="text-green-400 font-mono">{guide.bpmRange}</span>
              </div>
              <div className="text-gray-400 text-[10px]">{guide.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Song Queue Box - Bottom Right */}
      <div
        className={`fixed bottom-4 right-4 w-80 z-40 bg-gray-900/80 backdrop-blur-md rounded-lg border border-gray-700 p-4 transition-all duration-300 ease-out ${
          showQueue
            ? 'translate-x-0 translate-y-0 opacity-100 scale-100'
            : 'translate-x-8 -translate-y-8 opacity-0 scale-95 pointer-events-none'
        }`}
      >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Queue</h3>
            <div className="flex gap-2">
              <button
                onClick={prevTrack}
                className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center"
              >
                <SkipBack size={12} />
              </button>
              <button
                onClick={togglePlayPause}
                className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center"
              >
                {tracks.find(t => t.playing) ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <button
                onClick={nextTrack}
                className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center"
              >
                <SkipForward size={12} />
              </button>
              <button
                onClick={() => setShowQueue(false)}
                className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {loadedTracks.map((song, index) => (
              <div
                key={song.id}
                className={`p-2 rounded cursor-pointer hover:bg-gray-700/50 ${
                  index === currentTrackIndex ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-gray-800/50'
                }`}
                onClick={() => {
                  setCurrentTrackIndex(index)
                  const playingTrack = tracks.find(t => t.playing)
                  const position = playingTrack?.position || 'left'
                  setTracks(prev => prev.map(track =>
                    track.position === position
                      ? { ...song, position, playing: false }
                      : track
                  ))
                }}
                style={{
                  opacity: index === currentTrackIndex ? 1 : Math.max(0.3, 1 - (Math.abs(index - currentTrackIndex) * 0.15))
                }}
              >
                <div className="text-white text-sm font-medium truncate">{song.title}</div>
                <div className="text-gray-400 text-xs truncate">{song.artist}</div>
                {index === currentTrackIndex && tracks.find(t => t.playing) && (
                  <div className="text-green-400 text-xs">● Now Playing</div>
                )}
                {index === currentTrackIndex && !tracks.find(t => t.playing) && (
                  <div className="text-yellow-400 text-xs">● Current Track</div>
                )}
              </div>
            ))}
            {loadedTracks.length === 0 && (
              <div className="p-4 text-gray-400 text-center text-sm">
                No tracks loaded. Click on a vinyl to load MP3 files.
              </div>
            )}
          </div>
        </div>
    </div>
  )
}


export default App
