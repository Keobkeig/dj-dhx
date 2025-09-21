import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Mic, MicOff, X, Bot } from 'lucide-react'

interface AISectionProps {
  onSongRequest: (songQuery: string) => void
  onCancelRequest: () => void
  isSearching?: boolean
  isVisible?: boolean
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition
  new(): SpeechRecognition
}

export const AISection: React.FC<AISectionProps> = ({ onSongRequest, onCancelRequest, isSearching = false, isVisible = false }) => {
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [lastCommand, setLastCommand] = useState('')
  // Remove isExpanded state since it's now controlled by parent
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    initializeSpeechRecognition()
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  // Auto-start listening when AI becomes visible
  useEffect(() => {
    if (isVisible && recognitionRef.current && !isListening && !isSearching) {
      console.log('AI opened - auto-starting listening...')
      startListening()
    } else if (!isVisible && isListening) {
      console.log('AI closed - stopping listening...')
      stopListening()
    }
  }, [isVisible])

  const initializeSpeechRecognition = () => {
    console.log('🎤 Initializing speech recognition...')
    console.log('SpeechRecognition in window:', 'SpeechRecognition' in window)
    console.log('webkitSpeechRecognition in window:', 'webkitSpeechRecognition' in window)
    console.log('Current protocol:', window.location.protocol)
    console.log('User agent:', navigator.userAgent)

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        setStatus('Speech requires HTTPS')
      } else {
        setStatus('Speech not supported - try Chrome/Edge')
      }
      return
    }

    try {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognitionClass()
      console.log('✅ Speech recognition class created')

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      setStatus('Listening...')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      // Update live transcript for real-time display
      const fullTranscript = finalTranscript + interimTranscript
      setLiveTranscript(fullTranscript)

      if (finalTranscript) {
        handleSpeechResult(finalTranscript.trim())
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('🚨 Speech recognition error:', event.error)

      switch (event.error) {
        case 'network':
          console.log('🌐 Network error - Google speech service issue')
          setStatus('Network error - try refreshing page')
          setIsListening(false)
          break
        case 'not-allowed':
          console.log('🚫 Microphone permission denied')
          setStatus('Please allow microphone access')
          setIsListening(false)
          break
        case 'no-speech':
          console.log('🔇 No speech detected - continuing...')
          setStatus('Listening...')
          // Don't stop for no-speech errors
          break
        case 'audio-capture':
          console.log('🎤 Microphone capture failed')
          setStatus('Microphone unavailable')
          setIsListening(false)
          break
        case 'service-not-allowed':
          console.log('🔒 Speech service blocked')
          setStatus('Speech service blocked - check settings')
          setIsListening(false)
          break
        default:
          console.log('❓ Unknown speech error:', event.error)
          setStatus(`Speech error: ${event.error}`)
          setIsListening(false)
      }
    }

    recognition.onend = () => {
      // Don't automatically stop listening - let user control it
      console.log('Recognition ended, restarting...')
      if (isListening && recognitionRef.current) {
        // Restart recognition to keep listening
        try {
          recognitionRef.current.start()
        } catch (error) {
          console.log('Recognition restart failed:', error)
          setIsListening(false)
          setStatus('Ready')
        }
      }
    }

    recognitionRef.current = recognition
    setStatus('Ready - Click Listen to start')
    } catch (error) {
      console.error('Error initializing speech recognition:', error)
      setStatus('Speech initialization failed')
    }
  }

  const handleSpeechResult = (transcript: string) => {
    const lowerTranscript = transcript.toLowerCase()
    setLastCommand(transcript)
    setLiveTranscript('') // Clear live transcript after processing

    // Check for trigger phrase "can you play" with YouTube URL
    const playMatch = lowerTranscript.match(/can you play (.+?)(?:\?|$)/i)
    if (playMatch) {
      const urlQuery = playMatch[1].trim()

      // Check if it's a YouTube URL
      if (urlQuery.includes('youtube.com/watch') || urlQuery.includes('youtu.be/')) {
        setStatus(`Converting YouTube video...`)
        onSongRequest(urlQuery)
        console.log('YouTube URL command processed, continuing to listen...')
      } else {
        setStatus('❌ Only YouTube URLs supported')
        setTimeout(() => setStatus('Listening...'), 3000)
        console.log('Non-YouTube URL rejected:', urlQuery)
      }
    }
  }

  const startListening = async () => {
    if (!recognitionRef.current) return

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      recognitionRef.current.start()
    } catch (error) {
      console.error('Microphone permission error:', error)
      setStatus('Mic permission denied')
    }
  }

  const stopListening = () => {
    setIsListening(false)
    setLiveTranscript('')
    setStatus('Ready')
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // Handle keyboard shortcuts when AI is visible
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!isVisible) return

      // Ignore events from input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      // Handle - key to toggle listening
      if (event.key === '-' && !event.repeat) {
        event.preventDefault()
        event.stopPropagation()
        toggleListening()
        return
      }

      // Handle backspace for cancelling requests
      if (event.key === 'Backspace' && isSearching) {
        event.preventDefault()
        event.stopPropagation()
        onCancelRequest()
        stopListening()
        return
      }
    }

    if (isVisible) {
      window.addEventListener('keydown', handleKeyPress, { capture: true })
      return () => window.removeEventListener('keydown', handleKeyPress, { capture: true })
    }
  }, [isVisible, isSearching, isListening, onCancelRequest])

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ease-out ${
      isVisible
        ? 'translate-x-0 translate-y-0 opacity-100 scale-100'
        : 'translate-x-8 -translate-y-8 opacity-0 scale-95 pointer-events-none'
    }`}>
      <div className="bg-gray-900/80 backdrop-blur-md rounded-lg border border-gray-700 p-4 w-80">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm futuristic-font">AI DJ Assistant</h3>
            <div className="text-xs text-gray-400 futuristic-font">
              Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-white text-[10px]">+</kbd> to close
            </div>
          </div>

          {/* Status */}
          <div className={cn(
            "text-xs px-3 py-2 rounded-md text-center futuristic-font min-h-[32px] flex items-center justify-center",
            isListening ? "bg-green-600/30 text-green-300 border border-green-500" :
            isSearching ? "bg-blue-600/30 text-blue-300 border border-blue-500 animate-pulse" :
            "bg-gray-700/50 text-gray-300"
          )}>
            {isSearching
              ? 'Searching & downloading...'
              : liveTranscript
                ? liveTranscript
                : status
            }
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={toggleListening}
              disabled={isSearching}
              className={cn(
                "flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all futuristic-font flex items-center justify-center gap-2",
                isListening
                  ? "bg-green-600 hover:bg-green-700 text-white animate-pulse"
                  : isSearching
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {isListening ? <Mic size={14} /> : <MicOff size={14} />}
              {isListening ? "Listening" : "Start"}
            </button>
            {isSearching && (
              <button
                onClick={onCancelRequest}
                className="py-2 px-3 rounded-md text-xs font-medium bg-red-600 hover:bg-red-700 text-white futuristic-font flex items-center justify-center gap-2"
              >
                <X size={14} />
                Cancel
              </button>
            )}
          </div>

          {/* Last Command */}
          {lastCommand && (
            <div className="bg-gray-800/50 p-2 rounded-md">
              <div className="text-xs text-gray-400 futuristic-font">Last command:</div>
              <div className="text-xs text-white futuristic-font">{lastCommand}</div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-xs text-gray-500 futuristic-font space-y-1">
            <div>Say: "Can you play "X"?"</div>
            {isSearching && (
              <div className="text-red-400">Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-white text-[10px]">Backspace</kbd> to cancel</div>
            )}
          </div>

          {/* Test Button for when speech fails */}
          {!isListening && !isSearching && (
            <button
              onClick={() => {
                console.log('🧪 Testing real YouTube API...')
                onSongRequest('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
              }}
              className="w-full py-2 px-3 rounded-md text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white futuristic-font"
            >
              🧪 Test Real API
            </button>
          )}
        </div>
      </div>
    </div>
  )
}