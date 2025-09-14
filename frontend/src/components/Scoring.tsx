import React, { useState, useEffect } from 'react';
import { PoseLandmark } from './PoseDetector';
import './Scoring.css';

interface ScoringProps {
  poseHistory: PoseLandmark[][];
  correctLandmarks: PoseLandmark[][];
  gameData: any;
  onBackToCamera: () => void;
}

interface ScoreData {
  score: number;
  feedback: string;
  breakdown: {
    baseScore: number;
    bonusPoints: number;
    totalMoves: number;
  };
}

const Scoring: React.FC<ScoringProps> = ({ poseHistory, correctLandmarks, gameData, onBackToCamera }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculateScore = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/get_score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            poseHistory: poseHistory,
            correctLandmarks: correctLandmarks,
            gameData: gameData
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to get score');
        }
        
        const data = await response.json();
        setScoreData(data);
      } catch (error) {
        console.error('Error getting score:', error);
        setError('Failed to calculate score. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    calculateScore();
  }, [poseHistory, correctLandmarks, gameData]);

  if (isLoading) {
    return (
      <div className="scoring-container">
        <div className="scoring-loading">
          <div className="scoring-spinner"></div>
          <h2>Calculating Your Score...</h2>
          <p>Analyzing your dance moves</p>
          <div className="loading-details">
            <div className="loading-step">
              <span className="step-icon">🕺</span>
              <span>Processing pose data...</span>
            </div>
            <div className="loading-step">
              <span className="step-icon">🎵</span>
              <span>Matching rhythm patterns...</span>
            </div>
            <div className="loading-step">
              <span className="step-icon">⭐</span>
              <span>Calculating final score...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scoring-container">
        <div className="scoring-error">
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={onBackToCamera} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!scoreData) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#FFD700'; // Gold
    if (score >= 75) return '#00FF00'; // Green
    if (score >= 60) return '#FFA500'; // Orange
    return '#FF6B6B'; // Red
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  };

  return (
    <div className="scoring-container">
      <div className="scoring-content">
        <div className="scoring-header">
          <h1>Dance Complete!</h1>
        </div>

        <div className="score-main">
          <div className="score-circle" style={{ borderColor: getScoreColor(scoreData.score) }}>
            <div className="score-number" style={{ color: getScoreColor(scoreData.score) }}>
              {scoreData.score}
            </div>
            <div className="score-grade" style={{ color: getScoreColor(scoreData.score) }}>
              {getScoreGrade(scoreData.score)}
            </div>
          </div>
        </div>


        <div className="scoring-actions">
          <button onClick={onBackToCamera} className="btn btn-primary">
            Dance Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default Scoring;
