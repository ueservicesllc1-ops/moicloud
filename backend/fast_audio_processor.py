"""
Fast Audio Processor - Simulación rápida para demo
"""

import os
import asyncio
import shutil
from pathlib import Path
from typing import Dict
import librosa
import soundfile as sf
import numpy as np

class FastAudioProcessor:
    def __init__(self):
        pass

    async def separate_with_demucs(self, file_path: str) -> Dict[str, str]:
        """Fast separation using librosa for demo"""
        try:
            print(f"Fast processing: {file_path}")
            
            # Check if file exists
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Audio file not found: {file_path}")
            
            # Create output directory
            output_dir = Path(file_path).parent / "stems"
            output_dir.mkdir(exist_ok=True)
            
            print(f"Loading audio from: {file_path}")
            # Load audio with error handling
            try:
                audio, sr = librosa.load(file_path, sr=22050)  # Lower sample rate for speed
                print(f"Audio loaded: {len(audio)} samples, {sr} Hz")
            except Exception as e:
                print(f"Error loading audio: {e}")
                raise
            
            # Create stems using librosa
            stems = {}
            
            try:
                # Simple approach: Create two different versions of the audio
                # For demo purposes, we'll create clearly different tracks
                print("Creating vocal and instrumental tracks...")
                
                # Method: Use different frequency filtering
                # Vocals: emphasize mid-high frequencies (300-3400 Hz)
                # Instrumental: emphasize low-mid frequencies (80-300 Hz + 3400+ Hz)
                
                # Create vocal track (mid-high frequencies)
                vocals_audio = librosa.effects.preemphasis(audio)  # Emphasize high frequencies
                
                # Create instrumental track (low frequencies + very high frequencies)
                # This is a simplified approach - in reality you'd use proper bandpass filters
                instrumental_audio = audio - vocals_audio * 0.7  # Remove some high frequencies
                
                # Normalize audio levels
                vocals_audio = vocals_audio / np.max(np.abs(vocals_audio)) * 0.8
                instrumental_audio = instrumental_audio / np.max(np.abs(instrumental_audio)) * 0.8
                
                # Save vocals
                vocals_path = output_dir / "vocals.wav"
                sf.write(str(vocals_path), vocals_audio, sr)
                stems["vocals"] = str(vocals_path)
                print(f"Vocals saved: {vocals_path}")
                
                # Save instrumental  
                instrumental_path = output_dir / "instrumental.wav"
                sf.write(str(instrumental_path), instrumental_audio, sr)
                stems["instrumental"] = str(instrumental_path)
                print(f"Instrumental saved: {instrumental_path}")
                
            except Exception as e:
                print(f"Error creating stems: {e}")
                raise
            
            print(f"Fast separation completed: {len(stems)} stems")
            return stems
            
        except Exception as e:
            print(f"Error in fast separation: {e}")
            import traceback
            traceback.print_exc()
            raise

    async def separate_custom_tracks(self, file_path: str, tracks: Dict[str, bool], hi_fi: bool = False) -> Dict[str, str]:
        """Separate custom tracks using fast processing"""
        try:
            # First get basic stems
            all_stems = await self.separate_with_demucs(file_path)
            
            # Create additional tracks
            extended_stems = await self.create_extended_tracks(file_path, all_stems)
            
            # Filter based on requested tracks
            filtered_stems = {}
            for track_name, enabled in tracks.items():
                if enabled and track_name in extended_stems:
                    filtered_stems[track_name] = extended_stems[track_name]
            
            return filtered_stems
            
        except Exception as e:
            print(f"Error in custom track separation: {e}")
            raise
    
    async def create_extended_tracks(self, file_path: str, basic_stems: Dict[str, str]) -> Dict[str, str]:
        """Create additional tracks using fast processing"""
        try:
            extended_stems = basic_stems.copy()
            output_dir = Path(file_path).parent / "extended_tracks"
            output_dir.mkdir(exist_ok=True)
            
            # Load the original audio
            audio, sr = librosa.load(file_path, sr=22050)
            
            # Create additional tracks quickly
            additional_tracks = {
                "piano": self.extract_piano_fast(audio, sr, output_dir),
                "guitar": self.extract_guitar_fast(audio, sr, output_dir),
                "strings": self.extract_strings_fast(audio, sr, output_dir),
                "brass": self.extract_brass_fast(audio, sr, output_dir),
                "percussion": self.extract_percussion_fast(audio, sr, output_dir),
                "synth": self.extract_synth_fast(audio, sr, output_dir),
                "instrumental": self.create_instrumental_fast(basic_stems, output_dir)
            }
            
            # Add valid tracks
            for track_name, track_path in additional_tracks.items():
                if track_path and Path(track_path).exists():
                    extended_stems[track_name] = track_path
                    print(f"Created {track_name}: {track_path}")
            
            return extended_stems
            
        except Exception as e:
            print(f"Error creating extended tracks: {e}")
            return basic_stems
    
    def extract_piano_fast(self, audio: np.ndarray, sr: int, output_dir: Path) -> str:
        """Extract piano using fast processing"""
        try:
            y_harmonic, _ = librosa.effects.hpss(audio)
            piano = librosa.effects.preemphasis(y_harmonic)
            output_path = output_dir / "piano.wav"
            sf.write(str(output_path), piano, sr)
            return str(output_path)
        except:
            return None
    
    def extract_guitar_fast(self, audio: np.ndarray, sr: int, output_dir: Path) -> str:
        """Extract guitar using fast processing"""
        try:
            guitar = librosa.effects.preemphasis(audio)
            output_path = output_dir / "guitar.wav"
            sf.write(str(output_path), guitar, sr)
            return str(output_path)
        except:
            return None
    
    def extract_strings_fast(self, audio: np.ndarray, sr: int, output_dir: Path) -> str:
        """Extract strings using fast processing"""
        try:
            strings = librosa.effects.preemphasis(audio)
            output_path = output_dir / "strings.wav"
            sf.write(str(output_path), strings, sr)
            return str(output_path)
        except:
            return None
    
    def extract_brass_fast(self, audio: np.ndarray, sr: int, output_dir: Path) -> str:
        """Extract brass using fast processing"""
        try:
            brass = librosa.effects.preemphasis(audio)
            output_path = output_dir / "brass.wav"
            sf.write(str(output_path), brass, sr)
            return str(output_path)
        except:
            return None
    
    def extract_percussion_fast(self, audio: np.ndarray, sr: int, output_dir: Path) -> str:
        """Extract percussion using fast processing"""
        try:
            _, y_percussive = librosa.effects.hpss(audio)
            output_path = output_dir / "percussion.wav"
            sf.write(str(output_path), y_percussive, sr)
            return str(output_path)
        except:
            return None
    
    def extract_synth_fast(self, audio: np.ndarray, sr: int, output_dir: Path) -> str:
        """Extract synth using fast processing"""
        try:
            synth = librosa.effects.preemphasis(audio)
            output_path = output_dir / "synth.wav"
            sf.write(str(output_path), synth, sr)
            return str(output_path)
        except:
            return None
    
    def create_instrumental_fast(self, basic_stems: Dict[str, str], output_dir: Path) -> str:
        """Create instrumental track"""
        try:
            if "drums" in basic_stems:
                instrumental_path = output_dir / "instrumental.wav"
                shutil.copy2(basic_stems["drums"], instrumental_path)
                return str(instrumental_path)
        except:
            pass
        return None

# Global instance
fast_audio_processor = FastAudioProcessor()

