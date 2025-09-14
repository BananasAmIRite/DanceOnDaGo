import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

interface PoseDetectorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  onPoseDetected?: (landmarks: any[]) => void;
}

interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

const PoseDetector: React.FC<PoseDetectorProps> = ({
  videoRef,
  canvasRef,
  isStreaming,
  onPoseDetected
}) => {
  const poseRef = useRef<Pose | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentPose, setCurrentPose] = useState<PoseLandmark[] | null>(null);

  const onResults = useCallback((results: any) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      // Draw pose connections
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: '#00FF00',
        lineWidth: 4
      });

      // Draw pose landmarks
      drawLandmarks(ctx, results.poseLandmarks, {
        color: '#FF0000',
        lineWidth: 2,
        radius: 6
      });

      // Update current pose state
      setCurrentPose(results.poseLandmarks);
      
      // Call callback with pose data
      if (onPoseDetected) {
        onPoseDetected(results.poseLandmarks);
      }
    }
  }, [canvasRef, videoRef, onPoseDetected]);

  const initializePose = useCallback(async () => {
    if (!videoRef.current || isInitialized) return;

    try {
      // Initialize MediaPipe Pose
      const pose = new Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults(onResults);

      // Initialize camera
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            await pose.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480
      });

      poseRef.current = pose;
      cameraRef.current = camera;
      setIsInitialized(true);

      // Start camera if streaming
      if (isStreaming) {
        await camera.start();
      }
    } catch (error) {
      console.error('Error initializing pose detection:', error);
    }
  }, [videoRef, isStreaming, onResults, isInitialized]);

  useEffect(() => {
    if (isStreaming && !isInitialized) {
      initializePose();
    } else if (!isStreaming && cameraRef.current) {
      cameraRef.current.stop();
    }
  }, [isStreaming, initializePose, isInitialized]);

  useEffect(() => {
    if (isStreaming && isInitialized && cameraRef.current) {
      cameraRef.current.start();
    }
  }, [isStreaming, isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (poseRef.current) {
        poseRef.current.close();
      }
    };
  }, []);

  // Helper function to get specific pose landmarks
  const getPoseLandmark = useCallback((landmarkIndex: number): PoseLandmark | null => {
    if (!currentPose || !currentPose[landmarkIndex]) return null;
    return currentPose[landmarkIndex];
  }, [currentPose]);

  // Helper function to calculate angle between three points
  const calculateAngle = useCallback((point1: PoseLandmark, point2: PoseLandmark, point3: PoseLandmark): number => {
    const radians = Math.atan2(point3.y - point2.y, point3.x - point2.x) - 
                   Math.atan2(point1.y - point2.y, point1.x - point2.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    return angle;
  }, []);

  // Helper function to get dance-relevant body angles
  const getDanceMetrics = useCallback(() => {
    if (!currentPose) return null;

    const landmarks = {
      leftShoulder: getPoseLandmark(11),
      rightShoulder: getPoseLandmark(12),
      leftElbow: getPoseLandmark(13),
      rightElbow: getPoseLandmark(14),
      leftWrist: getPoseLandmark(15),
      rightWrist: getPoseLandmark(16),
      leftHip: getPoseLandmark(23),
      rightHip: getPoseLandmark(24),
      leftKnee: getPoseLandmark(25),
      rightKnee: getPoseLandmark(26),
      leftAnkle: getPoseLandmark(27),
      rightAnkle: getPoseLandmark(28)
    };

    // Calculate key angles for dance moves
    const metrics = {
      leftArmAngle: landmarks.leftShoulder && landmarks.leftElbow && landmarks.leftWrist 
        ? calculateAngle(landmarks.leftShoulder, landmarks.leftElbow, landmarks.leftWrist) 
        : null,
      rightArmAngle: landmarks.rightShoulder && landmarks.rightElbow && landmarks.rightWrist 
        ? calculateAngle(landmarks.rightShoulder, landmarks.rightElbow, landmarks.rightWrist) 
        : null,
      leftLegAngle: landmarks.leftHip && landmarks.leftKnee && landmarks.leftAnkle 
        ? calculateAngle(landmarks.leftHip, landmarks.leftKnee, landmarks.leftAnkle) 
        : null,
      rightLegAngle: landmarks.rightHip && landmarks.rightKnee && landmarks.rightAnkle 
        ? calculateAngle(landmarks.rightHip, landmarks.rightKnee, landmarks.rightAnkle) 
        : null,
      landmarks
    };

    return metrics;
  }, [currentPose, getPoseLandmark, calculateAngle]);

  // This component doesn't render anything visible, it just handles pose detection
  return null;
};

export default PoseDetector;
