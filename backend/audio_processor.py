import os
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, List
import librosa
import soundfile as sf
from pydub import AudioSegment
import numpy as np

class AudioProcessor:
    def __init__(self):
        self.spleeter_models = {
            "2stems": "spleeter:2stems-16kHz",
            "4stems": "spleeter:4stems-16kHz", 
            "5stems": "spleeter:5stems-16kHz"
        }
    
    async def separate_with_spleeter(self, file_path: str, model_type: str, hi_fi: bool = False) -> Dict[str, str]:
        """Separate audio using Spleeter"""
        try:
            # Create output directory
            output_dir = Path(file_path).parent / "stems"
            output_dir.mkdir(exist_ok=True)
            
            # Choose model based on HI-FI mode
            if hi_fi and model_type in self.spleeter_models:
                model = self.spleeter_models[model_type].replace("16kHz", "44.1kHz")
            else:
                model = self.spleeter_models[model_type]
            
            # Run Spleeter command
            cmd = [
                "spleeter", "separate",
                "-p", model,
                "-o", str(output_dir),
                file_path
            ]
            
            # Execute in subprocess
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise Exception(f"Spleeter error: {stderr.decode()}")
            
            # Find generated stems
            stems = {}
            stem_files = list(output_dir.glob("**/*.wav"))
            
            for stem_file in stem_files:
                stem_name = stem_file.stem
                stems[stem_name] = str(stem_file)
            
            return stems
            
        except Exception as e:
            print(f"Spleeter separation error: {e}")
            raise
    
    async def separate_with_demucs(self, file_path: str) -> Dict[str, str]:
        """Separate audio using Demucs (higher quality)"""
        try:
            # Create output directory
            output_dir = Path(file_path).parent / "stems"
            output_dir.mkdir(exist_ok=True)
            
            # Run Demucs command
            cmd = [
                "python", "-m", "demucs.separate",
                "--out", str(output_dir),
                file_path
            ]
            
            # Execute in subprocess
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise Exception(f"Demucs error: {stderr.decode()}")
            
            # Find generated stems
            stems = {}
            stem_files = list(output_dir.glob("**/*.wav"))
            
            for stem_file in stem_files:
                stem_name = stem_file.stem
                stems[stem_name] = str(stem_file)
            
            return stems
            
        except Exception as e:
            print(f"Demucs separation error: {e}")
            raise
    
    async def analyze_audio(self, file_path: str) -> Dict:
        """Analyze audio file and return metadata"""
        try:
            # Load audio with librosa
            y, sr = librosa.load(file_path)
            
            # Get audio info
            duration = len(y) / sr
            
            # Analyze tempo and key
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            
            # Get spectral features
            spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
            
            return {
                "duration": duration,
                "sample_rate": sr,
                "tempo": float(tempo),
                "spectral_centroid": float(np.mean(spectral_centroids)),
                "spectral_rolloff": float(np.mean(spectral_rolloff))
            }
            
        except Exception as e:
            print(f"Audio analysis error: {e}")
            return {}
    
    def convert_audio(self, input_path: str, output_path: str, format: str = "wav"):
        """Convert audio to different format"""
        try:
            audio = AudioSegment.from_file(input_path)
            audio.export(output_path, format=format)
            return True
        except Exception as e:
            print(f"Audio conversion error: {e}")
            return False
    
    async def separate_custom_tracks(self, file_path: str, tracks: Dict[str, bool], hi_fi: bool = False) -> Dict[str, str]:
        """Separate specific tracks using custom configuration"""
        try:
            # For now, use 4stems as base and filter results
            # In a more advanced implementation, you could use different models per track
            stems = await self.separate_with_spleeter(file_path, "4stems", hi_fi)
            
            # Filter stems based on requested tracks
            filtered_stems = {}
            track_mapping = {
                'vocals': ['vocals', 'voice'],
                'guitar': ['guitar', 'guitars'],
                'bass': ['bass', 'bassline'],
                'drums': ['drums', 'drum', 'percussion']
            }
            
            for track_name, enabled in tracks.items():
                if enabled and track_name in track_mapping:
                    # Find matching stem file
                    for stem_key, stem_path in stems.items():
                        stem_lower = stem_key.lower()
                        if any(keyword in stem_lower for keyword in track_mapping[track_name]):
                            filtered_stems[track_name] = stem_path
                            break
            
            return filtered_stems
            
        except Exception as e:
            print(f"Custom track separation error: {e}")
            raise

    def normalize_audio(self, file_path: str) -> str:
        """Normalize audio volume"""
        try:
            audio = AudioSegment.from_file(file_path)
            normalized = audio.normalize()
            
            # Save normalized version
            normalized_path = file_path.replace(".", "_normalized.")
            normalized.export(normalized_path, format="wav")
            
            return normalized_path
        except Exception as e:
            print(f"Audio normalization error: {e}")
            return file_path
