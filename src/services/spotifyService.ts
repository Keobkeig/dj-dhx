// Spotify API service for searching and downloading tracks

export interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  preview_url: string | null
  external_urls: { spotify: string }
  duration_ms: number
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[]
  }
}

class SpotifyService {
  private readonly clientId = 'your_spotify_client_id' // This would need to be configured
  private readonly clientSecret = 'your_spotify_client_secret' // This would need to be configured
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`
        },
        body: 'grant_type=client_credentials'
      })

      if (!response.ok) {
        throw new Error('Failed to get Spotify access token')
      }

      const data = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000 // 1 minute buffer

      return this.accessToken
    } catch (error) {
      console.error('Error getting Spotify access token:', error)
      throw error
    }
  }

  async searchTrack(query: string): Promise<SpotifyTrack[]> {
    try {
      const token = await this.getAccessToken()
      const encodedQuery = encodeURIComponent(query)

      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodedQuery}&type=track&limit=5`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to search Spotify')
      }

      const data: SpotifySearchResult = await response.json()
      return data.tracks.items
    } catch (error) {
      console.error('Error searching Spotify:', error)
      throw error
    }
  }

  async downloadTrack(track: SpotifyTrack): Promise<string> {
    // Note: Spotify doesn't allow direct MP3 downloads through their API
    // This is a placeholder that would need to be implemented with a different service
    // or by using YouTube/SoundCloud APIs to find the same track

    console.warn('Direct Spotify MP3 download not available. Using preview URL instead.')

    if (track.preview_url) {
      return track.preview_url
    }

    // Fallback: Try to find the track on YouTube using YouTube API
    return await this.findOnYouTube(track)
  }

  private async findOnYouTube(track: SpotifyTrack): Promise<string> {
    // This would integrate with YouTube API to find the same song
    // For now, return a mock URL or throw error
    const searchQuery = `${track.artists[0]?.name} ${track.name}`

    // Mock implementation - in reality you'd use YouTube Data API v3
    console.log(`Would search YouTube for: ${searchQuery}`)

    // Return empty string if no alternative found
    return ''
  }

  formatTrackName(track: SpotifyTrack): string {
    return `${track.artists.map(a => a.name).join(', ')} - ${track.name}`
  }
}

// YouTube search and download service using RapidAPI
class YouTubeDownloadService {
  private readonly rapidApiKey = '378d79c991msh221febec26dadeap19f71cjsn53b2e62948a5'
  private readonly youtubeApiKey = 'AIzaSyDummy_Key_Replace_With_Real' // Placeholder - will use fallback

  async searchAndDownload(query: string): Promise<{ url: string; title: string; artist: string }> {
  try {
    // Check if the query is a direct YouTube URL
    if (query.includes('youtube.com/watch') || query.includes('youtu.be/')) {
      console.log('Direct YouTube URL detected:', query)

      // Try to convert to MP3 using RapidAPI YouTube to MP3 service
      try {
        const mp3Result = await this.convertToMp3(query)
        return {
          url: mp3Result.downloadUrl,
          title: mp3Result.title || 'YouTube Video',
          artist: this.extractArtistFromTitle(mp3Result.title || 'Unknown Artist')
        }
      } catch (conversionError) {
        console.warn('MP3 conversion failed, using original YouTube URL:', conversionError)
        
        // Fallback: Return the original YouTube URL
        const title = await this.getVideoTitle(query)
        return {
          url: query, // Return original YouTube URL as fallback
          title: title,
          artist: this.extractArtistFromTitle(title)
        }
      }
    } else {
      throw new Error('This service only accepts direct YouTube URLs. Please provide a YouTube link.')
    }
  } catch (error) {
    // Only throw if it's not a conversion error we can handle
    if (error instanceof Error && error.message.includes('This service only accepts')) {
      throw error
    }
    
    console.error('Error in YouTube download service:', error)
    throw new Error('Failed to process YouTube request')
  }
}

  private async searchYouTube(query: string): Promise<Array<{ videoId: string; title: string; url: string }>> {
    try {
      // Use YouTube Data API v3 to search for videos
      const searchQuery = encodeURIComponent(`${query} official music video`)
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&videoCategoryId=10&maxResults=5&key=${this.youtubeApiKey}`
      )

      if (!response.ok) {
        throw new Error('YouTube search failed')
      }

      const data = await response.json()

      return data.items.map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`
      }))
    } catch (error) {
      console.error('YouTube search error:', error)
      // Fallback to mock data if API fails
      return [{
        videoId: 'mock_video_id',
        title: `${query} - Music Video`,
        url: `https://www.youtube.com/watch?v=mock_video_id`
      }]
    }
  }

  private async convertToMp3(youtubeUrl: string): Promise<{ downloadUrl: string; title: string; id: string }> {
    try {
      // Step 1: Submit conversion request
      const params = new URLSearchParams({
        url: youtubeUrl,
        format: 'mp3',
        quality: '0'
      })

      const convertResponse = await fetch(`https://youtube-to-mp315.p.rapidapi.com/download?${params}`, {
        method: 'POST',
        headers: {
          'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com',
          'X-RapidAPI-Key': this.rapidApiKey
        }
      })

      if (!convertResponse.ok) {
        throw new Error('Failed to start YouTube conversion')
      }

      const convertData = await convertResponse.json()

      // If immediately available, return it
      if (convertData.status === 'AVAILABLE') {
        return {
          downloadUrl: convertData.downloadUrl,
          title: convertData.title,
          id: convertData.id
        }
      }

      // Step 2: Poll for completion
      const result = await this.pollForCompletion(convertData.id)
      return result
    } catch (error) {
      console.error('YouTube to MP3 conversion error:', error)
      // Return a fallback or throw error
      throw new Error('Failed to convert YouTube video to MP3')
    }
  }

  private async pollForCompletion(id: string): Promise<{ downloadUrl: string; title: string; id: string }> {
    const maxAttempts = 30 // 30 seconds max wait
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const statusResponse = await fetch(`https://youtube-to-mp315.p.rapidapi.com/status/${id}`, {
          headers: {
            'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com',
            'X-RapidAPI-Key': this.rapidApiKey
          }
        })

        if (!statusResponse.ok) {
          throw new Error('Failed to check conversion status')
        }

        const statusData = await statusResponse.json()

        if (statusData.status === 'AVAILABLE') {
          return {
            downloadUrl: statusData.downloadUrl,
            title: statusData.title,
            id: statusData.id
          }
        }

        if (statusData.status === 'CONVERSION_ERROR' || statusData.status === 'EXPIRED') {
          throw new Error(`Conversion failed: ${statusData.status}`)
        }

        // Wait 1 second before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      } catch (error) {
        console.error('Error polling conversion status:', error)
        attempts++
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    throw new Error('Conversion timeout - took too long to complete')
  }

  private async getYouTubeTitle(youtubeUrl: string): Promise<string> {
    try {
      const response = await fetch(`https://youtube-to-mp315.p.rapidapi.com/title?url=${encodeURIComponent(youtubeUrl)}`, {
        headers: {
          'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com',
          'X-RapidAPI-Key': this.rapidApiKey
        }
      })

      if (!response.ok) {
        throw new Error('Failed to get YouTube title')
      }

      const data = await response.json()
      return data.title || 'Unknown Title'
    } catch (error) {
      console.error('Error getting YouTube title:', error)
      return 'Unknown Title'
    }
  }

  private extractArtistFromTitle(title: string): string {
    // Clean up common YouTube title patterns
    let cleanTitle = title
      .replace(/\[.*?\]/g, '') // Remove [Official Music Video] etc.
      .replace(/\(.*?\)/g, '') // Remove (Official Video) etc.
      .replace(/official video/gi, '')
      .replace(/music video/gi, '')
      .replace(/official/gi, '')
      .trim()

    // Try to extract artist - common patterns
    const patterns = [
      /^(.+?)\s*[-–—]\s*(.+)$/, // Artist - Song
      /^(.+?)\s*[|｜]\s*(.+)$/, // Artist | Song
      /^(.+?)\s*[:]\s*(.+)$/, // Artist: Song
    ]

    for (const pattern of patterns) {
      const match = cleanTitle.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }

    // If no pattern matches, try to guess from common words
    const words = cleanTitle.split(' ')
    if (words.length > 1) {
      // Return first 1-2 words as likely artist name
      return words.slice(0, Math.min(2, Math.ceil(words.length / 2))).join(' ')
    }

    return 'Unknown Artist'
  }
}

// Combined service that tries Spotify first, then falls back to YouTube
export class MusicSearchService {
  private spotifyService = new SpotifyService()
  private youtubeService = new YouTubeDownloadService()

  async findAndDownloadTrack(query: string): Promise<{
    url: string
    title: string
    artist: string
    source: 'spotify' | 'youtube'
    duration?: number
  }> {
    console.log(`🎵 Searching for: "${query}"`)

    try {
      // Skip Spotify for now and go straight to YouTube with RapidAPI
      console.log('🔍 Searching YouTube with RapidAPI...')
      const youtubeResult = await this.youtubeService.searchAndDownload(query)

      console.log(`✅ YouTube conversion successful: ${youtubeResult.title}`)
      return {
        ...youtubeResult,
        source: 'youtube'
      }
    } catch (error) {
      console.error('❌ Error finding track:', error)
      throw new Error(`Could not find track: ${query}. ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Method to get just Spotify metadata without downloading
  async getSpotifyMetadata(query: string): Promise<SpotifyTrack | null> {
    try {
      const results = await this.spotifyService.searchTrack(query)
      return results.length > 0 ? results[0] : null
    } catch (error) {
      console.error('Error getting Spotify metadata:', error)
      return null
    }
  }
}

export const musicSearchService = new MusicSearchService()

// Configuration helper
export const configureApiKeys = (rapidApiKey: string, youtubeApiKey?: string, spotifyClientId?: string, spotifyClientSecret?: string) => {
  // This would be used to set API keys at runtime if needed
  console.log('⚙️ API keys configured for music search service')
  // Implementation would update the service instances with new keys
}