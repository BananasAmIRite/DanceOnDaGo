import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();

// CORS middleware with default settings
app.use(cors());

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic health check endpoint
app.get("/", (req, res) => {
    res.json({ message: "Server is running!" });
});

const PORT = process.env.PORT || 3000;

console.log(PORT);

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
