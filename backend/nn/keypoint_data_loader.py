import pickle
import numpy as np
import os
from typing import List, Tuple, Dict, Optional
import json
from dataclasses import dataclass

@dataclass
class DanceSequence:
    """Container for a complete dance sequence"""
    keypoints: np.ndarray  # Shape: (frames, joints, 2) for 2D keypoints
    dance_style: str
    motion_type: str  # sBM, sFM, sMM
    difficulty: str   # d01, d02, etc.
    character: str    # ch01, ch02, etc.
    filename: str
    frame_rate: float = 30.0

class KeypointDataLoader:
    """Loads and processes keypoint data from the existing dataset"""
    
    def __init__(self, keypoints_dir: str = "./nn/keypoints2d"):
        self.keypoints_dir = keypoints_dir
        self.dance_styles = {
            'gBR': 'Break Dance',
            'gCH': 'Charleston', 
            'gHO': 'House',
            'gJB': 'Jazz Ballet',
            'gJS': 'Jazz',
            'gJZ': 'Jazz',
            'gKR': 'Krump',
            'gLH': 'Latin Hip Hop',
            'gLO': 'Locking',
            'gMH': 'Modern Hip Hop',
            'gPO': 'Popping',
            'gTP': 'Tap',
            'gWA': 'Waacking'
        }
        
        self.motion_types = {
            'sBM': 'Basic Motion',
            'sFM': 'Female Motion', 
            'sMM': 'Male Motion'
        }
    
    def parse_filename(self, filename: str) -> Dict[str, str]:
        """Parse dance filename to extract metadata"""
        # Example: gBR_sBM_cAll_d04_mBR0_ch01.pkl
        parts = filename.replace('.pkl', '').split('_')
        
        metadata = {
            'dance_style': parts[0] if len(parts) > 0 else 'unknown',
            'motion_type': parts[1] if len(parts) > 1 else 'unknown',
            'choreography': parts[2] if len(parts) > 2 else 'unknown',
            'difficulty': parts[3] if len(parts) > 3 else 'unknown',
            'music': parts[4] if len(parts) > 4 else 'unknown',
            'character': parts[5] if len(parts) > 5 else 'unknown'
        }
        
        return metadata
    
    def load_keypoint_file(self, filepath: str) -> Optional[np.ndarray]:
        """Load keypoints from a pickle file"""
        try:
            with open(filepath, 'rb') as f:
                data = pickle.load(f)
            
            # Handle different data formats
            if isinstance(data, np.ndarray):
                return data
            elif isinstance(data, dict):
                # Try common keys for keypoint data
                for key in ['keypoints', 'poses', 'joints', 'landmarks']:
                    if key in data:
                        return np.array(data[key])
                # If no standard key found, try to find array data
                for value in data.values():
                    if isinstance(value, np.ndarray) and len(value.shape) >= 2:
                        return value
            elif isinstance(data, list):
                return np.array(data)
            
            print(f"Warning: Unknown data format in {filepath}")
            return None
            
        except Exception as e:
            print(f"Error loading {filepath}: {e}")
            return None
    
    def normalize_keypoints_format(self, keypoints: np.ndarray) -> np.ndarray:
        """Normalize keypoints to consistent format (frames, joints, 2)"""
        if keypoints is None:
            return None
        
        # Handle different input shapes
        if len(keypoints.shape) == 4:
            # Shape: (cameras, frames, joints, coords) - take 0th camera
            keypoints = keypoints[0]  # Now shape: (frames, joints, coords)
            
        if len(keypoints.shape) == 2:
            # Assume (joints, 2) - single frame
            return keypoints.reshape(1, keypoints.shape[0], keypoints.shape[1])
        elif len(keypoints.shape) == 3:
            # (frames, joints, coords) - already correct format
            if keypoints.shape[2] > 2:
                # Take only x, y coordinates if z is present
                return keypoints[:, :, :2]
            return keypoints
        elif len(keypoints.shape) == 1:
            # Flattened format - try to reshape
            # Assume 17 joints (COCO format) with x,y coordinates
            if len(keypoints) % 34 == 0:  # 17 joints * 2 coords
                frames = len(keypoints) // 34
                return keypoints.reshape(frames, 17, 2)
            elif len(keypoints) % 50 == 0:  # 25 joints * 2 coords
                frames = len(keypoints) // 50
                return keypoints.reshape(frames, 25, 2)
        
        print(f"Warning: Cannot normalize keypoints with shape {keypoints.shape}")
        return keypoints
    
    def convert_to_mediapipe_format(self, keypoints: np.ndarray) -> np.ndarray:
        """Convert keypoints to MediaPipe pose format (33 landmarks)"""
        if keypoints is None:
            return None
        
        frames, joints, coords = keypoints.shape
        
        # Create MediaPipe format array (33 landmarks with x,y,z)
        mediapipe_keypoints = np.zeros((frames, 33, 3))
        
        # Map existing keypoints to MediaPipe landmarks
        # This is a simplified mapping - you may need to adjust based on your data format
        if joints == 17:  # COCO format
            # Map COCO keypoints to MediaPipe pose landmarks
            coco_to_mediapipe = {
                0: 0,   # nose
                1: 2,   # left_eye  
                2: 5,   # right_eye
                3: 7,   # left_ear
                4: 8,   # right_ear
                5: 11,  # left_shoulder
                6: 12,  # right_shoulder
                7: 13,  # left_elbow
                8: 14,  # right_elbow
                9: 15,  # left_wrist
                10: 16, # right_wrist
                11: 23, # left_hip
                12: 24, # right_hip
                13: 25, # left_knee
                14: 26, # right_knee
                15: 27, # left_ankle
                16: 28, # right_ankle
            }
            
            for coco_idx, mp_idx in coco_to_mediapipe.items():
                if coco_idx < joints:
                    mediapipe_keypoints[:, mp_idx, :2] = keypoints[:, coco_idx, :]
        
        elif joints == 25:  # Possibly OpenPose format
            # Similar mapping for 25-point format
            # Add your specific mapping here
            mediapipe_keypoints[:, :min(joints, 33), :2] = keypoints[:, :min(joints, 33), :]
        
        else:
            # Direct mapping for other formats
            mediapipe_keypoints[:, :min(joints, 33), :2] = keypoints[:, :min(joints, 33), :]
        
        return mediapipe_keypoints
    
    def load_dance_sequence(self, filename: str) -> Optional[DanceSequence]:
        """Load a complete dance sequence"""
        filepath = os.path.join(self.keypoints_dir, filename)
        
        if not os.path.exists(filepath):
            print(f"File not found: {filepath}")
            return None
        
        # Load keypoints
        raw_keypoints = self.load_keypoint_file(filepath)
        if raw_keypoints is None:
            return None
        
        # Normalize format
        normalized_keypoints = self.normalize_keypoints_format(raw_keypoints)
        if normalized_keypoints is None:
            return None
        
        # Convert to MediaPipe format
        mediapipe_keypoints = self.convert_to_mediapipe_format(normalized_keypoints)
        
        # Parse metadata
        metadata = self.parse_filename(filename)
        
        return DanceSequence(
            keypoints=mediapipe_keypoints,
            dance_style=self.dance_styles.get(metadata['dance_style'], metadata['dance_style']),
            motion_type=self.motion_types.get(metadata['motion_type'], metadata['motion_type']),
            difficulty=metadata['difficulty'],
            character=metadata['character'],
            filename=filename
        )
    
    def get_available_dances(self) -> List[str]:
        """Get list of available dance files"""
        if not os.path.exists(self.keypoints_dir):
            return []
        
        return [f for f in os.listdir(self.keypoints_dir) if f.endswith('.pkl')]
    
    def get_dances_by_style(self, style: str) -> List[str]:
        """Get dances filtered by style"""
        all_dances = self.get_available_dances()
        return [d for d in all_dances if d.startswith(style)]
    
    def get_dances_by_difficulty(self, difficulty: str) -> List[str]:
        """Get dances filtered by difficulty"""
        all_dances = self.get_available_dances()
        return [d for d in all_dances if difficulty in d]
    
    def load_random_reference_dance(self, style: Optional[str] = None) -> Optional[DanceSequence]:
        """Load a random dance sequence for use as reference"""
        import random
        
        if style:
            available_dances = self.get_dances_by_style(style)
        else:
            available_dances = self.get_available_dances()
        
        if not available_dances:
            return None
        
        random_dance = random.choice(available_dances)
        return self.load_dance_sequence(random_dance)
    
    def create_dataset_summary(self) -> Dict:
        """Create a summary of the dataset"""
        all_dances = self.get_available_dances()
        
        summary = {
            'total_files': len(all_dances),
            'dance_styles': {},
            'motion_types': {},
            'difficulties': {},
            'sample_files': all_dances[:10]  # First 10 files as samples
        }
        
        for filename in all_dances:
            metadata = self.parse_filename(filename)
            
            # Count dance styles
            style = metadata['dance_style']
            summary['dance_styles'][style] = summary['dance_styles'].get(style, 0) + 1
            
            # Count motion types
            motion = metadata['motion_type']
            summary['motion_types'][motion] = summary['motion_types'].get(motion, 0) + 1
            
            # Count difficulties
            difficulty = metadata['difficulty']
            summary['difficulties'][difficulty] = summary['difficulties'].get(difficulty, 0) + 1
        
        return summary

def test_data_loader():
    """Test the data loader functionality"""
    print("Testing Keypoint Data Loader...")
    
    loader = KeypointDataLoader()
    
    # Get dataset summary
    summary = loader.create_dataset_summary()
    print(f"\nDataset Summary:")
    print(f"Total files: {summary['total_files']}")
    print(f"Dance styles: {summary['dance_styles']}")
    print(f"Motion types: {summary['motion_types']}")
    print(f"Difficulties: {summary['difficulties']}")
    
    # Test loading a specific dance
    available_dances = loader.get_available_dances()
    if available_dances:
        print(f"\nTesting with first available dance: {available_dances[0]}")
        dance_sequence = loader.load_dance_sequence(available_dances[0])
        
        if dance_sequence:
            print(f"Successfully loaded dance:")
            print(f"  Style: {dance_sequence.dance_style}")
            print(f"  Motion Type: {dance_sequence.motion_type}")
            print(f"  Difficulty: {dance_sequence.difficulty}")
            print(f"  Keypoints shape: {dance_sequence.keypoints.shape}")
            print(f"  Frames: {dance_sequence.keypoints.shape[0]}")
            print(f"  Joints: {dance_sequence.keypoints.shape[1]}")
        else:
            print("Failed to load dance sequence")
    
    # Test loading by style
    jazz_dances = loader.get_dances_by_style('gJZ')
    print(f"\nFound {len(jazz_dances)} jazz dances")
    
    # Test random reference dance
    random_dance = loader.load_random_reference_dance()
    if random_dance:
        print(f"\nLoaded random reference dance: {random_dance.filename}")
        print(f"  Style: {random_dance.dance_style}")

if __name__ == "__main__":
    test_data_loader()