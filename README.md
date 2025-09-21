# Launchpad Player

A powerful web-based DJ launchpad and music player built with React, TypeScript, and modern web technologies. Perfect for live performances, music production, and creative experimentation!

## Features

- **Professional DJ Interface**: Dual-deck layout with crossfader control
- **Interactive Launchpad**: Grid-based pad system for triggering samples and loops
- **Beautiful UI**: Animated vinyl records, pulsating buttons, and responsive design
- **AI-Powered Music Search**: Find and queue tracks using natural language
- **Drag & Drop**: Intuitive queue management with sortable playlists
- **Audio Analysis**: Real-time audio visualization and BPM detection
- **Keyboard Shortcuts**: Full keyboard control for performance workflow

## Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/launchpad-player.git
cd launchpad-player

# Install dependencies
npm install
# or
pnpm install

# Start development server
npm run dev
# or
pnpm dev
```

Visit `http://localhost:5173` to see the app in action!

## How to Use

### Basic Controls
- **Play/Pause**: Click vinyl records or use spacebar
- **Crossfader**: Drag the center slider to mix between left/right decks
- **Volume**: Adjust master volume with the volume slider
- **Queue**: Drag songs from the queue to load into decks

### Launchpad Grid
Each pad can be assigned different sample types:
- **Drums**: Kick, snare, hi-hat patterns
- **Bass**: Bass lines and sub-bass hits
- **Melodic**: Chord progressions and melodies
- **Vocal**: Vocal chops and drops
- **FX**: Sound effects and transitions
- **Perc**: Percussion and rhythm elements

### AI Music Search
1. Click the "AI" button to open the search panel
2. Describe the music you want: "upbeat electronic dance track" or "chill lo-fi hip hop"
3. The AI will find and queue matching tracks automatically

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: TailwindCSS 4.0, CSS Animations
- **UI Components**: Radix UI, Lucide React icons
- **Drag & Drop**: @dnd-kit for smooth interactions
- **Audio**: Web Audio API for advanced audio processing
- **Music APIs**: Spotify integration for track search

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI primitives
│   ├── VinylRecord.tsx # Animated record player
│   ├── AISection.tsx   # AI search interface
│   └── SongProgress.tsx # Progress indicators
├── services/           # External API integrations
│   └── spotifyService.ts # Music search service
├── utils/              # Helper utilities
│   └── audioAnalysis.ts # Audio processing tools
├── App.tsx             # Main application component
└── main.tsx           # App entry point
```

## Configuration

### API Keys (Optional)
For full functionality, configure these API keys in `src/services/spotifyService.ts`:

```typescript
// Configure your API credentials
configureApiKeys(
  'your-rapid-api-key',
  'your-youtube-api-key',
  'your-spotify-client-id',
  'your-spotify-client-secret'
)
```

### Adding Custom Samples
1. Place audio files in `public/` directory
2. Update the pad configuration in `App.tsx`
3. Assign file paths to individual pads

## Perfect for Hackathons

This project is ideal for hackathons because:
- **Fast Setup**: Get running in under 5 minutes
- **Visual Impact**: Impressive animations and professional UI
- **Extensible**: Easy to add new features and integrations
- **Modern Stack**: Built with the latest web technologies
- **Fun Factor**: Interactive and engaging for demos

## Development

```bash
# Development server with hot reload
npm run dev

# Type checking
npm run build

# Linting
npm run lint

# Preview production build
npm run preview
```

## Deployment

Build for production:

```bash
npm run build
```

Deploy the `dist/` folder to any static hosting service like Vercel, Netlify, or GitHub Pages.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

---

**Built with care for the music and developer community**

*Ready to drop some beats? Fire up the launchpad and let's make some music!*