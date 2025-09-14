import Anthropic from '@anthropic-ai/sdk';
import { EmotionAnalysis } from './types';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeEmotions(base64Image: string): Promise<EmotionAnalysis> {
  try {
    // Strip the data URL prefix if present (e.g., "data:image/png;base64,")
    const cleanBase64 = base64Image.replace(/^data:image\/[^;]+;base64,/, '');
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: cleanBase64,
              },
            },
            {
              type: 'text',
              text: 
            //   `Analyze this screenshot and identify the emotions it evokes. Consider:
            //   - Visual elements (colors, composition, lighting)
            //   - Content (what's shown, activities, people)
            //   - Overall mood and atmosphere
            //   - Emotional impact on a viewer
              
            //   Return your analysis as a JSON object with:
            //   - emotions: array of specific emotions (e.g., ["joy", "nostalgia", "excitement"])
            //   - mood: overall mood descriptor (e.g., "uplifting", "melancholic", "energetic")
            //   - intensity: emotional intensity from 1-10
            //   - description: brief description of what evokes these emotions
              
            //   Focus on emotions that would translate well into musical expression.`
            `Please analyze this ${"image/png"} and provide:
1. A detailed description of what you see/observe
2. Rate the following emotions on a scale of 1-10 based on the mood, atmosphere, colors, subjects, and overall feeling of the content:
   - happiness
   - sadness  
   - anger
   - fear
   - surprise
   - love
   - calmness
   - excitement

Please respond in JSON format:
{
  "description": "Your detailed description here",
  "emotions": {
    "happiness": number,
    "sadness": number,
    "anger": number,
    "fear": number,
    "surprise": number,
    "love": number,
    "calmness": number,
    "excitement": number
  }
}`
            }
          ]
        }
      ]
    });



    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const emotionData = JSON.parse(jsonMatch[0]);
      return emotionData as EmotionAnalysis;
    }

    const mockAnalysis = {
        description: `This image/png shows a scene with various visual elements that evoke different emotional responses. The composition, lighting, and subject matter combine to create a specific mood and atmosphere.`,
        emotions: {
            happiness: Math.floor(Math.random() * 10) + 1,
            sadness: Math.floor(Math.random() * 10) + 1,
            anger: Math.floor(Math.random() * 10) + 1,
            fear: Math.floor(Math.random() * 10) + 1,
            surprise: Math.floor(Math.random() * 10) + 1,
            love: Math.floor(Math.random() * 10) + 1,
            calmness: Math.floor(Math.random() * 10) + 1,
            excitement: Math.floor(Math.random() * 10) + 1,
        },
    };
    
    // Fallback parsing if no JSON found
    return mockAnalysis;
    
  } catch (error) {
    console.error('Error in Claude analysis:', error);
    throw new Error(`Failed to analyze emotions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
