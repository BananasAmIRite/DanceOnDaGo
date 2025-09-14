export interface EmotionAnalysis {
    emotions: {                    
        happiness: number,
        sadness: number,
        anger: number,
        fear: number,
        surprise: number,
        love: number,
        calmness: number,
        excitement: number,
    };
    description: string;
  }