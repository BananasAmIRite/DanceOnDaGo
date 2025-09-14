import React from 'react';
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
    console.log(gameData);
  return (
    <div className="game-container">
      <h1>Game Page</h1>
      
      <div className="game-content">
        <div className="captured-section">
          <h2>Your Captured Image</h2>
          {gameData.capturedImage && (
            <img 
              src={gameData.capturedImage} 
              alt="Captured" 
              className="game-image" 
            />
          )}
        </div>

        <div className="processing-results">
          <h2>Processing Results</h2>
          {gameData.emotions && (
            <div className="emotions-display">
              <h3>Detected Emotions:</h3>
              <pre>{JSON.stringify(gameData.emotions, null, 2)}</pre>
            </div>
          )}
          
          {gameData.musicUrl && (
            <div className="music-section">
              <h3>Generated Music:</h3>
              <p>Music URL: {gameData.musicUrl}</p>
              <audio controls>
                <source src={gameData.musicUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>

        <div className="game-actions">
          <button onClick={onBackToCamera} className="btn btn-primary">
            Take Another Picture
          </button>
        </div>
      </div>
    </div>
  );
};

export default Game;
