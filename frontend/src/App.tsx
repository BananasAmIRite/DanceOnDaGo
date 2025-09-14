import React, { useState } from 'react';
import Camera from './components/Camera';
import Game from './components/Game';
import './App.css';

interface GameData {
  capturedImage: string;
  emotions?: any;
  musicUrl?: string;
  correctLandmarks?: any[][];
  processingComplete: boolean;
}

function App() {
  const [currentPage, setCurrentPage] = useState<'camera' | 'game'>('camera');
  const [gameData, setGameData] = useState<GameData>({
    capturedImage: '',
    processingComplete: false
  });

  const handleNavigateToGame = (data: GameData) => {
    setGameData(data);
    setCurrentPage('game');
  };

  const handleBackToCamera = () => {
    setCurrentPage('camera');
    setGameData({
      capturedImage: '',
      processingComplete: false
    });
  };

  return (
    <div className="App">
      {currentPage === 'camera' ? (
        <Camera onNavigateToGame={handleNavigateToGame} />
      ) : (
        <Game gameData={gameData} onBackToCamera={handleBackToCamera} />
      )}
    </div>
  );
}

export default App;
