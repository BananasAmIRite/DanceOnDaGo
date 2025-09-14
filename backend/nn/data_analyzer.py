import librosa
import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import find_peaks
import json
from typing import List, Tuple, Dict
from dataclasses import dataclass
from enum import Enum
import random
from keypoint_data_loader import KeypointDataLoader
import pandas as pd

class DanceIntensity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

@dataclass
class IntensitySegment:
    start_time: float
    end_time: float
    intensity: DanceIntensity
    amplitude: float
    bpm: float
    combined_score: float
    should_transition: bool = True

class DanceMoveSampler:
    def __init__(self, 
                 amplitude_weight: float = 0.6,
                 bpm_weight: float = 0.4,
                 segment_duration: float = 5.0,
                 transition_smoothing: float = 0.1):
        """
        Initialize the dance move sampler.
        
        Args:
            amplitude_weight: Weight for amplitude in linear combination (0-1)
            bpm_weight: Weight for BPM in linear combination (0-1)
            segment_duration: Duration of each analysis segment in seconds
            transition_smoothing: Factor for smoothing transitions between segments
        """
        self.amplitude_weight = amplitude_weight
        self.bpm_weight = bpm_weight
        self.segment_duration = segment_duration
        self.transition_smoothing = transition_smoothing
        
        # Normalize weights
        total_weight = amplitude_weight + bpm_weight
        self.amplitude_weight /= total_weight
        self.bpm_weight /= total_weight
    
    def load_audio(self, file_path: str) -> Tuple[np.ndarray, int]:
        """Load audio file and return audio data and sample rate."""
        try:
            audio, sr = librosa.load(file_path, sr=None)
            return audio, sr
        except Exception as e:
            raise Exception(f"Error loading audio file {file_path}: {str(e)}")
    
    def analyze_amplitude(self, audio: np.ndarray, sr: int, segment_start: float, segment_end: float) -> float:
        """Analyze amplitude (RMS energy) for a specific time segment."""
        start_sample = int(segment_start * sr)
        end_sample = int(segment_end * sr)
        segment_audio = audio[start_sample:end_sample]
        
        if len(segment_audio) == 0:
            return 0.0
        
        # Calculate RMS energy
        rms = librosa.feature.rms(y=segment_audio, frame_length=2048, hop_length=512)[0]
        return np.mean(rms)
    
    def analyze_bpm(self, audio: np.ndarray, sr: int, segment_start: float, segment_end: float) -> float:
        """Analyze BPM for a specific time segment."""
        start_sample = int(segment_start * sr)
        end_sample = int(segment_end * sr)
        segment_audio = audio[start_sample:end_sample]
        
        if len(segment_audio) == 0:
            return 120.0  # Default BPM
        
        try:
            # Use librosa's tempo estimation
            tempo, _ = librosa.beat.beat_track(y=segment_audio, sr=sr)
            return float(tempo.item())
        except:
            # Fallback: analyze spectral flux for rhythm detection
            stft = librosa.stft(segment_audio)
            spectral_flux = np.sum(np.diff(np.abs(stft), axis=1) > 0, axis=0)
            
            # Find peaks in spectral flux
            peaks, _ = find_peaks(spectral_flux, height=np.mean(spectral_flux))
            
            if len(peaks) > 1:
                # Calculate average time between peaks
                peak_times = peaks * (len(segment_audio) / len(spectral_flux)) / sr
                intervals = np.diff(peak_times)
                avg_interval = np.mean(intervals)
                bpm = 60.0 / avg_interval if avg_interval > 0 else 120.0
                return min(max(bpm, 60.0), 200.0)  # Clamp to reasonable range
            
            return 120.0  # Default BPM
    
    def normalize_features(self, amplitudes: List[float], bpms: List[float]) -> Tuple[List[float], List[float]]:
        """Normalize amplitude and BPM values to 0-1 range."""
        # Normalize amplitudes
        if amplitudes:
            min_amp, max_amp = min(amplitudes), max(amplitudes)
            if max_amp > min_amp:
                norm_amplitudes = [(a - min_amp) / (max_amp - min_amp) for a in amplitudes]
            else:
                norm_amplitudes = [0.5] * len(amplitudes)
        else:
            norm_amplitudes = []
        
        # Normalize BPMs (typical range 60-200 BPM)
        norm_bpms = []
        for bpm in bpms:
            norm_bpm = (bpm - 60.0) / (200.0 - 60.0)
            norm_bpm = max(0.0, min(1.0, norm_bpm))  # Clamp to 0-1
            norm_bpms.append(norm_bpm)
        
        return norm_amplitudes, norm_bpms
    
    def calculate_intensity_score(self, norm_amplitude: float, norm_bpm: float) -> float:
        """Calculate combined intensity score using linear combination."""
        return (self.amplitude_weight * norm_amplitude + 
                self.bpm_weight * norm_bpm)
    
    def load_intensity_mappings(self) -> List[DanceIntensity]:
        """Load intensity mappings from CSV file"""
        try:
            csv_path = "./nn/dance_moves2.csv"
            df = pd.read_csv(csv_path)
            
            if 'index' not in df.columns or 'm' not in df.columns:
                print(f"Error: Required columns not found. Available columns: {df.columns.tolist()}")
                return []
            
            # Create a mapping dictionary from index to intensity
            intensity_dict = {}
            for _, row in df.iterrows():
                index = int(row['index'])
                intensity_str = str(row['m']).lower()
                
                if intensity_str == 'h':
                    intensity_dict[index] = DanceIntensity.HIGH
                elif intensity_str == 'm':
                    intensity_dict[index] = DanceIntensity.MEDIUM
                elif intensity_str == 'l':
                    intensity_dict[index] = DanceIntensity.LOW
                else:
                    intensity_dict[index] = DanceIntensity.MEDIUM  # Default fallback
            
            # Convert to ordered list based on indices (0 to max_index)
            if intensity_dict:
                max_index = max(intensity_dict.keys())
                mappings = []
                for i in range(max_index + 1):
                    if i in intensity_dict:
                        mappings.append(intensity_dict[i])
                    else:
                        mappings.append(DanceIntensity.MEDIUM)  # Default for missing indices
                return mappings
            else:
                return []
            
        except pd.errors.EmptyDataError:
            print("Error: CSV file is empty")
            return []
        except pd.errors.ParserError as e:
            print(f"Error parsing CSV file: {str(e)}")
            return []
        except Exception as e:
            print(f"Error loading intensity mappings: {str(e)}")
            return []
    
    def get_dance_duration(self, dance_filename: str) -> float:
        """Get the duration of a dance in seconds based on keypoint frames"""
        try:
            loader = KeypointDataLoader()
            dance_sequence = loader.load_dance_sequence(dance_filename)
            if dance_sequence and dance_sequence.keypoints is not None:
                num_frames = dance_sequence.keypoints.shape[0]
                duration = num_frames / dance_sequence.frame_rate
                return duration
            return 5.0  # Default fallback duration
        except Exception as e:
            return 5.0  # Default fallback duration

    def get_available_dance_files(self) -> List[str]:
        """Get list of available dance files"""
        try:
            loader = KeypointDataLoader()
            return loader.get_available_dances()
        except Exception as e:
            return []

    def get_dances_by_intensity(self, intensity: DanceIntensity, available_dances: List[str], intensity_mappings: List[DanceIntensity]) -> List[str]:
        """Get list of dance files for a specific intensity"""
        intensity_dances = []
        for i, dance_intensity in enumerate(intensity_mappings):
            if dance_intensity == intensity and i < len(available_dances):
                intensity_dances.append(available_dances[i])
        return intensity_dances

    def sample_dance_moves_for_song(self, audio_file: str, low_threshold: float, high_threshold: float, 
                                   frame_rate: float = 30.0, frame_delay: float = 0.0, 
                                   song_duration: float = None) -> List[Dict]:
        """
        Sample dance moves for every 5-second interval in a song based on BPM and amplitude analysis.
        
        Args:
            audio_file: Path to audio file
            low_threshold: Lower threshold for intensity classification (<=l = low)
            high_threshold: Higher threshold for intensity classification (>=h = high)
            frame_rate: Frames per second for pose generation (default: 30.0)
            frame_delay: Delay between frames in seconds (default: 0.0)
            song_duration: Optional song duration in seconds
            
        Returns:
            List of dictionaries containing pose data for each frame:
            [
                {
                    'frame_number': int,
                    'time': float,
                    'dance_file': str,
                    'dance_frame': int,
                    'intensity': str,
                    'pose_data': np.ndarray or None
                }
            ]
        """
        # Load intensity mappings from CSV
        intensity_mappings = self.load_intensity_mappings()
        if not intensity_mappings:
            return []
        
        # Get available dances by intensity
        available_dances = self.get_available_dance_files()
        high_dances = self.get_dances_by_intensity(DanceIntensity.HIGH, available_dances, intensity_mappings)
        medium_dances = self.get_dances_by_intensity(DanceIntensity.MEDIUM, available_dances, intensity_mappings)
        low_dances = self.get_dances_by_intensity(DanceIntensity.LOW, available_dances, intensity_mappings)
        
        try:
            # Load and analyze audio
            audio, sr = self.load_audio(audio_file)
            if song_duration is None:
                song_duration = len(audio) / sr
            
            # Collect amplitude and BPM data for normalization
            amplitudes = []
            bpms = []
            segments_data = []
            
            for start_time in np.arange(0, song_duration, 5.0):
                end_time = min(start_time + 5.0, song_duration)
                amplitude = self.analyze_amplitude(audio, sr, start_time, end_time)
                bpm = self.analyze_bpm(audio, sr, start_time, end_time)
                
                amplitudes.append(amplitude)
                bpms.append(bpm)
                segments_data.append((start_time, end_time, amplitude, bpm))
            
            # Normalize features
            norm_amplitudes, norm_bpms = self.normalize_features(amplitudes, bpms)
            
            # Generate pose sequence
            pose_sequence = []
            current_dance_file = None
            current_dance_duration = 0.0
            current_dance_elapsed = 0.0
            current_intensity = None
            frame_number = 0
            
            for i, (start_time, end_time, amplitude, bpm) in enumerate(segments_data):
                # Calculate intensity score using custom thresholds
                score = self.calculate_intensity_score(norm_amplitudes[i], norm_bpms[i])
                
                # Classify intensity using provided thresholds
                if score <= low_threshold:
                    intensity = DanceIntensity.LOW
                elif score >= high_threshold:
                    intensity = DanceIntensity.HIGH
                else:
                    intensity = DanceIntensity.MEDIUM
                
                # Determine if we need a new dance move
                need_new_dance = False
                
                if current_dance_file is None:
                    # First dance
                    need_new_dance = True
                elif current_dance_elapsed >= current_dance_duration:
                    # Current dance has ended
                    need_new_dance = True
                elif intensity != current_intensity and current_dance_elapsed > 2.0:
                    # Intensity changed and we've been dancing for at least 2 seconds
                    need_new_dance = True
                else:
                    # Check if we're about to run out of frames in current dance
                    if current_dance_file:
                        try:
                            loader = KeypointDataLoader()
                            filepath = f"{loader.keypoints_dir}/{current_dance_file}"
                            raw_keypoints = loader.load_keypoint_file(filepath)
                            
                            if raw_keypoints is not None:
                                # Get the actual number of frames in this dance
                                if len(raw_keypoints.shape) == 4:
                                    num_frames = raw_keypoints.shape[1]  # (cameras, frames, joints, coords)
                                elif len(raw_keypoints.shape) == 3:
                                    num_frames = raw_keypoints.shape[0]  # (frames, joints, coords)
                                else:
                                    num_frames = 1
                                
                                # Check if we'll exceed the available frames in this segment
                                frames_needed = int(segment_duration * frame_rate)
                                current_frame_index = int(current_dance_elapsed * frame_rate)
                                
                                if current_frame_index + frames_needed >= num_frames:
                                    need_new_dance = True
                        except:
                            pass
                
                # Select new dance if needed
                if need_new_dance:
                    # Try to find a dance without too many NaN values
                    max_retries = 10
                    current_dance_file = None
                    
                    for retry in range(max_retries):
                        # Choose dance based on intensity
                        if intensity == DanceIntensity.HIGH and high_dances:
                            selected_dance = random.choice(high_dances)
                        elif intensity == DanceIntensity.MEDIUM and medium_dances:
                            selected_dance = random.choice(medium_dances)
                        elif intensity == DanceIntensity.LOW and low_dances:
                            selected_dance = random.choice(low_dances)
                        else:
                            # Fallback to any available dance
                            selected_dance = random.choice(available_dances)
                        
                        # Check if this dance has reasonable data (sample a few frames)
                        try:
                            loader = KeypointDataLoader()
                            filepath = f"{loader.keypoints_dir}/{selected_dance}"
                            raw_keypoints = loader.load_keypoint_file(filepath)
                            
                            if raw_keypoints is not None:
                                # Get number of frames
                                if len(raw_keypoints.shape) == 4:
                                    num_frames = raw_keypoints.shape[1]
                                elif len(raw_keypoints.shape) == 3:
                                    num_frames = raw_keypoints.shape[0]
                                else:
                                    continue
                                
                                # Sample a few random frames to check for NaN
                                sample_frames = min(10, num_frames)
                                nan_count = 0
                                
                                for _ in range(sample_frames):
                                    frame_idx = random.randint(0, num_frames - 1)
                                    if len(raw_keypoints.shape) == 4:
                                        sample_pose = raw_keypoints[0, frame_idx]
                                    else:
                                        sample_pose = raw_keypoints[frame_idx]
                                    
                                    if np.isnan(sample_pose).any():
                                        nan_count += 1
                                
                                # If less than 30% of sampled frames have NaN, use this dance
                                if nan_count / sample_frames < 0.3:
                                    current_dance_file = selected_dance
                                    current_dance_duration = self.get_dance_duration(current_dance_file)
                                    current_dance_elapsed = 0.0
                                    current_intensity = intensity
                                    break
                        except:
                            continue
                    
                    # Fallback if no good dance found
                    if current_dance_file is None:
                        # Choose any dance based on intensity without NaN checking
                        if intensity == DanceIntensity.HIGH and high_dances:
                            current_dance_file = random.choice(high_dances)
                        elif intensity == DanceIntensity.MEDIUM and medium_dances:
                            current_dance_file = random.choice(medium_dances)
                        elif intensity == DanceIntensity.LOW and low_dances:
                            current_dance_file = random.choice(low_dances)
                        else:
                            current_dance_file = random.choice(available_dances)
                        
                        current_dance_duration = self.get_dance_duration(current_dance_file)
                        current_dance_elapsed = 0.0
                        current_intensity = intensity
                
                # Generate frames for this 5-second segment
                segment_duration = end_time - start_time
                total_frames = int(segment_duration * frame_rate)
                
                for frame_idx in range(total_frames):
                    frame_time = start_time + (frame_idx / frame_rate)
                    
                    # Apply frame delay if specified
                    if frame_delay > 0:
                        frame_time += frame_delay
                    
                    # Calculate which frame of the dance to use
                    dance_frame = int(current_dance_elapsed * frame_rate) + frame_idx
                    
                    # Load pose data if available
                    pose_data = None
                    if current_dance_file:
                        try:
                            loader = KeypointDataLoader()
                            # Load raw keypoint data without normalization
                            filepath = f"{loader.keypoints_dir}/{current_dance_file}"
                            raw_keypoints = loader.load_keypoint_file(filepath)
                            
                            if raw_keypoints is not None:
                                # Get the actual number of frames in this dance
                                if len(raw_keypoints.shape) == 4:
                                    num_frames = raw_keypoints.shape[1]  # (cameras, frames, joints, coords)
                                elif len(raw_keypoints.shape) == 3:
                                    num_frames = raw_keypoints.shape[0]  # (frames, joints, coords)
                                else:
                                    num_frames = 1
                                
                                # Loop the dance by using modulo
                                if num_frames > 0:
                                    dance_frame = dance_frame % num_frames
                                    # Handle 4D array: (cameras, frames, joints, coords) - take 0th camera
                                    if len(raw_keypoints.shape) == 4:
                                        candidate_pose = raw_keypoints[0, dance_frame]  # 0th camera, specific frame
                                    elif len(raw_keypoints.shape) == 3:
                                        candidate_pose = raw_keypoints[dance_frame]  # Standard 3D format
                                    
                                    # Strict NaN filtering - only accept poses with NO NaN values
                                    if candidate_pose is not None and not np.isnan(candidate_pose).any():
                                        pose_data = candidate_pose
                                    else:
                                        # Try to find a clean frame nearby
                                        for offset in range(1, min(50, num_frames)):
                                            for direction in [1, -1]:
                                                try_frame = (dance_frame + (offset * direction)) % num_frames
                                                if len(raw_keypoints.shape) == 4:
                                                    try_pose = raw_keypoints[0, try_frame]
                                                else:
                                                    try_pose = raw_keypoints[try_frame]
                                                
                                                if try_pose is not None and not np.isnan(try_pose).any():
                                                    pose_data = try_pose
                                                    break
                                            if pose_data is not None:
                                                break
                                        
                                        # If still no clean pose found, create a default pose
                                        if pose_data is None:
                                            # Create a simple default pose (17 joints with 3 coordinates each)
                                            pose_data = np.zeros((17, 3), dtype=np.float32)
                                            # Set some basic pose structure (standing position)
                                            pose_data[0] = [500, 200, 0.9]  # nose
                                            pose_data[1] = [490, 210, 0.9]  # left eye
                                            pose_data[2] = [510, 210, 0.9]  # right eye
                                            pose_data[5] = [480, 300, 0.9]  # left shoulder
                                            pose_data[6] = [520, 300, 0.9]  # right shoulder
                                            pose_data[11] = [480, 500, 0.9]  # left hip
                                            pose_data[12] = [520, 500, 0.9]  # right hip
                                        
                        except:
                            pose_data = None
                    
                    pose_sequence.append({
                        'frame_number': frame_number,
                        'time': frame_time,
                        'dance_file': current_dance_file,
                        'dance_frame': dance_frame,
                        'intensity': intensity.value,
                        'pose_data': pose_data
                    })
                    
                    frame_number += 1
                
                # Update elapsed time
                current_dance_elapsed += segment_duration
            
            return pose_sequence
            
        except Exception as e:
            print(f"Error during dance sampling: {str(e)}")
            return []

def example_dance_sampling(audio_file):
    """Example usage of the dance move sampling function."""
    
    # Initialize sampler
    sampler = DanceMoveSampler(
        amplitude_weight=0.6,
        bpm_weight=0.4,
        segment_duration=5.0
    )
    
    # Define thresholds
    low_threshold = 0.3   # <= 0.3 = low intensity
    high_threshold = 0.7  # >= 0.7 = high intensity
    
    try:
        # Sample dance moves for the song
        pose_sequence = sampler.sample_dance_moves_for_song(
            audio_file=audio_file,
            low_threshold=low_threshold,
            high_threshold=high_threshold,
            frame_rate=60.0,      # 30 FPS
            frame_delay=0.0,      # No delay between frames
            song_duration=None    # Auto-detect song duration
        )
        
        # Display results
        total_frames = len(pose_sequence)
        if total_frames > 0:
            duration = pose_sequence[-1]['time']
            unique_dances = len(set(p['dance_file'] for p in pose_sequence if p['dance_file']))
            
            return {
                'total_frames': total_frames,
                'duration': duration,
                'unique_dances': unique_dances,
                'sample_poses': pose_sequence[:5],  # First 5 poses as sample
                'pose_sequence': pose_sequence
            }
        else:
            return {'error': 'No poses generated'}
            
    except Exception as e:
        return {'error': f'Error during dance sampling: {str(e)}'}

def convert_pose_data_to_json(pose_sequence):
    """Convert numpy pose data to JSON-serializable format with {x, y, z} objects"""
    json_sequence = []

    for pose in pose_sequence:
        json_pose = pose.copy()

        # Convert numpy array to {x, y, z} object format
        if pose['pose_data'] is not None:
            pose_data = pose['pose_data']

            # Ensure it's a numpy array
            if isinstance(pose_data, np.ndarray):
                keypoints_list = []
                
                # Handle different array shapes
                if len(pose_data.shape) == 1:
                    # 1D array - reshape based on length
                    if len(pose_data) % 2 == 0:
                        # Assume x,y pairs
                        pose_2d = pose_data.reshape(-1, 2)
                        for i in range(pose_2d.shape[0]):
                            keypoints_list.append({
                                'x': float(pose_2d[i, 0]),
                                'y': float(pose_2d[i, 1]),
                                'z': 0.0,
                                'visibility': 1.0
                            })
                    elif len(pose_data) % 3 == 0:
                        # Assume x,y,z triplets
                        pose_3d = pose_data.reshape(-1, 3)
                        for i in range(pose_3d.shape[0]):
                            keypoints_list.append({
                                'x': float(pose_3d[i, 0]),
                                'y': float(pose_3d[i, 1]),
                                'z': float(pose_3d[i, 2]),
                                'visibility': 1.0
                            })
                
                elif len(pose_data.shape) == 2:
                    # 2D array (joints, coords)
                    for i in range(pose_data.shape[0]):
                        if pose_data.shape[1] >= 2:
                            keypoint = {
                                'x': float(pose_data[i, 0]),
                                'y': float(pose_data[i, 1]),
                                'z': float(pose_data[i, 2]) if pose_data.shape[1] > 2 else 0.0,
                                'visibility': float(pose_data[i, 3]) if pose_data.shape[1] > 3 else 1.0
                            }
                            keypoints_list.append(keypoint)
                
                json_pose['pose_data'] = keypoints_list
            else:
                json_pose['pose_data'] = None
        else:
            json_pose['pose_data'] = None

        json_sequence.append(json_pose)

    return json_sequence

if __name__ == "__main__":
    result = example_dance_sampling("./downloads/music.mp3")

    if 'error' in result:
        print(json.dumps({'error': result['error']}))
    else:
        # Extract just the pose_data from each frame
        pose_data_only = []
        
        for pose in result['pose_sequence']:
            if pose['pose_data'] is not None:
                pose_data = pose['pose_data']
                
                # Convert numpy array to {x, y, z} object format
                if isinstance(pose_data, np.ndarray):
                    keypoints_list = []
                    
                    # Handle 2D array (joints, coords)
                    if len(pose_data.shape) == 2:
                        for i in range(pose_data.shape[0]):
                            if pose_data.shape[1] >= 2:
                                keypoint = {
                                    'x': float(pose_data[i, 0]),
                                    'y': float(pose_data[i, 1]),
                                    'z': float(pose_data[i, 2]) if pose_data.shape[1] > 2 else 0.0
                                }
                                keypoints_list.append(keypoint)
                    
                    pose_data_only.append(keypoints_list)
                else:
                    pose_data_only.append(None)
            else:
                pose_data_only.append(None)

        # Print as JSON - just the 2D array of pose data
        print(json.dumps(pose_data_only, indent=2))