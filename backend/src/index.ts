import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { analyzeEmotions } from './claude';
import { generateMusic } from './suno';
import { downloadMp3 } from './utils/downloadMp3';

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

    res.json({ message: "Video uploaded successfully!" });
})

const PORT = process.env.PORT || 3000;

console.log(PORT);

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
