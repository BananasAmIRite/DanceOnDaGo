# Dance on the Go

An intelligent dance game that uses computer vision, AI-generated music, and real-time scoring to create personalized dance experiences!

## Features

- **Real-time Pose Detection**: Uses MediaPipe to track 33 body landmarks with live video feed
- **AI Music Generation**: Creates custom dance music based on emotional analysis using Suno API
- **Intelligent Scoring System**: Multi-component scoring with spatial accuracy, timing, and rhythm analysis
- **AI Feedback**: Personalized coaching feedback powered by machine learning algorithms
- **Emotion Analysis**: Analyzes uploaded videos to generate matching music using Claude AI
- **Interactive Game Flow**: Complete dance experience from video upload to final scoring

## Project Structure

```
hackmit-best/
├── frontend/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Camera.tsx    # Camera interface with pose detection
│   │   │   ├── Game.tsx      # Main game orchestration component
│   │   │   ├── PoseDetector.tsx # MediaPipe pose detection logic
│   │   │   └── Scoring.tsx   # Score display with AI feedback
│   │   ├── utils/
│   │   │   └── norm.ts       # Pose normalization utilities
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── package.json
└── backend/                  # Node.js TypeScript backend
    ├── src/
    │   ├── utils/
    │   │   ├── downloadMp3.ts # Music file handling
    │   │   └── norm.ts       # Pose normalization
    │   ├── claude.ts         # Claude AI integration
    │   ├── suno.ts           # Suno music generation API
    │   └── index.ts          # Main server with scoring endpoints
    ├── nn/
    │   ├── scoring/
    │   │   └── real_time_pose_scorer.py # AI scoring algorithm
    │   └── data_analyzer.py  # Pose data processing
    └── package.json
```

## Setup Instructions

### Prerequisites

1. **Install Node.js and npm**:
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version` and `npm --version`

2. **Install Python 3.8+**:
   - Download from [python.org](https://python.org/)
   - Required for AI scoring algorithms

3. **API Keys** (create `.env` files in both frontend and backend):
   - **Claude API Key**: For emotion analysis
   - **Suno API Key**: For music generation

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd DanceOnDaGo
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   pip install numpy scipy dtaidistance
   cp .env.example .env
   # Add your API keys to .env
   npm start
   ```

3. **Frontend Setup** (in a new terminal):
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Configure REACT_APP_BACKEND_URL=http://localhost:8080
   npm start
   ```

4. **Open your browser** to `http://localhost:3000`

### Camera Permissions

- The app requires camera access to work
- Your browser will prompt for camera permissions when you click "Start Camera"
- Make sure to allow camera access for the best experience

## How to Use

1. **Upload Reference Video**: Upload a video to analyze emotions and generate matching music
2. **AI Music Generation**: The system analyzes your video and creates custom dance music
3. **Start Dancing**: Use your camera to dance along with the generated music
4. **Real-time Pose Tracking**: See your pose landmarks overlaid on the video feed
5. **Get AI Feedback**: Receive detailed scoring and personalized coaching feedback
6. **Improve Your Moves**: Use the feedback to enhance your dance performance

## Technical Details

### Pose Detection

The app uses Google's MediaPipe Pose model which detects 33 body landmarks:

- **Upper Body**: Shoulders, elbows, wrists, nose, eyes, ears
- **Lower Body**: Hips, knees, ankles
- **Core**: Various torso points

### AI Scoring System

The intelligent scoring system evaluates dance performance across multiple dimensions:

- **Spatial Accuracy**: Measures pose similarity using Euclidean distance calculations
- **Timing Score**: Evaluates frame rate consistency and temporal alignment
- **Rhythm Score**: Analyzes movement velocity correlation with reference dance
- **Overall Score**: Weighted combination (40% spatial, 30% timing, 30% rhythm)

### AI Technologies

- **Claude AI**: Emotion analysis from uploaded videos to generate contextual music
- **Suno API**: Custom music generation based on emotional analysis
- **MediaPipe**: Real-time pose detection and landmark tracking
- **Python ML**: Advanced pose comparison algorithms with normalization and smoothing
- **Real-time Processing**: Live pose scoring with exponential decay functions

### Architecture

- **Frontend**: React TypeScript with MediaPipe integration
- **Backend**: Node.js with TypeScript, Python ML integration
- **AI Pipeline**: Video → Emotion Analysis → Music Generation → Pose Tracking → Scoring → Feedback

## Troubleshooting

### Common Issues

1. **Camera not working**:
   - Check browser permissions
   - Ensure camera is not being used by another app
   - Try refreshing the page

2. **AI scoring not working**:
   - Ensure Python dependencies are installed (`numpy`, `scipy`, `dtaidistance`)
   - Check that backend server is running on port 8080
   - Verify pose data is being captured during dance

3. **Music generation failing**:
   - Check API keys in `.env` files
   - Ensure video upload is working properly
   - Verify internet connection for API calls

4. **Performance issues**:
   - Close other browser tabs
   - Ensure good lighting for pose detection
   - Check that both frontend and backend servers are running

### Browser Compatibility

- **Recommended**: Chrome, Firefox, Safari (latest versions)
- **Requirements**: WebRTC support, Canvas API, ES6+ support

## Development

### Key Components

- **Frontend**:
  - `Game.tsx`: Main game orchestration and state management
  - `Camera.tsx`: Camera interface with pose detection
  - `Scoring.tsx`: Score display with AI feedback integration
  - `PoseDetector.tsx`: MediaPipe pose detection and landmark processing

- **Backend**:
  - `index.ts`: Main server with API endpoints for scoring and music generation
  - `claude.ts`: Claude AI integration for emotion analysis
  - `suno.ts`: Suno API integration for music generation
  - `real_time_pose_scorer.py`: Advanced AI scoring algorithms

### API Endpoints

- `POST /upload_video`: Upload video for emotion analysis and music generation
- `POST /get_score`: Submit pose data for AI scoring and feedback
- `GET /download/:filename`: Download generated music files

## Contributing

This is a hackathon project for HackMIT 2025. The project demonstrates the integration of multiple AI technologies for creating an intelligent dance coaching experience.

### Technologies Used

- **Frontend**: React, TypeScript, MediaPipe
- **Backend**: Node.js, TypeScript, Express
- **AI/ML**: Python, NumPy, SciPy, Claude AI, Suno API
- **Computer Vision**: MediaPipe Pose Detection

## License

MIT License - see LICENSE file for details
