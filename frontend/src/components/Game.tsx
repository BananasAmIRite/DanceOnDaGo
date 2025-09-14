import React, { useRef, useState, useCallback, useEffect } from 'react';
import PoseDetector from './PoseDetector';
import './Game.css';

interface GameData {
  capturedImage: string;
  emotions?: any;
  musicUrl?: string;
  processingComplete: boolean;
}

interface GameProps {
  gameData: GameData;
  onBackToCamera: () => void;
}

const Game: React.FC<GameProps> = ({ gameData, onBackToCamera }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [poseData, setPoseData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [musicStarted, setMusicStarted] = useState(false);
  const [showStartButton, setShowStartButton] = useState(true);
  
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

  const handlePoseDetected = useCallback((landmarks: any[]) => {
    setPoseData(landmarks);
  }, []);

  const startCountdown = useCallback(() => {
    setShowStartButton(false);
    setCountdown(COUNTDOWN_DURATION);
    
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          setMusicStarted(true);
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
        >
          <source src={gameData.musicUrl} type="audio/mpeg" />
        </audio>
      )}
    </div>
  );
};

export default Game;
