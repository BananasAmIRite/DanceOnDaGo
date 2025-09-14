import { LandmarkConnectionArray } from '@mediapipe/pose';
import { PoseLandmark } from '../components/PoseDetector';

export const POSE_CONNECTIONS_PRUNED: LandmarkConnectionArray = [
    [0, 1],  // left shoulder to right
    [0, 2],  // left shoulder to elbow
    [1, 3],  // right shoulder to elbow
    [2, 4], // left elbow to wrist
    [3, 5],  // right elbow to wrist
    [0, 6], // left shoulder to left hip
    [1, 7], // right shoulder to right hip
    [6, 8], // left hip to left knee
    [7, 9], // right hip to right knee
    [8, 10], // left knee to left ankle
    [9, 11], // right knee to right ankle
    [6, 7], // left hip to right hip
];

export const prunePose = (fullPose: PoseLandmark[]) => {
    return [
        fullPose[11], // left shoulder - 5 - 0
        fullPose[12], // right shoulder - 6 - 1
        fullPose[13], // left elbow - 7 - 2
        fullPose[14], // right elbow - 8 - 3
        fullPose[15], // left wrist - 9 - 4
        fullPose[16], // right wrist - 10 - 5
        fullPose[23], // left hip - 11 - 6
        fullPose[24], // right hip - 12 - 7
        fullPose[25], // left knee - 13 - 8
        fullPose[26], // right knee  - 14 - 9
        fullPose[27], // left ankle - 15 - 10
        fullPose[28], // right ankle - 16 - 11
    ]; 
}

export const avgPoseLandmark = (fullPose: PoseLandmark[]) => {
    const sum = fullPose.reduce((acc, pose) => {
        return {
            x: acc.x + pose.x,
            y: acc.y + pose.y,
            z: acc.z + pose.z,
            visibility: acc.visibility + pose.visibility,
        };
    }, { x: 0, y: 0, z: 0, visibility: 0 });
    
    return {
        x: sum.x / fullPose.length,
        y: sum.y / fullPose.length,
        z: sum.z / fullPose.length,
        visibility: sum.visibility / fullPose.length,
    };
}

export const normalizePose = (fullPose: PoseLandmark[]) => {
    const avg = avgPoseLandmark(fullPose);

    // const maxX = fullPose.reduce((b, pose) => Math.max(pose.x, b), 0);
    // const minX = fullPose.reduce((b, pose) => Math.min(pose.x, b), 0);
    // const maxY = fullPose.reduce((b, pose) => Math.max(pose.y, b), 0);
    // const minY = fullPose.reduce((b, pose) => Math.min(pose.y, b), 0);
// TODO: normalize pose
// TODO: currently no normalization since the data is normalized from [0, 1]. If need be, can transfer to different domain. 
    return fullPose.map(pose => {
        return {
            // x: (pose.x - avg.x)/(maxX - minX) + 0.5,
            // y: (pose.y - avg.y)/(maxY - minY) + 0.5,
            // z: pose.z / Math.abs(pose.z),
            // visibility: 1,
            x: pose.x,
            y: pose.y,
            z: pose.z,
            visibility: pose.visibility,
        };
    }); 
};