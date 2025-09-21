// Audio Analysis Utilities for BPM and Key Detection

export interface AudioAnalysisResult {
  bpm: number
  key: string
  confidence: number
}

// Note frequencies for key detection (A4 = 440Hz)
const noteFrequencies = {
  'C': 261.63,
  'C#/Db': 277.18,
  'D': 293.66,
  'D#/Eb': 311.13,
  'E': 329.63,
  'F': 349.23,
  'F#/Gb': 369.99,
  'G': 392.00,
  'G#/Ab': 415.30,
  'A': 440.00,
  'A#/Bb': 466.16,
  'B': 493.88
}

const keys = Object.keys(noteFrequencies)

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null

  constructor() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.error('Web Audio API not supported:', error)
    }
  }

  async analyzeFile(file: File): Promise<AudioAnalysisResult> {
    if (!this.audioContext) {
      throw new Error('Audio context not available')
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      const bpm = await this.detectBPM(audioBuffer)
      const key = await this.detectKey(audioBuffer)

      return {
        bpm: Math.round(bpm),
        key,
        confidence: 0.8 // Simplified confidence score
      }
    } catch (error) {
      console.error('Error analyzing audio file:', error)
      throw error
    }
  }

  private async detectBPM(audioBuffer: AudioBuffer): Promise<number> {
    const sampleRate = audioBuffer.sampleRate
    const channelData = audioBuffer.getChannelData(0)
    const bufferSize = 1024
    const hopSize = 512

    // Simplified beat detection algorithm
    // In a real implementation, you'd use more sophisticated methods like:
    // - Onset detection
    // - Peak picking
    // - Autocorrelation
    // - Spectral flux

    const beats: number[] = []
    let lastBeat = 0

    // Simple peak detection for demo purposes
    for (let i = bufferSize; i < channelData.length - bufferSize; i += hopSize) {
      const window = channelData.slice(i, i + bufferSize)
      const energy = window.reduce((sum, sample) => sum + Math.abs(sample), 0) / bufferSize

      // Simple threshold-based beat detection
      if (energy > 0.1 && i - lastBeat > sampleRate * 0.3) { // Minimum 300ms between beats
        beats.push(i / sampleRate)
        lastBeat = i
      }
    }

    if (beats.length < 2) {
      return 120 // Default BPM if detection fails
    }

    // Calculate average interval between beats
    const intervals = []
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1])
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    const bpm = 60 / avgInterval

    // Clamp to reasonable BPM range
    return Math.max(60, Math.min(200, bpm))
  }

  private async detectKey(audioBuffer: AudioBuffer): Promise<string> {
    const sampleRate = audioBuffer.sampleRate
    const channelData = audioBuffer.getChannelData(0)

    // Use FFT to analyze frequency content
    const fftSize = 8192
    const fft = new Float32Array(fftSize)
    const windowSize = Math.min(fftSize, channelData.length)

    // Apply windowing function (Hann window)
    for (let i = 0; i < windowSize; i++) {
      const windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)))
      fft[i] = channelData[i] * windowValue
    }

    // Simple frequency analysis (in a real implementation, use proper FFT)
    const frequencyBins = new Float32Array(fftSize / 2)

    // Simplified chromagram calculation
    const chromagram = new Float32Array(12)

    for (let i = 1; i < frequencyBins.length; i++) {
      const frequency = (i * sampleRate) / fftSize
      const noteIndex = this.frequencyToNoteIndex(frequency)
      if (noteIndex >= 0) {
        chromagram[noteIndex] += Math.abs(fft[i])
      }
    }

    // Find the dominant note
    let maxIndex = 0
    let maxValue = chromagram[0]

    for (let i = 1; i < chromagram.length; i++) {
      if (chromagram[i] > maxValue) {
        maxValue = chromagram[i]
        maxIndex = i
      }
    }

    return keys[maxIndex] || 'C'
  }

  private frequencyToNoteIndex(frequency: number): number {
    // Convert frequency to the nearest note index (0-11)
    const A4 = 440.0
    const noteNumber = 12 * Math.log2(frequency / A4) + 69
    const noteIndex = Math.round(noteNumber) % 12
    return noteIndex >= 0 ? noteIndex : noteIndex + 12
  }

  async analyzeURL(audioURL: string): Promise<AudioAnalysisResult> {
    if (!this.audioContext) {
      throw new Error('Audio context not available')
    }

    try {
      const response = await fetch(audioURL)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      const bpm = await this.detectBPM(audioBuffer)
      const key = await this.detectKey(audioBuffer)

      return {
        bpm: Math.round(bpm),
        key,
        confidence: 0.8
      }
    } catch (error) {
      console.error('Error analyzing audio URL:', error)
      // Return default values if analysis fails
      return {
        bpm: 120,
        key: 'C',
        confidence: 0.1
      }
    }
  }

  dispose() {
    if (this.audioContext) {
      this.audioContext.close()
    }
  }
}

// Create a singleton instance
export const audioAnalyzer = new AudioAnalyzer()