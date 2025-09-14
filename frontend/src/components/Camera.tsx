import PoseDetector from './PoseDetector';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import './Camera.css';

interface GameData {
  capturedImage: string;
  emotions?: any;
  musicUrl?: string;
  processingComplete: boolean;
}

interface CameraProps {
  onNavigateToGame: (data: GameData) => void;
}

const Camera: React.FC<CameraProps> = ({ onNavigateToGame }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [poseData, setPoseData] = useState<any>(null);
  const [showPoseOverlay, setShowPoseOverlay] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
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

  // Auto-start camera when component mounts
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
  }, [stream]);

  const takePicture = useCallback(async () => {
    if (videoRef.current && canvasRef.current && isStreaming) {
      // Start loading state
      setIsLoading(true);
      setLoadingMessage('Capturing image...');
      setCapturedImage(null);
      setError(null);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoHeight, video.videoWidth);
        
        const imageDataUrl = canvas.toDataURL('image/png');
        console.log(imageDataUrl); 
        setCapturedImage(imageDataUrl);
        // Stop the camera first
        stopCamera();

        // Send image to server
        try {
          setLoadingMessage('Analyzing Image...');
          const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';
          const response = await axios.post(`${backendUrl}/upload-video-base64`, {
            imageData: imageDataUrl
          });
          
          setLoadingMessage('Generating Music...');
          console.log('Image sent to server:', response.data);
          
          // Simulate additional processing time for music generation
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          setLoadingMessage('Processing complete!');
          
          // Prepare game data and navigate to game page
          const gameData: GameData = {
            capturedImage: imageDataUrl,
            emotions: response.data.emotions,
            musicUrl: response.data.musicUrl,
            processingComplete: true
          };
          
          // Show completion message briefly before navigating
          setTimeout(() => {
            setIsLoading(false);
            setLoadingMessage('');
            onNavigateToGame(gameData);
          }, 1500);
          
        } catch (error) {
          console.error('Error sending image to server:', error);
          setError('Failed to process image');
          setIsLoading(false);
          setLoadingMessage('');
          // Restart camera even on error
          setTimeout(() => {
            startCamera();
          }, 2000);
        }
      }
    }
  }, [isStreaming, stopCamera, startCamera]);

  const downloadImage = useCallback(() => {
    if (capturedImage) {
      const link = document.createElement('a');
      link.download = `photo-${Date.now()}.png`;
      link.href = capturedImage;
      link.click();
    }
  }, [capturedImage]);

  const clearImage = useCallback(() => {
    setCapturedImage(null);
  }, []);

  const handlePoseDetected = useCallback((landmarks: any[]) => {
    setPoseData(landmarks);
  }, []);

  const togglePoseOverlay = useCallback(() => {
    setShowPoseOverlay(!showPoseOverlay);
  }, [showPoseOverlay]);

  return (
    <div className="camera-container">
      <h2>Dance On The Go</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="camera-controls">
        
        {isStreaming && (
          <>
            <button onClick={takePicture} className="btn btn-success">
              Take Picture
            </button>
          </>
        )}
      </div>

      <div className="camera-preview">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`video-preview ${!isStreaming ? 'hidden' : ''}`}
        />
        <canvas ref={canvasRef} className="hidden" />
        {showPoseOverlay && (
          <canvas 
            ref={overlayCanvasRef} 
            className="pose-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>

      {isLoading ? (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <h3>{loadingMessage}</h3>
          <p>Process your image...</p>
        </div>
      ) : null}
    </div>
  );
};

export default Camera;
