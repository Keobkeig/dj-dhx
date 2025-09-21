import React from "react";
import type { CSSProperties } from 'react';
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
import { DndContext, useDroppable, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, pointerWithin } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { useDraggable } from '@dnd-kit/core'
import type { DragEndEvent, Modifier } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import MiniVinylRecord from './components/MiniVinylRecord'

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
  const [confirmTrack, setConfirmTrack] = useState<Track | null>(null)
  const [confirmCountdown, setConfirmCountdown] = useState<number>(0)
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
  const [queue, setQueue] = useState<Track[]>([])
  const [recentlyFinished, setRecentlyFinished] = useState<Track[]>([])
  const [leftDeckAudio, setLeftDeckAudio] = useState<HTMLAudioElement | null>(null)
  const [rightDeckAudio, setRightDeckAudio] = useState<HTMLAudioElement | null>(null)
  const [showBpmGuide, setShowBpmGuide] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentDeck, setCurrentDeck] = useState<'left' | 'right'>('left')
  const [dragging, setDragging] = useState<{ track?: Track } | null>(null)
  const [queueInsertIndex, setQueueInsertIndex] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );
  const [queueSlotOver, setQueueSlotOver] = useState<number | null>(null);
  const CONFIRM_SECONDS = 5
  
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
  const dragAnchorRef = useRef<{x:number; y:number} | null>(null)
  const centerOverlayAtPointer: Modifier = ({ transform, overlayNodeRect }) => {
    const anchor = dragAnchorRef.current;
    if (!anchor || !overlayNodeRect) return transform;

    // Move the overlay so its CENTER sits at the pointer
    return {
      ...transform,
      x: transform.x + anchor.x - overlayNodeRect.width / 2,
      y: transform.y + anchor.y - overlayNodeRect.height / 2,
    };
  };


  useEffect(() => {
    if (!confirmTrack) return
    if (confirmCountdown <= 0) {
      // auto-confirm
      setQueue(prev => (prev.some(t => t.id === confirmTrack.id) ? prev : [...prev, confirmTrack]))
      setConfirmTrack(null)
      return
    }
    const t = setTimeout(() => setConfirmCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [confirmTrack, confirmCountdown, setQueue])

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
      setConfirmTrack(newTrack)
      setConfirmCountdown(CONFIRM_SECONDS)


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

  const confirmAddToQueue = () => {
    if (!confirmTrack) return
    setQueue(prev => (prev.some(t => t.id === confirmTrack.id) ? prev : [...prev, confirmTrack]))
    setConfirmTrack(null)
    setConfirmCountdown(0)
  }

  const cancelAddToQueue = () => {
    setConfirmTrack(null)
    setConfirmCountdown(0)
  }


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
            setQueue(prev => {
              const existing = new Set(prev.map(t => t.id))
              const toAdd = newTracks.filter(t => !existing.has(t.id))
              return [...prev, ...toAdd]
            })
            if (newTracks.length > 0) {
              const firstTrack = newTracks[0]
              setTracks(prev => prev.map(track =>
                track.position === position
                  ? { ...firstTrack, position, playing: false }
                  : track
              ))

              setQueue(prev => prev.filter(t => t.id !== firstTrack.id))

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
          track.position === targetPosition ? { ...track, playing: false } : track
        ))
      }
      return
    }

    // If no audio for this deck, create one for the target track
    if (!targetTrack?.audioFile) {
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
    // 1. Move to Recently Finished
    setRecentlyFinished(prev => {
      const withoutDup = prev.filter(t => t.id !== targetTrack!.id);
      return [targetTrack!, ...withoutDup].slice(0, 5);
    });

    // 2. Get the next item from queue
    setQueue(prevQueue => {
      if (prevQueue.length === 0) {
        // Nothing to play next, clear deck
        setTracks(prev =>
          prev.map(track =>
            track.position === targetPosition
              ? {
                  ...track,
                  playing: false,
                  title: 'Load MP3 File',
                  artist: 'Click to browse',
                  audioFile: undefined,
                }
              : track
          )
        );
        if (targetPosition === 'left') {
          setLeftDeckAudio(null);
          setLeftSongProgress({ currentTime: 0, duration: 0 });
        } else {
          setRightDeckAudio(null);
          setRightSongProgress({ currentTime: 0, duration: 0 });
        }
        return prevQueue;
      }

      const [nextUp, ...rest] = prevQueue;

      // Set new track onto deck
      setTracks(prev =>
        prev.map(t =>
          t.position === targetPosition
            ? { ...nextUp, position: targetPosition, playing: false }
            : t
        )
      );

      // Start playing it
      const nextAudio = new Audio(nextUp.audioFile!);
      nextAudio.addEventListener('timeupdate', () => {
        if (targetPosition === 'left') {
          setLeftSongProgress({
            currentTime: nextAudio.currentTime,
            duration: nextAudio.duration || 0,
          });
        } else {
          setRightSongProgress({
            currentTime: nextAudio.currentTime,
            duration: nextAudio.duration || 0,
          });
        }
      });

      nextAudio.addEventListener('loadedmetadata', () => {
        const dur = nextAudio.duration || 0;
        if (targetPosition === 'left') {
          setLeftSongProgress({ currentTime: 0, duration: dur });
        } else {
          setRightSongProgress({ currentTime: 0, duration: dur });
        }
      });

      nextAudio.addEventListener('ended', () => {
        newAudio.dispatchEvent(new Event('ended'));
      });

      if (targetPosition === 'left') {
        setLeftDeckAudio(nextAudio);
      } else {
        setRightDeckAudio(nextAudio);
      }

      return rest;
    });
  });

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

  useEffect(() => {
    // Is either deck empty?
    const leftEmpty  = !tracks.find(t => t.position === 'left')?.audioFile;
    const rightEmpty = !tracks.find(t => t.position === 'right')?.audioFile;

    if ((!leftEmpty && !rightEmpty) || queue.length === 0) return;

    // Work on local copies so we can commit one setQueue + one setTracks
    const newQueue = [...queue];
    const replacements: Partial<Record<'left' | 'right', Track>> = {};

    if (leftEmpty && newQueue.length > 0) {
      replacements.left = newQueue.shift()!;
    }
    if (rightEmpty && newQueue.length > 0) {
      replacements.right = newQueue.shift()!;
    }

    // If we filled anything, commit updates (stay paused: playing=false; no audio elements created)
    if (replacements.left || replacements.right) {
      setTracks(prev =>
        prev.map(tr => {
          if (replacements.left && tr.position === 'left') {
            return { ...replacements.left, position: 'left', playing: false };
          }
          if (replacements.right && tr.position === 'right') {
            return { ...replacements.right, position: 'right', playing: false };
          }
          return tr;
        })
      );
      setQueue(newQueue);

      // Ensure deck audios are cleared when replacing an empty slot (defensive)
      if (leftEmpty && leftDeckAudio) {
        leftDeckAudio.pause();
        setLeftDeckAudio(null);
        setLeftSongProgress({ currentTime: 0, duration: 0 });
      }
      if (rightEmpty && rightDeckAudio) {
        rightDeckAudio.pause();
        setRightDeckAudio(null);
        setRightSongProgress({ currentTime: 0, duration: 0 });
      }
    }
  }, [queue, tracks, leftDeckAudio, rightDeckAudio]);

  useEffect(() => {
    // Is either deck empty?
    const leftEmpty  = !tracks.find(t => t.position === 'left')?.audioFile;
    const rightEmpty = !tracks.find(t => t.position === 'right')?.audioFile;

    if ((!leftEmpty && !rightEmpty) || queue.length === 0) return;

    // Work on local copies so we can commit one setQueue + one setTracks
    const newQueue = [...queue];
    const replacements: Partial<Record<'left' | 'right', Track>> = {};

    if (leftEmpty && newQueue.length > 0) {
      replacements.left = newQueue.shift()!;
    }
    if (rightEmpty && newQueue.length > 0) {
      replacements.right = newQueue.shift()!;
    }

    // If we filled anything, commit updates (stay paused: playing=false; no audio elements created)
    if (replacements.left || replacements.right) {
      setTracks(prev =>
        prev.map(tr => {
          if (replacements.left && tr.position === 'left') {
            return { ...replacements.left, position: 'left', playing: false };
          }
          if (replacements.right && tr.position === 'right') {
            return { ...replacements.right, position: 'right', playing: false };
          }
          return tr;
        })
      );
      setQueue(newQueue);

      // Ensure deck audios are cleared when replacing an empty slot (defensive)
      if (leftEmpty && leftDeckAudio) {
        leftDeckAudio.pause();
        setLeftDeckAudio(null);
        setLeftSongProgress({ currentTime: 0, duration: 0 });
      }
      if (rightEmpty && rightDeckAudio) {
        rightDeckAudio.pause();
        setRightDeckAudio(null);
        setRightSongProgress({ currentTime: 0, duration: 0 });
      }
    }
  }, [queue, tracks, leftDeckAudio, rightDeckAudio]);

  // Initialize 8x8 grid with sounds + stop/mute, new keyRows mapping
  useEffect(() => {
    const initialPads: Pad[] = []

    // Updated keyRows for all 8 rows (including MUTE)
    const keyRows = [
      ['1', '2', '3', '4', '5', '6', '7', '8'],      // Row 0
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i'],      // Row 1
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'],      // Row 2
      ['z', 'x', 'c', 'v', 'b', 'n', 'm', ','],      // Row 3
      ['!', '@', '#', '$', '%', '^', '&', '*'],      // Row 4
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I'],      // Row 5
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K'],      // Row 6
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '<']       // Row 7
    ]

    // Organized sound mappings - Coffee Shop (loops) + Pharrell (one-shots)
    // Columns 0-3: DRUMS | Columns 4-5: MELODIC | Column 6: BASS | Column 7: FULL SONGS
    const allSounds = {
      // Column 0: Kicks (Orange - DRUMS)
      kicks: [
        '/Coffee Shop Loop Kit/Pine Cones - 87 BPM/Pine Cones - 87 BPM Kick.wav',
        '/Coffee Shop Loop Kit/Groovy Vynil - 94 BPM/Groovy Vynil - 94 BPM Kicks.wav',
        '/Coffee Shop Loop Kit/Simple Things - 94 BPM/Simple Things - 94 BPM Kick.wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Open Hats/Open Hat (ariana).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Open Hats/Open Hat (Mariah).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Open Hats/Open Hat (Mariah-2).wav',
        '/Coffee Shop Loop Kit/Febuary - 78 BPM/Febuary - 78 BPM Kick.mp3'
      ],

      // Column 1: Snares (Orange - DRUMS)
      snares: [
        '/Coffee Shop Loop Kit/Pine Cones - 87 BPM/Pine Cones - 87 BPM Snare.wav',
        '/Coffee Shop Loop Kit/Groovy Vynil - 94 BPM/Groovy Vynil - 94 BPM Snare.wav',
        '/Coffee Shop Loop Kit/Simple Things - 94 BPM/Simple Things - 94 BPM Snare.wav',
        '/Coffee Shop Loop Kit/Febuary - 78 BPM/Febuary - 78 BPM Snare.wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Snaps/Snap (Ariana).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Snaps/Snap (Ariana-2).wav',
        '/Coffee Shop Loop Kit/Groovy Vynil - 94 BPM/Groovy Vynil - 94 BPM Snare.wav'
      ],

      // Column 2: Hats (Orange - DRUMS)
      hats: [
        '/Coffee Shop Loop Kit/Pine Cones - 87 BPM/Pine Cones - 87 BPM Hats.wav',
        '/Coffee Shop Loop Kit/Groovy Vynil - 94 BPM/Groovy Vynil - 94 BPM Hats.wav',
        '/Coffee Shop Loop Kit/Simple Things - 94 BPM/Simple Things - 94 BPM Hats.wav',
        '/Coffee Shop Loop Kit/Febuary - 78 BPM/Febuary - 78 BPM Hats.wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (Neptunes).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (ariana).wav',
        '/Coffee Shop Loop Kit/Groovy Vynil - 94 BPM/Groovy Vynil - 94 BPM Hats.wav'
      ],

      // Column 3: Percussion (Orange - DRUMS)
      percussion: [
        '/Coffee Shop Loop Kit/Pine Cones - 87 BPM/Pine Cones - 87 BPM Perc.wav',
        '/Coffee Shop Loop Kit/Train Station - C Major 103 BPM/Train Station - C Major 103 BPM Perc.wav',
        '/Coffee Shop Loop Kit/Febuary - 78 BPM/Febuary - 78 BPM Perc.wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Percussion/Blocks/Kitchen Sound (Madonna-1).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Percussion/Blocks/Kitchen Sound (Madonna-2).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Percussion/Blocks/Kitchen Sound (Madonna-3).wav',
        '/Coffee Shop Loop Kit/Blanket - C Major 92 BPM/Blanket - C Major 92 BPM Bells.wav'
      ],

      // Column 4: Keys/Piano (Purple - MELODIC)
      keys: [
        '/Coffee Shop Loop Kit/Foggy Dreams - C Major 85 BPM/Foggy Dreams - C Major 85 BPM Epiano.wav',
        '/Coffee Shop Loop Kit/Train Station - C Major 103 BPM/Train Station - C Major 103 BPM Music Box.wav',
        '/Coffee Shop Loop Kit/Train Station - C Major 103 BPM/Train Station - C Major 103 BPM Trumpet.wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Percussion/Timpani (Movie).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (By Your Side).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (Ed session).wav',
        '/Coffee Shop Loop Kit/Foggy Dreams - C Major 85 BPM/Foggy Dreams - C Major 85 BPM Pad.mp3'
      ],

      // Column 5: Bells/Synths (Purple - MELODIC)
      bells: [
        '/Coffee Shop Loop Kit/Blanket - C Major 92 BPM/Blanket - C Major 92 BPM Bells.wav',
        '/Coffee Shop Loop Kit/Blanket - C Major 92 BPM/Blanket - C Major 92 BPM Distorted Synth.wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (Mariah).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (ODB session - 1998).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (for sweetener album).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (ariana-2).wav',
        '/Coffee Shop Loop Kit/Blanket - C Major 92 BPM/Blanket - C Major 92 BPM Distorted Synth.wav'
      ],

      // Column 6: Bass/Low End (Green - BASS)
      bass: [
        '/Coffee Shop Loop Kit/Febuary - 78 BPM/Febuary - 78 BPM No Texture.wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (Mariah-2).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (Solange session).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Closed Hats/Hat (Jay Z).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Percussion/Timpani (Movie).wav',
        '/Pharell Williams Drums/Pharrell Williams Production Kit (Organized)/Drums/Snaps/Snap (Ariana).wav',
        '/Coffee Shop Loop Kit/Hot Pot Coffee - C# Major 85 BPM/Hot Pot Coffee - C# Major 85 BPM Pad.wav'
      ],

      // Column 7: Full Songs (Cyan - FULL TRACKS)
      fullSongs: [
        '/Coffee Shop Loop Kit/Pine Cones - 87 BPM/Pine Cones - 87 BPM Full.wav',
        '/Coffee Shop Loop Kit/Groovy Vynil - 94 BPM/Groovy Vynil - 94 BPM Full.wav',
        '/Coffee Shop Loop Kit/Simple Things - 94 BPM/Simple Things - 94 BPM Full.wav',
        '/Coffee Shop Loop Kit/Febuary - 78 BPM/Febuary - 78 BPM Full.wav',
        '/Coffee Shop Loop Kit/Train Station - C Major 103 BPM/Train Station - C Major 103 BPM Full.wav',
        '/Coffee Shop Loop Kit/Blanket - C Major 92 BPM/Blanket - C Major 92 BPM Full.wav',
        '/Coffee Shop Loop Kit/Hot Pot Coffee - C# Major 85 BPM/Hot Pot Coffee - C# Major 85 BPM Full.wav'
      ]
    }


    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        let soundType: PadType
        let soundFile: string | null = null
        let keyBinding = ''
        let label = ''

        if (row === 7) {
          // Row 7: MUTE pads for each column
          soundType = 'mute'
          label = 'MUTE'
        } else {
          // Rows 0-6: 56 sounds (7 rows × 8 columns)
          const soundIndex = row * 8 + col

          // Organized Coffee Shop + Pharrell by sound type
          if (col === 0) {
            // Column 0: Kicks (Orange - DRUMS)
            soundType = 'drums'
            const kickIndex = row % allSounds.kicks.length
            soundFile = allSounds.kicks[kickIndex]
            const fileName = soundFile.split('/').pop()?.replace('.wav', '') || `KICK ${kickIndex + 1}`
            label = fileName.replace(/.*BPM\s/, '').replace(/\(.*?\)/g, '').trim() || `KICK ${kickIndex + 1}`
          } else if (col === 1) {
            // Column 1: Snares (Orange - DRUMS)
            soundType = 'drums'
            const snareIndex = row % allSounds.snares.length
            soundFile = allSounds.snares[snareIndex]
            const fileName = soundFile.split('/').pop()?.replace('.wav', '') || `SNARE ${snareIndex + 1}`
            label = fileName.replace(/.*BPM\s/, '').replace(/\(.*?\)/g, '').trim() || `SNARE ${snareIndex + 1}`
          } else if (col === 2) {
            // Column 2: Hats (Orange - DRUMS)
            soundType = 'drums'
            const hatIndex = row % allSounds.hats.length
            soundFile = allSounds.hats[hatIndex]
            const fileName = soundFile.split('/').pop()?.replace('.wav', '') || `HATS ${hatIndex + 1}`
            label = fileName.replace(/.*BPM\s/, '').replace(/\(.*?\)/g, '').trim() || `HATS ${hatIndex + 1}`
          } else if (col === 3) {
            // Column 3: Percussion (Orange - DRUMS)
            soundType = 'drums'
            const percIndex = row % allSounds.percussion.length
            soundFile = allSounds.percussion[percIndex]
            const fileName = soundFile.split('/').pop()?.replace('.wav', '') || `PERC ${percIndex + 1}`
            label = fileName.replace(/.*BPM\s/, '').replace(/\(.*?\)/g, '').trim() || `PERC ${percIndex + 1}`
          } else if (col === 4) {
            // Column 4: Keys/Piano (Purple - MELODIC)
            soundType = 'melodic'
            const keyIndex = row % allSounds.keys.length
            soundFile = allSounds.keys[keyIndex]
            const fileName = soundFile.split('/').pop()?.replace('.wav', '') || `KEYS ${keyIndex + 1}`
            label = fileName.replace(/.*BPM\s/, '').replace(/\(.*?\)/g, '').trim() || `KEYS ${keyIndex + 1}`
          } else if (col === 5) {
            // Column 5: Bells/Synths (Purple - MELODIC)
            soundType = 'melodic'
            const bellIndex = row % allSounds.bells.length
            soundFile = allSounds.bells[bellIndex]
            const fileName = soundFile.split('/').pop()?.replace('.wav', '') || `BELLS ${bellIndex + 1}`
            label = fileName.replace(/.*BPM\s/, '').replace(/\(.*?\)/g, '').trim() || `BELLS ${bellIndex + 1}`
          } else if (col === 6) {
            // Column 6: Bass/Low End (Green - BASS)
            soundType = 'bass'
            const bassIndex = row % allSounds.bass.length
            soundFile = allSounds.bass[bassIndex]
            const fileName = soundFile.split('/').pop()?.replace('.wav', '') || `BASS ${bassIndex + 1}`
            label = fileName.replace(/.*BPM\s/, '').replace(/\(.*?\)/g, '').trim() || `BASS ${bassIndex + 1}`
          } else {
            // Column 7: Full Songs (Cyan - FULL TRACKS)
            soundType = 'fx'
            const fullIndex = row % allSounds.fullSongs.length
            soundFile = allSounds.fullSongs[fullIndex]
            const fileName = soundFile.split('/').pop()?.replace('.wav', '') || `FULL ${fullIndex + 1}`
            label = fileName.replace(/.*BPM\s/, '').replace(' Full', '').replace(/\(.*?\)/g, '').trim() || `FULL ${fullIndex + 1}`
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
          isOneShot: (soundType === 'fx' || soundType === 'vocal') &&
                     !(soundFile && soundFile.includes('Full.wav')) ||
                     (soundFile && soundFile.includes('/Pharell Williams Drums/')),
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

    if (pad.type === 'mute') {
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
          // Stop all other loop pads in the same column (not mute pads or one-shots)
          if (p.channel === pad.channel && p.type !== 'mute' && p.id !== pad.id && p.active && !p.isOneShot) {
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

      // Handle track seeking controls with arrow keys
      if (key === 'arrowleft') {
        event.preventDefault()
        // Go to beginning of left track
        if (leftDeckAudio) {
          leftDeckAudio.currentTime = 0
        }
        return
      }

      if (key === 'arrowright') {
        event.preventDefault()
        // Go to end of left track
        if (leftDeckAudio && leftDeckAudio.duration) {
          leftDeckAudio.currentTime = leftDeckAudio.duration - 1
        }
        return
      }

      if (key === 'arrowdown') {
        event.preventDefault()
        // Go to beginning of right track
        if (rightDeckAudio) {
          rightDeckAudio.currentTime = 0
        }
        return
      }

      if (key === 'arrowup') {
        event.preventDefault()
        // Go to end of right track
        if (rightDeckAudio && rightDeckAudio.duration) {
          rightDeckAudio.currentTime = rightDeckAudio.duration - 1
        }
        return
      }

      // Handle crossfader controls with [ and ]
      if (key === '[') {
        event.preventDefault()
        setCrossfaderPosition(prev => Math.max(0, prev - 0.2)) // Move left
        return
      }

      if (key === ']') {
        event.preventDefault()
        setCrossfaderPosition(prev => Math.min(1, prev + 0.2)) // Move right
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
}, [
  pads,
  handlePadClick,
  togglePlayPause,
  nextTrack,      
  pauseAllAudio,  
  resumeAllAudio, 
  setCrossfaderPosition,
  setShowHelp,          
  setShowQueue,         
  setShowBpmGuide,      
  setShowAI             
])

  const getPadColor = (pad: Pad): string => {
    // Vibrant colors for each sound type
    const baseColors = {
      drums: shiftPressed ? 'bg-orange-700' : 'bg-orange-500',
      bass: shiftPressed ? 'bg-green-700' : 'bg-green-500',
      melodic: shiftPressed ? 'bg-purple-700' : 'bg-purple-500',
      fx: shiftPressed ? 'bg-cyan-700' : 'bg-cyan-500',
      vocal: shiftPressed ? 'bg-pink-700' : 'bg-pink-500',
      perc: shiftPressed ? 'bg-yellow-700' : 'bg-yellow-500',
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
    if (mutedChannels[pad.channel] && pad.type !== 'mute') {
      colorClass += ' opacity-50'
    }

    return colorClass
  }

  function DeckDropZone({
    id,
    children
  }: { id: 'deck-left' | 'deck-right'; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id })
    return (
      <div ref={setNodeRef} className={isOver ? 'ring-2 ring-blue-500 rounded-lg' : ''}>
        {children}
      </div>
    )
  }

  function SortableQueueItem({
    track,
    index
  }: { track: Track; index: number }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
      useSortable({
        id: track.id,
        data: { from: 'queue', index, track },
        // Prevent dnd-kit from animating layout shifts while sorting
        animateLayoutChanges: () => false,
      })
      const style: CSSProperties = {
        // keep the original row fully visible and stationary during drag
        opacity: 1
        // (intentionally omit transform/transition so there is no live preview)
      };

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="w-full max-w-full min-w-0 overflow-hidden p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 cursor-grab select-none border border-transparent box-border"
        title={`${track.title} — ${track.artist}`}
      >
        <div className="text-white text-sm font-medium truncate whitespace-nowrap min-w-0 block">{track.title}</div>
        <div className="text-gray-400 text-xs truncate whitespace-nowrap min-w-0 block">{track.artist}</div>
        <div className="text-gray-500 text-xs">{track.bpm} BPM • {track.key}</div>
      </div>
    )
  }

  function findQueueIndexById(id: string) {
    return queue.findIndex(t => t.id === id)
  }

  function replaceDeck(
    deck: 'left' | 'right',
    newTrack: Track
  ) {
    // stop current deck audio if necessary
    const deckAudio = deck === 'left' ? leftDeckAudio : rightDeckAudio
    const setDeckAudio = deck === 'left' ? setLeftDeckAudio : setRightDeckAudio

    if (deckAudio) {
      deckAudio.pause()
      deckAudio.currentTime = 0
      setDeckAudio(null)
    }

    // replace the deck's track (not auto-play)
    setTracks(prev => prev.map(t =>
      t.position === deck ? { ...newTrack, position: deck, playing: false } : t
    ))
  }

  function stopDeckAndReturnToQueue(deck: 'left' | 'right', insertIndex?: number) {
    const deckTrack = tracks.find(t => t.position === deck)
    if (!deckTrack) return

    const deckAudio = deck === 'left' ? leftDeckAudio : rightDeckAudio
    const setDeckAudio = deck === 'left' ? setLeftDeckAudio : setRightDeckAudio

    if (deckAudio) {
      deckAudio.pause()
      deckAudio.currentTime = 0
      setDeckAudio(null)
    }

    // ✅ Clear the deck so this track no longer counts as “on a deck”
    //    (this makes it show up in the queue UI)
    setTracks(prev => prev.map(t =>
      t.position === deck ? makeEmptyDeckTrack(deck) : t
    ))

    // Insert into queue at desired position (dedup)
    setQueue(prev => {
      const existing = prev.filter(t => t.id !== deckTrack.id)
      if (insertIndex == null || insertIndex < 0 || insertIndex > existing.length) {
        return [...existing, deckTrack]
      }
      return [
        ...existing.slice(0, insertIndex),
        deckTrack,
        ...existing.slice(insertIndex),
      ]
    })
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    dragAnchorRef.current = null
    setDragging(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const from = active.data?.current?.from as
      | 'queue'
      | 'deck-left'
      | 'deck-right'
      | 'finished'          // <-- include finished as a possible source
      | undefined

    const dataAny = active.data?.current as any
    const trackId =
      dataAny?.trackId ??
      dataAny?.track?.id ??
      null
    // DraggableDeckItem is already disabled when no song, so no need to early-return here.
    // If you still want a guard, ensure it respects either form:
    if ((from === 'deck-left' || from === 'deck-right') && !trackId) {
      // unexpected; bail safely
      return
    }

    const findQueueIndexById = (id: string) => queue.findIndex(t => t.id === id)

    // 1) Reorder within queue
    if (from === 'queue' && queue.some(t => t.id === activeId) && queue.some(t => t.id === overId)) {
      const oldIndex = findQueueIndexById(activeId)
      const newIndex = findQueueIndexById(overId)
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        setQueue(prev => arrayMove(prev, oldIndex, newIndex))
      }
      return
    }

    // 2) Queue -> Deck
    if (from === 'queue' && (overId === 'deck-left' || overId === 'deck-right')) {
      const idx = findQueueIndexById(activeId)
      if (idx >= 0) {
        const track = queue[idx]
        replaceDeck(overId === 'deck-left' ? 'left' : 'right', track)
        setQueue(prev => prev.filter(t => t.id !== track.id))
      }
      return
    }

    // 3) Deck -> Queue (drop on container to append)
    if ((from === 'deck-left' || from === 'deck-right') && overId === 'queue-dropzone') {
      const insertAt = (queueInsertIndex ?? queue.length);   // <— changed
      stopDeckAndReturnToQueue(from === 'deck-left' ? 'left' : 'right', insertAt);
      return;
    }

    if (from === 'finished') {
      const draggedId = trackId ?? activeId;
      const dragged = recentlyFinished.find(t => t.id === draggedId);
      if (!dragged) return;

      if (overId === 'queue-dropzone') {
        const insertAt = (queueInsertIndex ?? visibleQueue.length); // <— changed
        setQueue(prev => {
          const withoutDup = prev.filter(t => t.id !== dragged.id);
          const clamped = Math.max(0, Math.min(insertAt, withoutDup.length));
          return [
            ...withoutDup.slice(0, clamped),
            dragged,
            ...withoutDup.slice(clamped),
          ];
        });
        return;
      }
      // (drop-on-item case below stays the same)
    }

    // 3b) Deck -> Queue (drop on item to insert)
    if ((from === 'deck-left' || from === 'deck-right') && queue.some(t => t.id === overId)) {
      const insertIndex = findQueueIndexById(overId)
      stopDeckAndReturnToQueue(from === 'deck-left' ? 'left' : 'right', insertIndex)
      return
    }

    // === NEW: Finished -> Queue ===
    if (from === 'finished') {
      const draggedId = trackId ?? activeId
      const dragged = recentlyFinished.find(t => t.id === draggedId)
      if (!dragged) return

      // Drop on container: append to end (dedup)
      if (overId === 'queue-dropzone') {
        setQueue(prev => {
          if (prev.some(t => t.id === dragged.id)) return prev
          return [...prev, dragged]
        })
        return
      }

      // Drop on a specific queue item: insert before it (dedup)
      if (queue.some(t => t.id === overId)) {
        const insertIndex = findQueueIndexById(overId)
        if (insertIndex < 0) return
        setQueue(prev => {
          const withoutDup = prev.filter(t => t.id !== dragged.id)
          return [
            ...withoutDup.slice(0, insertIndex),
            dragged,
            ...withoutDup.slice(insertIndex),
          ]
        })
        return
      }
    }
  }, [queue, recentlyFinished, replaceDeck, stopDeckAndReturnToQueue])


  function DraggableFinishedItem({ track }: { track: Track }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: track.id,
      data: { from: 'finished', track }, // 
    })

    const style: React.CSSProperties = isDragging
      ? { opacity: 0, visibility: 'hidden' }
      : {};

    return (
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          className="w-full max-w-full min-w-0 overflow-hidden p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 select-none border border-transparent box-border"
          title={`${track.title} — ${track.artist}`}
        >
        <div className="text-white text-sm font-medium truncate whitespace-nowrap min-w-0 block">{track.title}</div>
        <div className="text-gray-400 text-xs truncate whitespace-nowrap min-w-0 block">{track.artist}</div>
      </div>
    )
  }

  function DraggableDeckItem({
    deck,
    track,
    children,
  }: {
    deck: 'left' | 'right'
    track?: Track
    children: React.ReactNode
  }) {
    const draggableId = track?.id ? `deck-${deck}-${track.id}` : `deck-${deck}-empty`

    const hasSong = !!track?.audioFile   // <- only allow drag when a real file is loaded
    const cornerClass = deck === 'left' ? 'left-2' : 'right-2'

    const { attributes, listeners, setNodeRef, transform, isDragging } =
      useDraggable({
        id: draggableId,
        data: { from: deck === 'left' ? 'deck-left' : 'deck-right', track },
        disabled: !hasSong,  // <- disables dragging if no audio file
      })

    const style: React.CSSProperties = isDragging
      ? { opacity: 0, visibility: 'hidden' }
      : {};

    return (
      <div ref={setNodeRef} style={style} className="relative">
        {/* Clickable vinyl stays clickable */}
        {children}

        {/* Small drag handle (only if there's a song) */}
        {hasSong && (
          <button
            type="button"
            aria-label={`Drag ${deck} deck`}
            title={`Drag ${deck} deck`}
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()} // don't trigger the vinyl click
            className={`absolute top-8 ${cornerClass} z-10 rounded px-1.5 py-0.5 text-xs
                        bg-gray-800/70 hover:bg-gray-700/70 cursor-grab select-none`}
          >
            ⋮⋮
          </button>
        )}
      </div>
    )
  }

  function QueueDropZone({ children }: { children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: 'queue-dropzone' })
    return (
      <div
        ref={setNodeRef}
        className={`rounded-md pointer-events-auto ${isOver ? 'ring-2 ring-blue-500' : 'ring-1 ring-transparent'}`}
        style={{ paddingTop: 4, paddingBottom: 4, minHeight: 8 }}
      >
        {children}
      </div>
    )
  }

// === Derived queue/deck views (show deck tracks as "Currently Playing" even if paused) ===
const leftDeckTrack = tracks.find(t => t.position === 'left' && !!t.audioFile)
const rightDeckTrack = tracks.find(t => t.position === 'right' && !!t.audioFile)

// Build a Set of deck track IDs so we can hide them from "In Queue" and "Recently Finished"
const deckIds = new Set<string>(
  [leftDeckTrack?.id, rightDeckTrack?.id].filter((x): x is string => Boolean(x))
)

const makeEmptyDeckTrack = (position: 'left' | 'right'): Track => ({
  id: position === 'left' ? '1' : '2',
  title: 'Load MP3 File',
  artist: 'Click to browse',
  playing: false,
  position,
  bpm: 120,
  key: 'C',
  volume: 1.0,
  audioFile: undefined,
  duration: 0,
  currentTime: 0,
  analyzing: false,
})

const visibleQueue = queue.filter(t => !deckIds.has(t.id))
const visibleFinished = recentlyFinished.filter(t => !deckIds.has(t.id))

function QueueInsertSlot({ index, active }: { index: number; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `queue-slot-${index}` });
  const show = active || isOver;

  return (
    <div ref={setNodeRef} className="relative select-none w-full">
      {/* visible line */}
      <div className={`mx-1 ${show ? 'h-3 bg-white rounded-sm' : 'h-3 bg-transparent'}`} />
      <div className="absolute inset-x-0 -top-3 -bottom-3" />
    </div>
  );
}

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragOver={(evt) => {
        const { over } = evt;
        if (!over) { setQueueSlotOver(null); return; }
        const m = String(over.id).match(/^queue-slot-(\d+)$/);
        setQueueSlotOver(m ? parseInt(m[1], 10) : null);
      }}
      onDragStart={(evt) => {
        const from = evt.active.data?.current?.from as
          | 'queue'
          | 'deck-left'
          | 'deck-right'
          | 'finished'
          | undefined;

        // Only show an overlay for deck/finished drags (not queue reorders)
        if (from && from !== 'queue') {
          setDragging({ track: (evt.active.data?.current as any)?.track });
        } else {
          setDragging(null);
        }
      }}
      onDragEnd={(evt) => {
        setDragging(null);
        const { active, over } = evt;
        const slotMatch = over ? String(over.id).match(/^queue-slot-(\d+)$/) : null;
        const insertAt = slotMatch ? parseInt(slotMatch[1], 10) : null;
        setQueueSlotOver(null);
        if (insertAt === null) return;

        const from = active.data?.current?.from as 'queue' | 'deck-left' | 'deck-right' | 'finished' | undefined;
        const draggedId = (active.data?.current?.trackId ?? active.id) as string;

        const clamp = (i: number) => Math.max(0, Math.min(i, visibleQueue.length));
        const idx = clamp(insertAt);

        if (from === 'queue') {
          // reorder within queue
          setQueue(prev => {
            const curIndex = prev.findIndex(t => t.id === draggedId);
            if (curIndex < 0) return prev;
            const without = prev.filter((_, i) => i !== curIndex);
            const target = idx > curIndex ? idx - 1 : idx;
            return [...without.slice(0, target), prev[curIndex], ...without.slice(target)];
          });
          return;
        }

        if (from === 'deck-left' || from === 'deck-right') {
          stopDeckAndReturnToQueue(from === 'deck-left' ? 'left' : 'right', idx);
          return;
        }

        if (from === 'finished') {
          const dragged = recentlyFinished.find(t => t.id === draggedId);
          if (!dragged) return;
          setQueue(prev => {
            const withoutDup = prev.filter(t => t.id !== dragged.id);
            return [...withoutDup.slice(0, idx), dragged, ...withoutDup.slice(idx)];
          });
          return;
        }
      }}
      onDragCancel={() => { setQueueSlotOver(null); setDragging(null); }}
      >
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
        {confirmTrack && (
          <div className="fixed top-28 right-4 z-50 w-80 bg-gray-900/80 backdrop-blur-md rounded-lg border border-gray-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-white text-sm futuristic-font">Add to Queue?</div>
              <div className="text-xs text-gray-400 futuristic-font">Auto in {confirmCountdown}s</div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-gray-700 rounded overflow-hidden mb-3">
              <div
                className="h-full bg-green-500 transition-all duration-700"
                style={{ width: `${Math.max(0, (confirmCountdown / CONFIRM_SECONDS) * 100)}%` }}
              />
            </div>

            <div className="text-xs text-gray-300 truncate mb-3 futuristic-font" title={`${confirmTrack.title} — ${confirmTrack.artist}`}>
              {confirmTrack.title} — {confirmTrack.artist}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmAddToQueue} className="flex-1 py-2 px-3 rounded-md text-xs font-medium bg-green-600 hover:bg-green-700 text-white futuristic-font">
                Confirm
              </button>
              <button onClick={cancelAddToQueue} className="flex-1 py-2 px-3 rounded-md text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white futuristic-font">
                Cancel
              </button>
            </div>
          </div>
        )}

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
          <div className="flex-shrink-0 w-48">
            <DeckDropZone id="deck-left">
              <DraggableDeckItem deck="left" track={tracks.find(t => t.position === 'left')}>
                <div onClick={() => handleVinylClick('left')} className="cursor-pointer">
                  <VinylRecord track={tracks[0]} />
                </div>
              </DraggableDeckItem>
            </DeckDropZone>
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
          <div className="flex-shrink-0 w-48">
            <DeckDropZone id="deck-right">
              <DraggableDeckItem deck="right" track={tracks.find(t => t.position === 'right')}>
                <div onClick={() => handleVinylClick('right')} className="cursor-pointer">
                  <VinylRecord track={tracks[1]} />
                </div>
              </DraggableDeckItem>
            </DeckDropZone>
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
            className={`fixed bottom-4 right-4 w-[20rem] min-w-[20rem] max-w-[20rem] overflow-hidden z-40 bg-gray-900/80 backdrop-blur-md rounded-lg border border-gray-700 p-4 transition-all duration-300 ease-out ${
            showQueue
              ? 'translate-x-0 translate-y-0 opacity-100 scale-100'
              : 'translate-x-8 -translate-y-8 opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Queue</h3>
            <div className="flex gap-2">
              <button onClick={prevTrack} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center">
                <SkipBack size={12} />
              </button>
              <button onClick={() => togglePlayPause()} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center">
                {tracks.find(t => t.playing) ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <button onClick={nextTrack} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center">
                <SkipForward size={12} />
              </button>
              <button onClick={() => setShowQueue(false)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center">
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-80 overflow-y-auto overflow-x-hidden pr-1 min-w-0">
          {/* Currently Playing */}
          <section>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Currently Playing</div>
            <div className="grid gap-2 min-w-0">
              {[leftDeckTrack, rightDeckTrack].filter(Boolean).map(t => (
                <div key={(t as Track).id} className="w-full max-w-full min-w-0 overflow-hidden p-2 rounded bg-green-700/20 border border-green-500/30 box-border">
                  <div className="text-white text-sm font-medium truncate whitespace-nowrap min-w-0 block">{(t as Track).title}</div>
                  <div className="text-gray-300 text-xs truncate whitespace-nowrap min-w-0 block">{(t as Track).artist}</div>
                  <div className="text-green-400 text-xs mt-1">
                    {(t as Track).playing ? '● Playing' : '⏸ Paused'} on {(t as Track).position.toUpperCase()}
                  </div>
                </div>
              ))}
              {[leftDeckTrack, rightDeckTrack].filter(Boolean).length === 0 && (
                <div className="text-gray-500 text-xs">No songs on decks</div>
              )}
            </div>
          </section>

          {/* In Queue (sortable) */}
          <section>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">In Queue</div>

            {/* No outer droppable container here */}
            <div className="min-w-0">
              <SortableContext
                items={visibleQueue.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
              {/* slot at index 0 (top) */}
              <QueueInsertSlot index={0} active={queueSlotOver === 0} />

              {visibleQueue.map((track, i) => (
                <React.Fragment key={track.id}>
                  <SortableQueueItem track={track} index={i} />
                  {/* slot after item i => index i+1 */}
                  <QueueInsertSlot index={i + 1} active={queueSlotOver === i + 1} />
                </React.Fragment>
              ))}
            </SortableContext>
            </div>
          </section>

          {/* Recently Finished (draggable into queue) */}
          <section>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Recently Finished</div>
            <div className="grid gap-2 min-w-0">
              {visibleFinished.length === 0 && (
                <div className="text-gray-500 text-xs">Nothing yet</div>
              )}
              {visibleFinished.map(song => (
                <DraggableFinishedItem key={song.id} track={song} />
              ))}
            </div>
          </section>

          </div>
        </div>  
      </div>
    <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
      {dragging?.track ? <MiniVinylRecord track={dragging.track} compact /> : null}
    </DragOverlay>
  </DndContext>
  )
}


export default App