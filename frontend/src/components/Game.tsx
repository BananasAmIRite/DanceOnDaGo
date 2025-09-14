import React, { useRef, useState, useCallback, useEffect } from 'react';
import PoseDetector, { PoseLandmark } from './PoseDetector';
import Scoring from './Scoring';
import './Game.css';

export interface GameData {
  capturedImage: string;
  emotions?: any;
  musicUrl?: string;
  correctLandmarks?: any[][];
  processingComplete: boolean;
}

interface PoseHistoryEntry {
  landmarks: PoseLandmark[];
  timestamp: number; // Time in milliseconds since music started
}

interface GameProps {
  gameData: GameData;
  onBackToCamera: () => void;
  onSongEnd?: () => void;
  onPoseHistoryUpdate?: (history: PoseHistoryEntry[]) => void;
}

const Game: React.FC<GameProps> = (props) => {
  const { gameData, onBackToCamera } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [poseData, setPoseData] = useState<PoseLandmark[] | null>(null);
  const currentReferencePoseRef = useRef<PoseLandmark[] | null>(null);
  const [poseHistory, setPoseHistory] = useState<PoseHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const musicStartTimeRef = useRef<number | null>(null);
  const musicStartedRef = useRef<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showStartButton, setShowStartButton] = useState(true);
  const [showScoring, setShowScoring] = useState(false);

  // Note: This useEffect won't trigger when ref changes since refs don't cause re-renders
  // Keeping for initial logging only
  // useEffect(() => {
  //   console.log("Game component mounted, initial referencePose:", currentReferencePoseRef.current);
  // }, []); 
  
  // Configurable countdown duration (in seconds)
  const COUNTDOWN_DURATION = 3;

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1920, height: 1080 },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Failed to access camera. Please ensure you have granted camera permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
  }, [stream]);


  const handlePoseDetected = useCallback((landmarks: PoseLandmark[]) => {
    setPoseData(landmarks);
    if (musicStartedRef.current && musicStartTimeRef.current !== null) {
      const currentTime = Date.now();
      const timestamp = currentTime - musicStartTimeRef.current;
      
      // Calculate which reference pose frame to show based on timestamp
      const frameIndex = Math.round(60 / 1000 * timestamp); // 60 FPS reference data
      if (gameData.correctLandmarks && frameIndex < gameData.correctLandmarks.length) {
        currentReferencePoseRef.current = gameData.correctLandmarks[frameIndex];
      }
      
      setPoseHistory(prev => {
        const newEntry: PoseHistoryEntry = {
          landmarks,
          timestamp
        };
        const newHistory = [...prev, newEntry];
        if (props.onPoseHistoryUpdate) {
          props.onPoseHistoryUpdate(newHistory);
        }
        return newHistory;
      });
    }
  }, [props, gameData.correctLandmarks]);

  const handleSongEnd = useCallback(() => {
    musicStartedRef.current = false;
    if (props.onSongEnd) {
      props.onSongEnd();
    } else {
      setShowScoring(true);
    }
  }, [props]);

  const startCountdown = useCallback(() => {
    setShowStartButton(false);
    setCountdown(COUNTDOWN_DURATION);
    
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          musicStartedRef.current = true;
          musicStartTimeRef.current = Date.now(); // Record when music starts
          // Start music after countdown
          if (audioRef.current && gameData.musicUrl) {
            audioRef.current.play().catch(console.error);
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [COUNTDOWN_DURATION, gameData.musicUrl]);

  const handleStartGame = useCallback(() => {
    startCountdown();
  }, [startCountdown]);

  // Auto-start camera when component mounts
  useEffect(() => {
    startCamera();
    
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, [startCamera]);

  return (
    <div className="game-container-fullscreen">
      {error && (
        <div className="error-overlay">
          {error}
        </div>
      )}

      {/* Full-screen video feed */}
      <div className="video-container-fullscreen">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="video-fullscreen"
        />
        
        {/* Pose overlay canvas */}
        <canvas 
          ref={overlayCanvasRef} 
          className="pose-overlay-fullscreen"
        />
      </div>

      {/* PoseDetector component */}
      <PoseDetector
        videoRef={videoRef as React.RefObject<HTMLVideoElement>}
        canvasRef={overlayCanvasRef as React.RefObject<HTMLCanvasElement>}
        isStreaming={isStreaming}
        onPoseDetected={handlePoseDetected}
        referencePose={currentReferencePoseRef}
      />

      {/* Start button overlay */}
      {showStartButton && (
        <div className="start-button-overlay">
          <div className="start-content">
            <h2>Ready to Dance?</h2>
            <button onClick={handleStartGame} className="btn btn-start">
              Start Game
            </button>
          </div>
        </div>
      )}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="countdown-overlay">
          <div className="countdown-number">
            {countdown}
          </div>
          <div className="countdown-text">
            Get Ready!
          </div>
        </div>
      )}

      {/* Hidden audio element for music */}
      {gameData.musicUrl && (
        <audio 
          ref={audioRef}
          preload="auto"
          onEnded={handleSongEnd}
        >
          <source src={gameData.musicUrl} type="audio/mpeg" />
        </audio>
      )}
      <button onClick={handleSongEnd} style={{position: "absolute", top: "10px", right: "10px", zIndex: 1000}}>skip</button>
    </div>
  );
};

const GameWithScoring: React.FC<GameProps> = (props) => {
  const [showScoring, setShowScoring] = useState(false);
  const [poseHistory, setPoseHistory] = useState<PoseHistoryEntry[]>([]);
  
  // Use correct landmarks from gameData, default to empty array
  const correctLandmarks = props.gameData.correctLandmarks || [];
  // In a real implementation, this would contain the expected poses for each frame
  
  if (showScoring) {
    return (
      <Scoring 
        poseHistory={poseHistory}
        correctLandmarks={correctLandmarks}
        gameData={props.gameData} 
        onBackToCamera={() => {
          setShowScoring(false);
          setPoseHistory([]);
          props.onBackToCamera();
        }} 
      />
    );
  }

  return (
    <Game 
      {...props} 
      onSongEnd={() => setShowScoring(true)}
      onPoseHistoryUpdate={setPoseHistory}
    />
  );
};

export default GameWithScoring;
