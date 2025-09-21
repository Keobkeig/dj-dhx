import { useState, useCallback, useEffect, useRef } from 'react'
import './App.css'
import PulsatingButton from '@/components/ui/pulsating-button'
import VinylRecord from '@/components/VinylRecord'
import { SongProgress } from '@/components/SongProgress'
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { audioAnalyzer } from './utils/audioAnalysis'
import type { AudioAnalysisResult } from './utils/audioAnalysis'
import { AISection } from './components/AISection'
import { musicSearchService } from './services/spotifyService'

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
  key?: string
  volume?: number
  analyzing?: boolean
}

function App() {
  const [pads, setPads] = useState<Pad[]>([])
  const [tracks, setTracks] = useState<Track[]>([
    { id: '1', title: 'Load MP3 File', artist: 'Click to browse', playing: false, position: 'left', bpm: 120, key: 'C', volume: 1.0 },
    { id: '2', title: 'Load MP3 File', artist: 'Click to browse', playing: false, position: 'right', bpm: 120, key: 'C', volume: 1.0 }
  ])
  const [loadedTracks, setLoadedTracks] = useState<Track[]>([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0)
  const [leftSongProgress, setLeftSongProgress] = useState({ currentTime: 0, duration: 0 })
  const [rightSongProgress, setRightSongProgress] = useState({ currentTime: 0, duration: 0 })
  const [, setActiveChannels] = useState<boolean[]>(new Array(8).fill(false))
  const [mutedChannels, setMutedChannels] = useState<boolean[]>(new Array(8).fill(false))
  const [shiftPressed, setShiftPressed] = useState<boolean>(false)
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set())
  const [globalPaused, setGlobalPaused] = useState<boolean>(false)
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map())
  const [showHelp, setShowHelp] = useState<boolean>(false)
  const [showQueue, setShowQueue] = useState<boolean>(true)
  const [leftDeckAudio, setLeftDeckAudio] = useState<HTMLAudioElement | null>(null)
  const [rightDeckAudio, setRightDeckAudio] = useState<HTMLAudioElement | null>(null)
  const [showBpmGuide, setShowBpmGuide] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentDeck, setCurrentDeck] = useState<'left' | 'right'>('left')
  const [, ] = useState([
    { title: "Uptown Funk", artist: "Bruno Mars", status: "playing" },
    { title: "Good 4 U", artist: "Olivia Rodrigo", status: "queued" },
    { title: "Blinding Lights", artist: "The Weeknd", status: "queued" },
    { title: "Levitating", artist: "Dua Lipa", status: "queued" },
    { title: "Stay", artist: "The Kid LAROI", status: "queued" }
  ])
  const [masterVolume, ] = useState<number>(0.8)
  const [crossfaderPosition, setCrossfaderPosition] = useState<number>(0.5) // 0 = full left, 1 = full right, 0.5 = center
  const [aiSearching, setAiSearching] = useState<boolean>(false)
  const [showAI, setShowAI] = useState<boolean>(false)

  // Calculate individual track volumes based on crossfader position
  const leftTrackVolume = masterVolume * (1 - Math.max(0, (crossfaderPosition - 0.5) * 2))
  const rightTrackVolume = masterVolume * (1 - Math.max(0, (0.5 - crossfaderPosition) * 2))

  // Update track volumes when crossfader changes
  useEffect(() => {
    if (leftDeckAudio) {
      leftDeckAudio.volume = leftTrackVolume
    }
    if (rightDeckAudio) {
      rightDeckAudio.volume = rightTrackVolume
    }

    // Update track state volumes
    setTracks(prev => prev.map(track => ({
      ...track,
      volume: track.position === 'left' ? leftTrackVolume / masterVolume : rightTrackVolume / masterVolume
    })))
  }, [crossfaderPosition, masterVolume, leftDeckAudio, rightDeckAudio, leftTrackVolume, rightTrackVolume])

  // Handle AI song requests
  const handleSongRequest = useCallback(async (songQuery: string) => {
    setAiSearching(true)
    try {
      const result = await musicSearchService.findAndDownloadTrack(songQuery)

      // Create a new track from the AI result
      const newTrack: Track = {
        id: `ai-${Date.now()}`,
        title: result.title,
        artist: result.artist,
        playing: false,
        position: 'left', // Default to left deck
        audioFile: result.url,
        bpm: 120, // Default, will be analyzed
        key: 'C', // Default, will be analyzed
        volume: 1.0,
        analyzing: true
      }

      // Add to loaded tracks and analyze
      setLoadedTracks(prev => [...prev, newTrack])

      // Analyze the track if it's a valid audio file
      if (result.url && result.source === 'spotify') {
        try {
          const analysis = await audioAnalyzer.analyzeURL(result.url)

          // Update the track with analysis results
          setLoadedTracks(prev => prev.map(track =>
            track.id === newTrack.id
              ? { ...track, bpm: analysis.bpm, key: analysis.key, analyzing: false }
              : track
          ))
        } catch (error) {
          console.error('Error analyzing AI track:', error)
          setLoadedTracks(prev => prev.map(track =>
            track.id === newTrack.id
              ? { ...track, analyzing: false }
              : track
          ))
        }
      } else {
        // For YouTube or other sources, just mark as not analyzing
        setLoadedTracks(prev => prev.map(track =>
          track.id === newTrack.id
            ? { ...track, analyzing: false }
            : track
        ))
      }

    } catch (error) {
      console.error('Error handling AI song request:', error)
      // Could show a toast or notification here
    } finally {
      setAiSearching(false)
    }
  }, [])

  // Handle cancelling AI requests
  const handleCancelRequest = useCallback(() => {
    setAiSearching(false)
    // Could also abort any pending fetch requests here
    console.log('AI search cancelled by user')
  }, [])

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
    audio.volume = masterVolume

    setAudioElements(prev => new Map(prev.set(soundFile, audio)))
  }, [audioElements, masterVolume])

  const playAudio = useCallback((soundFile: string, isOneShot: boolean = false) => {
    if (!soundFile || globalPaused) return

    if (isOneShot) {
      // For one-shots, always create a new audio instance so they can overlap
      const newAudio = new Audio(soundFile)
      newAudio.volume = masterVolume
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
        newAudio.volume = masterVolume
        newAudio.loop = true
        setAudioElements(prev => new Map(prev.set(soundFile, newAudio)))
        newAudio.play().catch(console.error)
      } else {
        audio.currentTime = 0
        audio.loop = true
        audio.play().catch(console.error)
      }
    }
  }, [audioElements, globalPaused, masterVolume])

  // BPM Guide data based on energy building chart
  const bpmGuide = [
    { phase: 'Opening', bpmRange: '120-125', description: 'Ease the crowd into the vibe' },
    { phase: 'Build-up', bpmRange: '125-130', description: 'Gradually increase energy' },
    { phase: 'Peak time', bpmRange: '130-135', description: 'High-energy moments' },
    { phase: 'Cool down', bpmRange: '125-120', description: 'Wind down the set' }
  ]

  // File handling functions
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, position: 'left' | 'right') => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const newTracks: Track[] = []
    let loadedCount = 0

    for (const [index, file] of Array.from(files).entries()) {
      const isMP3 = file.type === 'audio/mp3' ||
                   file.type === 'audio/mpeg' ||
                   file.name.toLowerCase().endsWith('.mp3')

      if (!isMP3) {
        alert(`${file.name} is not an MP3 file`)
        continue
      }

      const url = URL.createObjectURL(file)
      const audio = new Audio(url)

      const fileName = file.name.replace('.mp3', '')
      const parts = fileName.split(' - ')
      const title = parts.length > 1 ? parts[1] : fileName
      const artist = parts.length > 1 ? parts[0] : 'Unknown Artist'

      // Create initial track with analyzing flag
      const newTrack: Track = {
        id: `loaded-${Date.now()}-${index}`,
        title,
        artist,
        playing: false,
        position: position, // Use the upload position instead of hardcoded 'left'
        audioFile: url,
        duration: 0,
        currentTime: 0,
        bpm: 120,
        key: 'C',
        volume: 1.0,
        analyzing: true
      }

      await new Promise<void>((resolve) => {
        audio.addEventListener('loadedmetadata', async () => {
          newTrack.duration = audio.duration

          try {
            // Analyze the audio file for BPM and key
            const analysis: AudioAnalysisResult = await audioAnalyzer.analyzeFile(file)
            newTrack.bpm = analysis.bpm
            newTrack.key = analysis.key
            newTrack.analyzing = false
          } catch (error) {
            console.error('Audio analysis failed:', error)
            // Keep default values if analysis fails
            newTrack.analyzing = false
          }

          newTracks.push(newTrack)
          loadedCount++

          if (loadedCount === files.length) {
            setLoadedTracks(prev => [...prev, ...newTracks])
            if (newTracks.length > 0) {
              const firstTrack = newTracks[0]
              setTracks(prev => prev.map(track =>
                track.position === position
                  ? { ...firstTrack, position, playing: false }
                  : track
              ))
              setCurrentTrackIndex(loadedTracks.length)
            }
          }
          resolve()
        })
      })
    }

    // Reset file input
    event.target.value = ''
  }, [loadedTracks])

  const togglePlayPause = useCallback((position?: 'left' | 'right') => {
    // If no position specified, use the current deck
    const targetPosition = position || currentDeck
    const deckAudio = targetPosition === 'left' ? leftDeckAudio : rightDeckAudio
    const setDeckAudio = targetPosition === 'left' ? setLeftDeckAudio : setRightDeckAudio
    const targetTrack = tracks.find(t => t.position === targetPosition)

    // If we have an existing audio element for this deck, use it for pause/resume
    if (deckAudio && targetTrack?.audioFile) {
      if (!deckAudio.paused) {
        // Currently playing - pause it
        deckAudio.pause()
        setTracks(prev => prev.map(track =>
          track.position === targetPosition ? { ...track, playing: false } : track
        ))
      } else {
        // Currently paused - resume it
        deckAudio.play().catch(console.error)
        setTracks(prev => prev.map(track =>
          track.position === targetPosition ? { ...track, playing: true } : track
        ))
      }
      return
    }

    // If no audio for this deck, create one for the target track
    if (!targetTrack?.audioFile) {
      alert(`No track loaded on ${targetPosition} deck. Please load an MP3 file first.`)
      return
    }

    // Create new audio for this deck
    const newAudio = new Audio(targetTrack.audioFile)
    newAudio.volume = targetPosition === 'left' ? leftTrackVolume : rightTrackVolume

    // Set up event listeners
    newAudio.addEventListener('timeupdate', () => {
      const progressData = {
        currentTime: newAudio.currentTime,
        duration: newAudio.duration || 0
      }

      if (targetPosition === 'left') {
        setLeftSongProgress(progressData)
      } else {
        setRightSongProgress(progressData)
      }

      setTracks(prev => prev.map(t =>
        t.position === targetPosition
          ? { ...t, currentTime: newAudio.currentTime }
          : t
      ))
    })

    newAudio.addEventListener('loadedmetadata', () => {
      const progressData = {
        currentTime: 0,
        duration: newAudio.duration || 0
      }

      if (targetPosition === 'left') {
        setLeftSongProgress(progressData)
      } else {
        setRightSongProgress(progressData)
      }
    })

    newAudio.addEventListener('ended', () => {
      // Track ended - stop playing state for this deck only
      setTracks(prev => prev.map(track =>
        track.position === targetPosition ? { ...track, playing: false } : track
      ))

      const endProgressData = { currentTime: 0, duration: newAudio.duration || 0 }
      if (targetPosition === 'left') {
        setLeftSongProgress(endProgressData)
      } else {
        setRightSongProgress(endProgressData)
      }
    })

    // Set this as the deck audio and start playing
    setDeckAudio(newAudio)
    newAudio.play().catch(console.error)

    // Update track states
    setTracks(prev => prev.map(track =>
      track.position === targetPosition ? { ...track, playing: true } : track
    ))
  }, [currentDeck, leftDeckAudio, rightDeckAudio, tracks, leftTrackVolume, rightTrackVolume])

  const nextTrack = useCallback(() => {
    if (loadedTracks.length === 0) return

    const nextIndex = (currentTrackIndex + 1) % loadedTracks.length
    setCurrentTrackIndex(nextIndex)
    const nextTrackData = loadedTracks[nextIndex]

    // Update the current deck with the new track (don't change playing state)
    setTracks(prev => prev.map(track =>
      track.position === currentDeck ? { ...nextTrackData, position: currentDeck, playing: false } : track
    ))

    // Stop current deck audio if playing
    const deckAudio = currentDeck === 'left' ? leftDeckAudio : rightDeckAudio
    const setDeckAudio = currentDeck === 'left' ? setLeftDeckAudio : setRightDeckAudio

    if (deckAudio) {
      deckAudio.pause()
      deckAudio.currentTime = 0
      setDeckAudio(null)
    }

    // Reset progress for the current deck
    if (currentDeck === 'left') {
      setLeftSongProgress({ currentTime: 0, duration: 0 })
    } else {
      setRightSongProgress({ currentTime: 0, duration: 0 })
    }
  }, [loadedTracks, currentTrackIndex, currentDeck, leftDeckAudio, rightDeckAudio])

  const prevTrack = useCallback(() => {
    if (loadedTracks.length === 0) return

    const prevIndex = currentTrackIndex === 0 ? loadedTracks.length - 1 : currentTrackIndex - 1
    setCurrentTrackIndex(prevIndex)
    const prevTrackData = loadedTracks[prevIndex]

    // Update the current deck with the new track (don't change playing state)
    setTracks(prev => prev.map(track =>
      track.position === currentDeck ? { ...prevTrackData, position: currentDeck, playing: false } : track
    ))

    // Stop current deck audio if playing
    const deckAudio = currentDeck === 'left' ? leftDeckAudio : rightDeckAudio
    const setDeckAudio = currentDeck === 'left' ? setLeftDeckAudio : setRightDeckAudio

    if (deckAudio) {
      deckAudio.pause()
      deckAudio.currentTime = 0
      setDeckAudio(null)
    }

    // Reset progress for the current deck
    if (currentDeck === 'left') {
      setLeftSongProgress({ currentTime: 0, duration: 0 })
    } else {
      setRightSongProgress({ currentTime: 0, duration: 0 })
    }
  }, [loadedTracks, currentTrackIndex, currentDeck, leftDeckAudio, rightDeckAudio])

  const handleVinylClick = useCallback((position: 'left' | 'right') => {
    const track = tracks.find(t => t.position === position)
    if (!track?.audioFile) {
      setCurrentDeck(position)
      fileInputRef.current?.click()
      return
    }

    // Toggle play/pause for the specific deck
    togglePlayPause(position)
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
        const willBeMuted = !newMuted[pad.channel]
        newMuted[pad.channel] = willBeMuted

        // Pause or resume all active audio in this channel
        pads.forEach(p => {
          if (p.channel === pad.channel && p.active && p.soundFile) {
            const audio = audioElements.get(p.soundFile)
            if (audio) {
              if (willBeMuted) {
                audio.pause()
              } else {
                audio.play().catch(console.error)
              }
            }
          }
        })

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
  }, [stopAudio, playAudio, mutedChannels, pads, audioElements])

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

      // Handle AI toggle with + key
      if ((key === '+' || key === '=') && !event.repeat) {
        event.preventDefault()
        setShowAI(prev => !prev)
        return
      }

      // Handle crossfader controls with [ and ]
      if (key === '[') {
        event.preventDefault()
        setCrossfaderPosition(prev => Math.max(0, prev - 0.1)) // Move left
        return
      }

      if (key === ']') {
        event.preventDefault()
        setCrossfaderPosition(prev => Math.min(1, prev + 0.1)) // Move right
        return
      }

      // Handle deck-specific playback controls
      if (key === '9') {
        event.preventDefault()
        togglePlayPause('left')
        return
      }

      if (key === 'o') {
        event.preventDefault()
        togglePlayPause('right')
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
    <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-4">
      {/* Dual Progress Bars */}
      <SongProgress
        leftProgress={leftSongProgress}
        rightProgress={rightSongProgress}
        leftPlaying={tracks.find(t => t.position === 'left')?.playing || false}
        rightPlaying={tracks.find(t => t.position === 'right')?.playing || false}
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

      {/* Crossfader - Below logo */}
      <div className="flex flex-col items-center mb-6">
        <div className="text-white text-xs mb-2 futuristic-font">CROSSFADER</div>
        <div className="relative w-64 h-4 bg-gray-800 rounded-full">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={crossfaderPosition}
            onChange={(e) => setCrossfaderPosition(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer"
          />
          <div
            className="absolute w-6 h-6 bg-white rounded-full border-2 border-gray-600 pointer-events-none transform -translate-y-1"
            style={{
              left: `${crossfaderPosition * (256 - 24)}px`
            }}
          />
        </div>
        <div className="flex justify-between w-full mt-1 text-[10px] text-gray-400">
          <div className="flex flex-col items-center">
            <span>LEFT</span>
            {shiftPressed && (
              <kbd className="px-1 py-0.5 bg-gray-700 rounded text-[8px] text-white mt-1">[</kbd>
            )}
          </div>
          <span className="text-gray-300 text-xs">
            {crossfaderPosition < 0.4 ? 'LEFT' : crossfaderPosition > 0.6 ? 'RIGHT' : 'CENTER'}
          </span>
          <div className="flex flex-col items-center">
            <span>RIGHT</span>
            {shiftPressed && (
              <kbd className="px-1 py-0.5 bg-gray-700 rounded text-[8px] text-white mt-1">]</kbd>
            )}
          </div>
        </div>
      </div>

      {/* AI Section */}
      <AISection
        onSongRequest={handleSongRequest}
        onCancelRequest={handleCancelRequest}
        isSearching={aiSearching}
        isVisible={showAI}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,audio/mp3"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, currentDeck)}
      />

      <div className="flex items-center justify-center w-full max-w-[1600px] gap-4 xl:gap-8 flex-wrap lg:flex-nowrap">
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
              <span>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-white text-xs futuristic-font">+</kbd> for AI</span>
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
                <h3 className="font-semibold text-white mb-2">Deck Controls:</h3>
                <ul className="space-y-1 ml-4">
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">9</kbd> Play/Pause left deck</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">O</kbd> Play/Pause right deck</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">L</kbd> Next track</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">.</kbd> Toggle queue</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">~</kbd> Toggle BPM guide</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Crossfader Controls:</h3>
                <ul className="space-y-1 ml-4">
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">[</kbd> Move crossfader left</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">]</kbd> Move crossfader right</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">AI Assistant:</h3>
                <ul className="space-y-1 ml-4">
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">+</kbd> Toggle AI assistant menu</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">-</kbd> Toggle voice listening (when AI open)</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Backspace</kbd> Cancel AI search</li>
                  <li>• Say "Can you play [song name]" to search and download</li>
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

        {/* Current playing songs info */}
        {(() => {
          const playingTracks = tracks.filter(t => t.playing)
          return playingTracks.length > 0 ? (
            <div className="mb-4 space-y-2">
              {playingTracks.map(track => (
                <div key={track.id} className={`p-3 rounded border ${
                  track.position === 'left' ? 'bg-orange-600/20 border-orange-500/30' : 'bg-purple-600/20 border-purple-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-white font-medium text-sm truncate">{track.title}</div>
                    <div className="text-xs text-gray-300 uppercase">{track.position}</div>
                  </div>
                  <div className="text-gray-300 text-xs truncate">{track.artist}</div>
                  <div className="text-green-400 text-xs mt-1 flex items-center justify-between">
                    <div className="flex items-center">
                      <Volume2 size={10} className="mr-1" />
                      {track.analyzing ? 'Analyzing...' : `${track.bpm} BPM`}
                    </div>
                    <div className="text-cyan-400">
                      {track.analyzing ? '...' : `Key: ${track.key}`}
                    </div>
                  </div>
                  <div className="text-green-400 text-xs">• Playing</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-4 p-3 bg-gray-800/50 rounded">
              <div className="text-gray-400 text-xs">No tracks playing</div>
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
                onClick={() => togglePlayPause()}
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
                <div className="flex items-center justify-between mt-1">
                  <div className="text-gray-500 text-xs">
                    {song.analyzing ? 'Analyzing...' : `${song.bpm} BPM • ${song.key}`}
                  </div>
                  <div className="text-xs">
                    {index === currentTrackIndex && tracks.find(t => t.playing) && (
                      <span className="text-green-400">● Playing</span>
                    )}
                    {index === currentTrackIndex && !tracks.find(t => t.playing) && (
                      <span className="text-yellow-400">● Current</span>
                    )}
                  </div>
                </div>
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
