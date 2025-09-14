import { EmotionAnalysis } from './types';
import dotenv from 'dotenv';
import { wait } from './utils/wait';

dotenv.config();

export const SUNO_API_URL = 'https://studio-api.prod.suno.com/api/v2/external/hackmit';

export const generatePrompt = (emotionAnalysis: EmotionAnalysis) => {
    const { emotions } = emotionAnalysis;

    // Find dominant emotions
    const sortedEmotions = Object.entries(emotions)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    const dominantEmotions = sortedEmotions.map(([emotion]) => emotion).join(', ');

    // Create musical style based on emotions
    let musicalStyle = '';
    let tempo = '';
    let key = '';

    if (emotions.happiness > 7) {
        musicalStyle = 'upbeat pop, cheerful';
        tempo = 'fast tempo';
        key = 'major key';
    } else if (emotions.sadness > 7) {
        musicalStyle = 'melancholic ballad, emotional';
        tempo = 'slow tempo';
        key = 'minor key';
    } else if (emotions.excitement > 7) {
        musicalStyle = 'energetic rock, dynamic';
        tempo = 'fast tempo';
        key = 'major key';
    } else if (emotions.calmness > 7) {
        musicalStyle = 'ambient, peaceful';
        tempo = 'slow tempo';
        key = 'major key';
    } else if (emotions.love > 7) {
        musicalStyle = 'romantic, heartfelt';
        tempo = 'medium tempo';
        key = 'major key';
    } else {
        musicalStyle = 'versatile, adaptive';
        tempo = 'medium tempo';
        key = 'neutral key';
    }

    tempo = 'fast tempo';

    const prompt = `Create a song in 4/4 time signature with zero phase offset that captures the essence of a scene evoking ${dominantEmotions} emotions. 
  The song should be 30 seconds long.
  The song should be in ${key} with a tempo of ${tempo}. 
  
  The song should evoke the same emotional response as the original scene through melody, harmony, and rhythm.
  Make it emotionally resonant and musically compelling. `

    console.log(prompt);

    // return `Create a ${musicalStyle} instrumental piece in ${key} with ${tempo}. The music should evoke feelings of ${dominantEmotions}. Style: cinematic and emotional, suitable for accompanying visual media. Duration: 30-60 seconds.`;
    return prompt;
};

export const generateMusic = async (emotionAnalysis: EmotionAnalysis) => {
    try {
        const prompt = generatePrompt(emotionAnalysis);

        const response = await fetch(`${SUNO_API_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.SUNO_API_KEY}`,
            },
            body: JSON.stringify({
                topic: prompt,
                make_instrumental: false,
                wait_audio: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`Suno API error: ${response.status}`);
        }

        const data = await response.json() as {id: string};

        const audio_id = data.id;

        let res_data = {} as { audio_url: any };

        while (true) {
            await wait(5 * 1000);
            const response = await fetch(`${SUNO_API_URL}/clips?ids=${audio_id}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.SUNO_API_KEY}`,
                },
            });
            const d = await response.json() as [{status: string, audio_url: string}];
            if (d[0].status === 'streaming') {
                res_data = d[0];
                break;
            }
        }

        return res_data.audio_url; 
    } catch (error) {
        console.error('Music generation error:', error);

        // Fallback mock music generation for development/testing
        const mockMusic = {
            title: 'Emotional Symphony',
            description: `A beautiful instrumental piece that captures the essence of your media. This composition blends ${Object.entries(
                emotionAnalysis.emotions
            )
                .sort(([, a], [, b]) => b - a)
                .slice(0, 2)
                .map(([emotion]) => emotion)
                .join(' and ')} to create a unique musical experience.`,
            audioUrl: undefined, // No actual audio in mock mode
            status: 'completed',
        };

        return mockMusic;
    }
};
