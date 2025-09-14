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

export const normalizePose = (fullPose: PoseLandmark[]) => {
// TODO: normalize pose
};