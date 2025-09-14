import numpy as np
import time
from typing import List, Tuple, Dict, Optional, Union
from dataclasses import dataclass
from collections import deque
from scipy.spatial.distance import euclidean, cosine
from dtaidistance import dtw
import math
import json
import sys

@dataclass
class PoseScore:
    """Individual pose scoring result"""
    spatial_score: float
    timing_score: float
    rhythm_score: float
    frame_score: float
    timestamp: float

@dataclass
class FinalScoreResult:
    """Final scoring result with detailed breakdown"""
    overall_score: float  # 0-100%
    spatial_score: float  # 0-100%
    timing_score: float   # 0-100%
    rhythm_score: float   # 0-100%
    total_poses: int
    alignment_quality: float
    feedback: str

class RealTimePoseScorer:
    """Real-time pose scoring system for dance performance evaluation"""
    
    def __init__(self, 
                 spatial_weight: float = 0.4,
                 timing_weight: float = 0.3,
                 rhythm_weight: float = 0.3,
                 alpha: float = 2.0,
                 smoothing_factor: float = 0.3,
                 max_history: int = 100):
        """
        Initialize the real-time pose scorer.
        
        Args:
            spatial_weight: Weight for spatial accuracy (pose similarity)
            timing_weight: Weight for timing accuracy
            rhythm_weight: Weight for rhythm matching
            alpha: Distance penalty factor for exponential decay
            smoothing_factor: EWMA smoothing factor (0-1)
            max_history: Maximum number of poses to keep in history
        """
        self.spatial_weight = spatial_weight
        self.timing_weight = timing_weight
        self.rhythm_weight = rhythm_weight
        self.alpha = alpha
        self.smoothing_factor = smoothing_factor
        self.max_history = max_history
        
        # Scoring state
        self.user_poses = deque(maxlen=max_history)
        self.user_timestamps = deque(maxlen=max_history)
        self.reference_poses = []
        self.reference_timestamps = []
        self.pose_scores = deque(maxlen=max_history)
        
        # Preprocessing state
        self.pose_history = deque(maxlen=5)  # For smoothing
        self.start_time = None
        self.current_ref_index = 0
        
    def load_reference_dance(self, poses: List[np.ndarray], timestamps: Optional[List[float]] = None):
        """
        Load reference dance sequence.
        
        Args:
            poses: List of reference poses, each as np.ndarray (N, 2) or (N, 3)
            timestamps: Optional timestamps for each pose
        """
        self.reference_poses = poses
        if timestamps is None:
            # Generate timestamps assuming 30 FPS
            self.reference_timestamps = [i / 60.0 for i in range(len(poses))]
        else:
            self.reference_timestamps = timestamps
        
        print(f"Loaded reference dance with {len(poses)} poses")
    
    def normalize_pose(self, pose: np.ndarray) -> np.ndarray:
        """
        Normalize pose by height and center it.
        
        Args:
            pose: Input pose as np.ndarray (N, 2) or (N, 3)
            
        Returns:
            Normalized pose
        """
        # Ensure pose is at least 2D
        if len(pose.shape) == 1:
            # If 1D, reshape to (N, 2) assuming x,y pairs
            if len(pose) % 2 == 0:
                pose = pose.reshape(-1, 2)
            else:
                # Pad with zeros if odd length
                pose = np.append(pose, 0).reshape(-1, 2)
        
        if pose.shape[0] == 0:
            return pose
        
        # Filter out invalid points (0,0) coordinates
        valid_mask = ~((pose[:, 0] == 0) & (pose[:, 1] == 0))
        if not np.any(valid_mask):
            return pose
        
        valid_points = pose[valid_mask]
        
        # Get bounding box
        min_coords = np.min(valid_points, axis=0)
        max_coords = np.max(valid_points, axis=0)
        
        # Calculate height for normalization
        height = max_coords[1] - min_coords[1]
        if height == 0:
            height = 1.0
        
        # Center and scale
        center = (min_coords + max_coords) / 2
        normalized = pose.copy()
        normalized = (normalized - center) / height
        
        return normalized
    
    def smooth_pose(self, pose: np.ndarray) -> np.ndarray:
        """
        Apply EWMA smoothing to pose.
        
        Args:
            pose: Current pose
            
        Returns:
            Smoothed pose
        """
        if len(self.pose_history) == 0:
            self.pose_history.append(pose)
            return pose
        
        # Get previous smoothed pose
        prev_pose = self.pose_history[-1]
        
        # Apply EWMA smoothing
        smoothed = self.smoothing_factor * pose + (1 - self.smoothing_factor) * prev_pose
        
        self.pose_history.append(smoothed)
        return smoothed
    
    def compute_pose_distance(self, pose1: np.ndarray, pose2: np.ndarray) -> float:
        """
        Compute distance between two poses focusing on upper body.
        
        Args:
            pose1, pose2: Poses to compare
            
        Returns:
            Distance between poses
        """
        # Focus on upper body joints (more relevant for dance)
        # Assuming MediaPipe-like format, adjust indices as needed
        if pose1.shape[0] >= 17:  # COCO format
            upper_body_indices = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]  # shoulders to ankles
        else:
            upper_body_indices = list(range(min(pose1.shape[0], pose2.shape[0])))
        
        pose1_upper = pose1[upper_body_indices]
        pose2_upper = pose2[upper_body_indices]
        
        return euclidean(pose1_upper.flatten(), pose2_upper.flatten())
    
    def compute_joint_angles(self, pose: np.ndarray) -> np.ndarray:
        """
        Compute key joint angles from pose.
        
        Args:
            pose: Input pose
            
        Returns:
            Array of joint angles
        """
        # Define joint triplets for angle computation (parent, joint, child)
        # Adjust indices based on your pose format
        if pose.shape[0] >= 17:  # COCO format
            angle_triplets = [
                (5, 7, 9),   # Left arm: shoulder-elbow-wrist
                (6, 8, 10),  # Right arm: shoulder-elbow-wrist
                (11, 13, 15), # Left leg: hip-knee-ankle
                (12, 14, 16), # Right leg: hip-knee-ankle
            ]
        else:
            # Fallback for smaller pose formats
            angle_triplets = []
        
        angles = []
        for parent, joint, child in angle_triplets:
            if max(parent, joint, child) < len(pose):
                # Vectors from joint to parent and child
                v1 = pose[parent] - pose[joint]
                v2 = pose[child] - pose[joint]
                
                # Compute angle
                norm1, norm2 = np.linalg.norm(v1), np.linalg.norm(v2)
                if norm1 > 0 and norm2 > 0:
                    cos_angle = np.dot(v1, v2) / (norm1 * norm2)
                    angle = np.arccos(np.clip(cos_angle, -1, 1))
                    angles.append(angle)
                else:
                    angles.append(0.0)
            else:
                angles.append(0.0)
        
        return np.array(angles)
    
    def find_best_reference_match(self, user_pose: np.ndarray, timestamp: float) -> Tuple[int, float]:
        """
        Find the best matching reference pose using temporal alignment.
        
        Args:
            user_pose: Current user pose
            timestamp: Current timestamp
            
        Returns:
            Tuple of (reference_index, distance)
        """
        if len(self.reference_poses) == 0:
            return 0, float('inf')
        
        # Simple temporal alignment - map user time to reference time
        if self.start_time is None:
            self.start_time = timestamp
        
        elapsed_time = timestamp - self.start_time
        ref_duration = self.reference_timestamps[-1] if self.reference_timestamps else 1.0
        
        # Map elapsed time to reference timeline
        progress = (elapsed_time % ref_duration) / ref_duration
        ref_index = int(progress * len(self.reference_poses))
        ref_index = min(ref_index, len(self.reference_poses) - 1)
        
        # Compute distance to matched reference pose
        distance = self.compute_pose_distance(user_pose, self.reference_poses[ref_index])
        
        return ref_index, distance
    
    def compute_frame_score(self, distance: float) -> float:
        """
        Compute per-frame score using exponential decay.
        
        Args:
            distance: Distance between poses
            
        Returns:
            Frame score (0-1)
        """
        return np.clip(np.exp(-self.alpha * distance), 0, 1)
    
    def compute_timing_score(self) -> float:
        """
        Compute timing accuracy based on pose sequence consistency.
        
        Returns:
            Timing score (0-1)
        """
        if len(self.user_timestamps) < 2:
            return 0.5
        
        # Check frame rate consistency
        time_diffs = []
        for i in range(1, len(self.user_timestamps)):
            diff = self.user_timestamps[i] - self.user_timestamps[i-1]
            time_diffs.append(diff)
        
        if time_diffs:
            expected_diff = 1.0 / 30.0  # 30 FPS
            timing_consistency = 1.0 - min(np.std(time_diffs) / expected_diff, 1.0)
            return max(timing_consistency, 0.0)
        
        return 0.5
    
    def compute_rhythm_score(self) -> float:
        """
        Compute rhythm score based on movement velocity correlation.
        
        Returns:
            Rhythm score (0-1)
        """
        if len(self.user_poses) < 3:
            return 0.5
        
        # Compute user movement velocities
        user_velocities = []
        for i in range(1, len(self.user_poses)):
            velocity = np.linalg.norm(self.user_poses[i] - self.user_poses[i-1])
            user_velocities.append(velocity)
        
        # Compute reference movement velocities for comparison
        if len(self.reference_poses) >= 2:
            ref_velocities = []
            for i in range(1, min(len(self.reference_poses), len(user_velocities) + 1)):
                velocity = np.linalg.norm(self.reference_poses[i] - self.reference_poses[i-1])
                ref_velocities.append(velocity)
            
            # Compute correlation if we have enough data
            if len(user_velocities) >= 3 and len(ref_velocities) >= 3:
                min_len = min(len(user_velocities), len(ref_velocities))
                user_vel = user_velocities[:min_len]
                ref_vel = ref_velocities[:min_len]
                
                if np.std(user_vel) > 0 and np.std(ref_vel) > 0:
                    correlation = np.corrcoef(user_vel, ref_vel)[0, 1]
                    return np.clip(correlation, 0, 1) if not np.isnan(correlation) else 0.5
        
        # Fallback: consistency of user movement
        if len(user_velocities) >= 2:
            velocity_consistency = 1.0 - min(np.std(user_velocities) / (np.mean(user_velocities) + 1e-6), 1.0)
            return max(velocity_consistency, 0.0)
        
        return 0.5
    
    def score_pose(self, user_pose: np.ndarray, timestamp: Optional[float] = None) -> PoseScore:
        """
        Score a single pose in real-time.
        
        Args:
            user_pose: User's pose as np.ndarray (N, 2) or (N, 3)
            timestamp: Optional timestamp (auto-generated if None)
            
        Returns:
            PoseScore with individual component scores
        """
        if timestamp is None:
            timestamp = time.time()
        
        # Preprocess pose
        normalized_pose = self.normalize_pose(user_pose)
        smoothed_pose = self.smooth_pose(normalized_pose)
        
        # Add to history
        self.user_poses.append(smoothed_pose)
        self.user_timestamps.append(timestamp)
        
        # Find best reference match and compute spatial score
        ref_index, distance = self.find_best_reference_match(smoothed_pose, timestamp)
        frame_score = self.compute_frame_score(distance)
        spatial_score = frame_score
        
        # Compute timing and rhythm scores
        timing_score = self.compute_timing_score()
        rhythm_score = self.compute_rhythm_score()
        
        # Create pose score
        pose_score = PoseScore(
            spatial_score=spatial_score,
            timing_score=timing_score,
            rhythm_score=rhythm_score,
            frame_score=frame_score,
            timestamp=timestamp
        )
        
        self.pose_scores.append(pose_score)
        return pose_score
    
    def get_current_score(self) -> float:
        """
        Get current overall score (0-100%).
        
        Returns:
            Current score as percentage
        """
        if not self.pose_scores:
            return 0.0
        
        # Get recent scores for current performance
        recent_scores = list(self.pose_scores)[-min(30, len(self.pose_scores)):]
        
        spatial_avg = np.mean([s.spatial_score for s in recent_scores])
        timing_avg = np.mean([s.timing_score for s in recent_scores])
        rhythm_avg = np.mean([s.rhythm_score for s in recent_scores])
        
        overall = (self.spatial_weight * spatial_avg + 
                  self.timing_weight * timing_avg + 
                  self.rhythm_weight * rhythm_avg)
        
        return overall * 100.0  # Convert to percentage
    
    def get_final_score(self) -> FinalScoreResult:
        """
        Get final comprehensive score after performance.
        
        Returns:
            FinalScoreResult with detailed breakdown
        """
        if not self.pose_scores:
            return FinalScoreResult(0.0, 0.0, 0.0, 0.0, 0, 0.0, "No poses scored")
        
        # Compute average scores
        all_scores = list(self.pose_scores)
        spatial_avg = np.mean([s.spatial_score for s in all_scores]) * 100
        timing_avg = np.mean([s.timing_score for s in all_scores]) * 100
        rhythm_avg = np.mean([s.rhythm_score for s in all_scores]) * 100
        
        overall = (self.spatial_weight * spatial_avg + 
                  self.timing_weight * timing_avg + 
                  self.rhythm_weight * rhythm_avg)
        
        # Compute alignment quality
        frame_scores = [s.frame_score for s in all_scores]
        alignment_quality = np.mean(frame_scores) * 100
        
        # Generate feedback
        feedback = self._generate_feedback(overall, spatial_avg, timing_avg, rhythm_avg)
        
        return FinalScoreResult(
            overall_score=overall,
            spatial_score=spatial_avg,
            timing_score=timing_avg,
            rhythm_score=rhythm_avg,
            total_poses=len(all_scores),
            alignment_quality=alignment_quality,
            feedback=feedback
        )
    
    def _generate_feedback(self, overall: float, spatial: float, timing: float, rhythm: float) -> str:
        """Generate performance feedback based on scores."""
        feedback_parts = []
        
        if overall >= 90:
            return "Outstanding performance! Perfect execution!"
        elif overall >= 80:
            return "Excellent dancing! Great job!"
        elif overall >= 70:
            return "Good performance! Keep practicing!"
        elif overall >= 60:
            return "Nice effort! Focus on improvement areas below."
        
        # Specific feedback for low scores
        if spatial < 60:
            feedback_parts.append("improve pose accuracy")
        if timing < 60:
            feedback_parts.append("work on timing consistency")
        if rhythm < 60:
            feedback_parts.append("focus on rhythm and flow")
        
        if feedback_parts:
            return "Try to " + " and ".join(feedback_parts) + "."
        else:
            return "Keep practicing to improve your performance!"
    
    def reset(self):
        """Reset the scorer for a new performance."""
        self.user_poses.clear()
        self.user_timestamps.clear()
        self.pose_scores.clear()
        self.pose_history.clear()
        self.start_time = None
        self.current_ref_index = 0

# Convenience functions for easy integration

def create_pose_scorer(reference_poses: List[np.ndarray], 
                      reference_timestamps: Optional[List[float]] = None,
                      **kwargs) -> RealTimePoseScorer:
    """
    Create and initialize a pose scorer with reference dance.
    
    Args:
        reference_poses: List of reference poses
        reference_timestamps: Optional timestamps for reference poses
        **kwargs: Additional arguments for RealTimePoseScorer
        
    Returns:
        Initialized RealTimePoseScorer
    """
    scorer = RealTimePoseScorer(**kwargs)
    scorer.load_reference_dance(reference_poses, reference_timestamps)
    return scorer

def score_pose_realtime(scorer: RealTimePoseScorer, 
                       user_pose: np.ndarray, 
                       timestamp: Optional[float] = None) -> Tuple[PoseScore, float]:
    """
    Score a pose in real-time and get current overall score.
    
    Args:
        scorer: Initialized RealTimePoseScorer
        user_pose: User's pose
        timestamp: Optional timestamp
        
    Returns:
        Tuple of (PoseScore, current_overall_score_percentage)
    """
    pose_score = scorer.score_pose(user_pose, timestamp)
    current_score = scorer.get_current_score()
    return pose_score, current_score

def score_complete_performance(reference_poses: List[np.ndarray],
                             user_poses: List[np.ndarray],
                             user_timestamps: Optional[List[float]] = None,
                             **kwargs) -> FinalScoreResult:
    """
    Score a complete dance performance.
    
    Args:
        reference_poses: Reference dance poses
        user_poses: User's poses
        user_timestamps: Optional timestamps for user poses
        **kwargs: Additional arguments for RealTimePoseScorer
        
    Returns:
        FinalScoreResult with comprehensive scoring
    """
    scorer = create_pose_scorer(reference_poses, **kwargs)
    
    # Score all poses
    for i, pose in enumerate(user_poses):
        timestamp = user_timestamps[i] if user_timestamps else time.time() + i * 0.033
        scorer.score_pose(pose, timestamp)
    
    return scorer.get_final_score()

# Example usage
def example_usage():
    """Example of how to use the real-time pose scorer"""
    



if __name__ == "__main__":
    if len(sys.argv) >= 3:
        # Read from files
        with open(sys.argv[1], 'r') as f:
            user_data = json.load(f)
        with open(sys.argv[2], 'r') as f:
            reference_data = json.load(f)
        
        # Convert to numpy arrays
        user_poses = [np.array(pose) for pose in user_data]
        reference_poses = [np.array(pose) for pose in reference_data]
    else:
        # Fallback to dummy data
        reference_poses = [np.random.rand(17, 2) for _ in range(30)]
        user_poses = [np.random.rand(17, 2) for _ in range(17)]


    # Create scorer
    scorer = create_pose_scorer(reference_poses)
    
    # Simulate real-time scoring
    for i in range(len(user_poses)):
        # Score pose
        pose_score, current_score = score_pose_realtime(scorer, user_poses[i])
    
    # Get final score
    final_result = scorer.get_final_score()
    print(f"\n=== FINAL PERFORMANCE SCORE ===")
    print(f"Timing: {final_result.timing_score:.1f}")
    print(f"Rhythm: {final_result.rhythm_score:.1f}")
    print(f"Feedback: {final_result.feedback}")