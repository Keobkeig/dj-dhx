import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Mic, MicOff, X } from 'lucide-react'

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

export const AISection: React.FC<AISectionProps> = ({ 
  onSongRequest, 
  onCancelRequest, 
  isSearching = false, 
  isVisible = false 
}) => {
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [lastCommand, setLastCommand] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    initializeSpeechRecognition()
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const initializeSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setStatus('Speech not supported - try Chrome/Edge')
      return
    }

    try {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognitionClass()

      recognition.continuous = false
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

        const fullTranscript = finalTranscript + interimTranscript
        setLiveTranscript(fullTranscript)

        if (finalTranscript) {
          handleSpeechResult(finalTranscript.trim())
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)
        setStatus(`Speech error: ${event.error}`)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
        if (!isProcessing) {
          setStatus('Ready')
        }
      }

      recognitionRef.current = recognition
      setStatus('Ready - Click to speak')
    } catch (error) {
      console.error('Error initializing speech recognition:', error)
      setStatus('Speech initialization failed')
    }
  }

  const handleSpeechResult = async (transcript: string) => {
    setLastCommand(transcript)
    setLiveTranscript('')
    setIsProcessing(true)
    setStatus('Finding music on YouTube...')

    try {
      // Call LLM to get YouTube URL
      const youtubeUrl = await callLLMForYouTube(transcript)
      setStatus('Converting to MP3...')
      
      // Send to converter
      onSongRequest(youtubeUrl)
    } catch (error) {
      console.error('Failed to process request:', error)
      setStatus('Failed to find music')
      setTimeout(() => {
        setStatus('Ready')
        setIsProcessing(false)
      }, 3000)
    }
  }

  const callLLMForYouTube = async (query: string): Promise<string> => {
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found')
    }

    const prompt = `Find a YouTube URL for the music request: "${query}"

Return ONLY a YouTube URL in this format: https://www.youtube.com/watch?v=VIDEO_ID

Examples:
- "jazz music" → https://www.youtube.com/watch?v=vmDDOFXSgAs
- "bohemian rhapsody" → https://www.youtube.com/watch?v=fJ9rUzIMcZQ
- "the beatles" → https://www.youtube.com/watch?v=ZbZSe6N_BXs

YouTube URL:`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const youtubeUrl = data.choices[0].message.content.trim()
    
    if (!youtubeUrl.includes('youtube.com/watch') && !youtubeUrl.includes('youtu.be/')) {
      throw new Error('Invalid YouTube URL received')
    }

    return youtubeUrl
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
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const handleCancel = () => {
    setIsProcessing(false)
    setStatus('Ready')
    onCancelRequest()
  }

  // Handle when conversion completes
  useEffect(() => {
    if (!isSearching && isProcessing) {
      setIsProcessing(false)
      setStatus('Ready')
    }
  }, [isSearching, isProcessing])

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
            <h3 className="text-white font-semibold text-sm futuristic-font">Voice Music Search</h3>
            <div className="text-xs text-gray-400 futuristic-font">
              Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-white text-[10px]">+</kbd> to close
            </div>
          </div>

          {/* Status */}
          <div className={cn(
            "text-xs px-3 py-2 rounded-md text-center futuristic-font min-h-[32px] flex items-center justify-center",
            isListening ? "bg-green-600/30 text-green-300 border border-green-500" :
            (isProcessing || isSearching) ? "bg-blue-600/30 text-blue-300 border border-blue-500 animate-pulse" :
            "bg-gray-700/50 text-gray-300"
          )}>
            {(isProcessing || isSearching)
              ? status
              : liveTranscript
                ? liveTranscript
                : status
            }
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing || isSearching}
              className={cn(
                "flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all futuristic-font flex items-center justify-center gap-2",
                isListening
                  ? "bg-green-600 hover:bg-green-700 text-white animate-pulse"
                  : (isProcessing || isSearching)
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {isListening ? <Mic size={14} /> : <MicOff size={14} />}
              {isListening ? "Listening" : "Speak"}
            </button>
            
            {(isProcessing || isSearching) && (
              <button
                onClick={handleCancel}
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
              <div className="text-xs text-gray-400 futuristic-font">Last request:</div>
              <div className="text-xs text-white futuristic-font">{lastCommand}</div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-xs text-gray-500 futuristic-font space-y-1">
            <div>Click "Speak" and say something like:</div>
            <div>"Play some jazz music"</div>
            <div>"Find Bohemian Rhapsody"</div>
            <div>"Play The Beatles"</div>
          </div>
        </div>
      </div>
    </div>
  )
}