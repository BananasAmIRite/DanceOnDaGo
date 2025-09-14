import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { analyzeEmotions } from './claude';
import { generateMusic } from './suno';
import { downloadMp3 } from './utils/downloadMp3';
import { close, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import normalizeSet, { normalizeSingle } from './utils/norm';

// Load environment variables
dotenv.config();

const app = express();

// CORS middleware with default settings
app.use(cors());

// Body parser middleware
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true }));

// Basic health check endpoint
app.get("/", (req, res) => {
    res.json({ message: "Server is running!" });
});

app.post("/upload-video-base64", async (req, res) => {
    const image = req.body.imageData;

    const emotions = await analyzeEmotions(image);

    console.log(emotions);

    const musicUrl = await generateMusic(emotions);
    
    console.log(musicUrl);

    const musicFile = await downloadMp3(musicUrl, {outputDir: "./downloads", filename: "music.mp3"});

    const analyzerProcess = spawn('python3', ['./nn/data_analyzer.py']);

    let output = ""; 

    analyzerProcess.stdout.on('data', (data) => {
        console.log('data!');
        console.log(data.toString()); 
        output += data.toString(); 
    });

    analyzerProcess.on('close', (code) => {
        const out = normalizeSet(JSON.parse(output)); 

        for (let i = 0; i < out.length; i++) {
            for (let j = 0; j < out[i].length; j++) {
                // @ts-ignore
                out[i][j]["visibility"] = 1; // out[i][j]["z"];
                // @ts-ignore
                out[i][j]["z"] = 0.15;
            }
        }

        for (let i = 0; i < out.length; i++) {
            out[i].splice(0, 5);
        }

        console.log(out); 
        
        console.log(`Child process exited with code ${code}`);
        
        res.json({ 
            message: "Video uploaded successfully!", 
            emotions: emotions, 
            musicUrl: musicUrl,
            correctLandmarks: out // Empty array for now - will be populated with reference poses in the future
        });
    });

})

app.post("/get_score", async (req, res) => {
    const { poseHistory, correctLandmarks, gameData } = req.body;

    let totDist = 0;
    let n = 0; 

    const userFrames = [];
    const rightFrames = []; 

    for (let i = 0; i < poseHistory.length; i++) {
        // through each frame
        const poseEntry = poseHistory[i]; // { landmarks: PoseLandmark[], timestamp: number }
        const pose = poseEntry.landmarks; // Extract landmarks from the entry

        /**
         * n*1000/60 = elapsed time in ms where n is index
         * n = 60 / 1000 * elapsed time in ms
         */

        const closestElapsedFrame = Math.round(60 / 1000 * poseEntry.timestamp);

        if (closestElapsedFrame >= correctLandmarks.length) continue;

        const correctPose = normalizeSingle(correctLandmarks[closestElapsedFrame]); // [[0, 1], [0, 1]]

        const userFrame = []; 
        const rightFrame = []; 
        for (const p of pose) {
            userFrame.push([p.x, p.y]); 
        }
        for (const c of correctPose) {
            rightFrame.push([c.x, c.y]); 
        }

        userFrames.push(userFrame); 
        rightFrames.push(rightFrame); 

        for (let j = 0; j < Math.min(pose.length, correctPose.length); j++) {
            const poseLandmark = pose[j];
            const correctPoseLandmark = correctPose[j];

            const distance = Math.min(Math.max(Math.sqrt(Math.pow(poseLandmark.x - correctPoseLandmark.x, 2) + Math.pow(poseLandmark.y - correctPoseLandmark.y, 2)), 0), 1); // [0, 1]

            totDist += distance;
            n++;
        }
    }

    
    const spatialScore = 100 - (totDist / n) * 100;
    let timingScore = 0; 
    let rhythmScore = 0; 
    let feedback = ""; 

    // Write data to temporary files instead of passing as arguments
    writeFileSync("./temp_user_frames.json", JSON.stringify(userFrames)); 
    writeFileSync("./temp_right_frames.json", JSON.stringify(rightFrames));

    const analyzerProcess = spawn('python3', ['./nn/scoring/real_time_pose_scorer.py', './temp_user_frames.json', './temp_right_frames.json']);

    let output = ""; 

    analyzerProcess.stdout.on('data', (data) => {
        console.log('data!');
        console.log(data.toString()); 
        output += data.toString();
        
        const lines = data.toString().split('\n');
        for (const line of lines) {
            if (line.includes("Timing:")) {
                timingScore = parseFloat(line.split(":")[1].trim());
            }
            if (line.includes("Rhythm:")) {
                rhythmScore = parseFloat(line.split(":")[1].trim());
            }
            if (line.includes("Feedback:")) {
                feedback = line.split(":")[1].trim();
            }
        }
    });

    analyzerProcess.on('close', (code) => {
        console.log(`Scorer process exited with code ${code}`);
        writeFileSync("./output.json", output);
        
        // Send response after process completes
        res.json({
            message: "Score calculated successfully!",
            score: (spatialScore*0.4 + timingScore*0.3 + rhythmScore*0.3),
            feedback: feedback
        });
    });
});

const PORT = process.env.PORT || 3000;

console.log(PORT);

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
