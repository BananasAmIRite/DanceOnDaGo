# Just Dance on the Go

A real-time dance game that uses computer vision to track your poses and score your dance moves!

## Features

- **Real-time Pose Detection**: Uses MediaPipe to track 33 body landmarks
- **Camera Integration**: Live video feed with pose overlay visualization
- **Dance Move Analysis**: Calculates key body angles for dance move accuracy
- **Interactive UI**: Toggle pose visualization on/off
- **Photo Capture**: Take screenshots of your dance poses

## Project Structure

```
DanceOnDaGo/
├── frontend/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Camera.tsx    # Main camera component with pose detection
│   │   │   ├── Camera.css    # Styling for camera interface
│   │   │   └── PoseDetector.tsx # MediaPipe pose detection logic
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── package.json
└── backend/                  # Node.js backend (future)
```

## Setup Instructions

### Prerequisites

1. **Install Node.js and npm**:
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version` and `npm --version`

### Installation

1. **Clone and navigate to the project**:
   ```bash
   cd /Users/wang/Dev/hackMIT25/DanceOnDaGo/frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Open your browser** to `http://localhost:3000`

### Camera Permissions

- The app requires camera access to work
- Your browser will prompt for camera permissions when you click "Start Camera"
- Make sure to allow camera access for the best experience

## How to Use

1. **Start Camera**: Click the "Start Camera" button to begin video feed
2. **Enable Pose Detection**: The pose overlay is enabled by default, showing your body landmarks and connections
3. **Toggle Pose Overlay**: Use the "Hide Pose/Show Pose" button to toggle the pose visualization
4. **Take Photos**: Capture screenshots of your poses with the "Take Picture" button
5. **View Pose Data**: See real-time information about detected landmarks

## Technical Details

### Pose Detection

The app uses Google's MediaPipe Pose model which detects 33 body landmarks:

- **Upper Body**: Shoulders, elbows, wrists, nose, eyes, ears
- **Lower Body**: Hips, knees, ankles
- **Core**: Various torso points

### Dance Metrics

The system calculates key angles for dance analysis:

- **Arm Angles**: Left/right arm bend angles (shoulder-elbow-wrist)
- **Leg Angles**: Left/right leg bend angles (hip-knee-ankle)
- **Body Position**: Overall posture and stance analysis

### Future Features

- **Song Integration**: Generate dance moves based on Suno-generated songs
- **Move Database**: Library of dance moves to match against
- **Scoring System**: Real-time accuracy scoring for dance moves
- **Multiplayer**: Dance battles with friends
- **AI Choreography**: Generate custom dance routines

## Troubleshooting

### Common Issues

1. **Camera not working**:
   - Check browser permissions
   - Ensure camera is not being used by another app
   - Try refreshing the page

2. **Pose detection not showing**:
   - Make sure you're in good lighting
   - Stand within camera view (full body visible works best)
   - Check that "Show Pose" is enabled

3. **Performance issues**:
   - Close other browser tabs
   - Ensure good internet connection for MediaPipe model loading
   - Try reducing video quality in browser settings

### Browser Compatibility

- **Recommended**: Chrome, Firefox, Safari (latest versions)
- **Requirements**: WebRTC support, Canvas API, ES6+ support

## Development

### Adding New Features

1. **New Components**: Add to `src/components/`
2. **Styling**: Update corresponding `.css` files
3. **Pose Logic**: Extend `PoseDetector.tsx` for new pose analysis

### Key Files

- `Camera.tsx`: Main UI and camera management
- `PoseDetector.tsx`: MediaPipe integration and pose analysis
- `Camera.css`: All styling for the camera interface

## Contributing

This is a hackathon project for HackMIT 2025. Feel free to fork and extend!

## License

MIT License - see LICENSE file for details
