import React, { useRef, useState, useCallback } from 'react';
import './Camera.css';

interface CameraProps {}

const Camera: React.FC<CameraProps> = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
  }, [stream]);

  const takePicture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        const imageDataUrl = canvas.toDataURL('image/png');
        setCapturedImage(imageDataUrl);
      }
    }
  }, []);

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

  return (
    <div className="camera-container">
      <h2>Camera App</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="camera-controls">
        {!isStreaming ? (
          <button onClick={startCamera} className="btn btn-primary">
            Start Camera
          </button>
        ) : (
          <button onClick={stopCamera} className="btn btn-secondary">
            Stop Camera
          </button>
        )}
        
        {isStreaming && (
          <button onClick={takePicture} className="btn btn-success">
            Take Picture
          </button>
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
      </div>

      {capturedImage && (
        <div className="captured-image-section">
          <h3>Captured Photo</h3>
          <img src={capturedImage} alt="Captured" className="captured-image" />
          <div className="image-controls">
            <button onClick={downloadImage} className="btn btn-primary">
              Download
            </button>
            <button onClick={clearImage} className="btn btn-secondary">
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Camera;
