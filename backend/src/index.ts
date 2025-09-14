import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { analyzeEmotions } from './claude';
import { generateMusic } from './suno';
import { downloadMp3 } from './utils/downloadMp3';
import { close } from 'fs';
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


    // const correctLandmarks = [
    //     {
    //         "x": 0.5423151850700378,
    //         "y": 0.5083906650543213,
    //         "z": 0.2010207623243332,
    //         "visibility": 0.9975668787956238
    //     },
    //     {
    //         "x": 0.3094378113746643,
    //         "y": 0.4582330882549286,
    //         "z": -0.461479127407074,
    //         "visibility": 0.9998565912246704
    //     },
    //     {
    //         "x": 0.68757164478302,
    //         "y": 0.4013097584247589,
    //         "z": 0.6193047761917114,
    //         "visibility": 0.9416890144348145
    //     },
    //     {
    //         "x": 0.22485633194446564,
    //         "y": 0.8265430331230164,
    //         "z": -0.6321607232093811,
    //         "visibility": 0.9774661660194397
    //     },
    //     {
    //         "x": 0.6729303598403931,
    //         "y": 0.15440741181373596,
    //         "z": 1.0620172023773193,
    //         "visibility": 0.9869805574417114
    //     },
    //     {
    //         "x": 0.3010285496711731,
    //         "y": 1.0632961988449097,
    //         "z": -0.719206690788269,
    //         "visibility": 0.9220154285430908
    //     },
    //     {
    //         "x": 0.44793421030044556,
    //         "y": 1.0992045402526855,
    //         "z": 0.17829068005084991,
    //         "visibility": 0.6339947581291199
    //     },
    //     {
    //         "x": 0.2655290961265564,
    //         "y": 1.129392147064209,
    //         "z": -0.17599758505821228,
    //         "visibility": 0.650085985660553
    //     },
    //     {
    //         "x": 0.4417381286621094,
    //         "y": 1.6524783372879028,
    //         "z": 0.16952940821647644,
    //         "visibility": 0.00881913211196661
    //     },
    //     {
    //         "x": 0.2686839997768402,
    //         "y": 1.6515926122665405,
    //         "z": -0.2074006050825119,
    //         "visibility": 0.015996672213077545
    //     },
    //     {
    //         "x": 0.4106599688529968,
    //         "y": 2.1275155544281006,
    //         "z": 0.5434763431549072,
    //         "visibility": 0.00048727981629781425
    //     },
    //     {
    //         "x": 0.234624981880188,
    //         "y": 2.126542806625366,
    //         "z": 0.03254587575793266,
    //         "visibility": 0.0013454663567245007
    //     }
    // ]; 
    // const c = []; 
    // for (let i = 0; i < 10000; i++) {
    //     c.push(correctLandmarks); 
    // }

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

        for (let j = 0; j < Math.min(pose.length, correctPose.length); j++) {
            const poseLandmark = pose[j];
            const correctPoseLandmark = correctPose[j];

            const distance = Math.min(Math.max(Math.sqrt(Math.pow(poseLandmark.x - correctPoseLandmark.x, 2) + Math.pow(poseLandmark.y - correctPoseLandmark.y, 2)), 0), 1); // [0, 1]

            totDist += distance;
            n++;
        }
    }

    const score = 100 - (totDist / n) * 100;
    
    res.json({
        message: "Score calculated successfully!",
        score
    });
});

const PORT = process.env.PORT || 3000;

console.log(PORT);

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
