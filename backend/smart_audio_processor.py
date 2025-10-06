"""
Smart Audio Processor - Demucs para 4 tracks, Spleeter simulado para 2 tracks
"""

import os
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, Optional
import shutil
import librosa
import soundfile as sf
import numpy as np

class SmartAudioProcessor:
    def __init__(self):
        self.models_loaded = False
        
    async def separate_with_demucs(self, file_path: str, task_callback=None, requested_tracks=None) -> Dict[str, str]:
        """Separate audio using Demucs for 4 tracks (vocals, drums, bass, other)"""
        try:
            print(f"[MUSIC] Using Demucs for 4-track separation")
            
            # Create output directory
            output_dir = Path(file_path).parent / "demucs_output"
            output_dir.mkdir(exist_ok=True)
            
            # Update progress: Starting Demucs
            if task_callback:
                task_callback(20, "Starting Demucs AI separation...")
            
            # Run Demucs command - using the htdemucs model for best quality
            cmd = [
                "python", "-m", "demucs",
                "--name", "htdemucs",  # Best quality model
                "--out", str(output_dir),
                file_path
            ]
            
            print(f"Running Demucs command: {' '.join(cmd)}")
            
            # Update progress: Processing with Demucs
            if task_callback:
                task_callback(40, "Processing with Demucs AI...")
            
            # Execute in subprocess
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                print(f"Demucs error: {stderr.decode()}")
                raise Exception(f"Demucs error: {stderr.decode()}")
            
            print(f"Demucs output: {stdout.decode()}")
            
            # Update progress: Demucs completed
            if task_callback:
                task_callback(70, "Demucs separation completed!")
            
            # Find the separated files
            stems = {}
            file_name = Path(file_path).stem
            
            # Demucs creates a folder with the model name
            model_dir = output_dir / "htdemucs" / file_name
            
            if model_dir.exists():
                # Map Demucs output to our expected format
                stem_mapping = {
                    "vocals.wav": "vocals",
                    "drums.wav": "drums", 
                    "bass.wav": "bass",
                    "other.wav": "other"
                }
                
                # Si se solicitaron tracks específicos, solo procesar esos
                if requested_tracks:
                    print(f"Creating only requested tracks: {requested_tracks}")
                    
                    # Para vocals-instrumental, combinar drums + bass + other
                    if "vocals" in requested_tracks and "instrumental" in requested_tracks:
                        # Vocals
                        vocals_path = model_dir / "vocals.wav"
                        if vocals_path.exists():
                            stems["vocals"] = str(vocals_path)
                            print(f"Found vocals: {vocals_path}")
                        
                        # Instrumental = drums + bass + other
                        instrumental_tracks = []
                        for track in ["drums", "bass", "other"]:
                            track_path = model_dir / f"{track}.wav"
                            if track_path.exists():
                                instrumental_tracks.append(track_path)
                        
                        if instrumental_tracks:
                            # Combinar los tracks instrumentales
                            combined_audio = None
                            sr = None
                            
                            for track_path in instrumental_tracks:
                                audio, sample_rate = librosa.load(track_path, sr=None)
                                sr = sample_rate
                                
                                if combined_audio is None:
                                    combined_audio = audio
                                else:
                                    # Asegurar que tengan la misma longitud
                                    min_length = min(len(combined_audio), len(audio))
                                    combined_audio = combined_audio[:min_length] + audio[:min_length]
                            
                            # Guardar track instrumental combinado
                            instrumental_path = model_dir.parent / "instrumental.wav"
                            sf.write(str(instrumental_path), combined_audio, sr)
                            stems["instrumental"] = str(instrumental_path)
                            print(f"Created instrumental: {instrumental_path}")
                    
                    else:
                        # Procesar tracks individuales solicitados
                        for stem_file, stem_name in stem_mapping.items():
                            if stem_name in requested_tracks:
                                stem_path = model_dir / stem_file
                                if stem_path.exists():
                                    stems[stem_name] = str(stem_path)
                                    print(f"Found {stem_name}: {stem_path}")
                
                else:
                    # Si no se especificaron tracks, devolver todos
                    for stem_file, stem_name in stem_mapping.items():
                        stem_path = model_dir / stem_file
                        if stem_path.exists():
                            stems[stem_name] = str(stem_path)
                            print(f"Found {stem_name}: {stem_path}")
            
            # Update progress: Files found
            if task_callback:
                task_callback(80, f"Found {len(stems)} separated tracks")
            
            return stems
            
        except Exception as e:
            print(f"Error in Demucs separation: {e}")
            raise
    
    async def separate_with_spleeter_simulated(self, file_path: str, task_callback=None, requested_tracks=None) -> Dict[str, str]:
        """Simulate Spleeter separation for 2 tracks (vocals, instrumental) using librosa"""
        try:
            print(f"[MUSIC] Using Spleeter simulation for 2-track separation")
            
            # Update progress: Starting Spleeter simulation
            if task_callback:
                task_callback(20, "Starting Spleeter simulation...")
            
            # Create output directory
            output_dir = Path(file_path).parent / "spleeter_output"
            output_dir.mkdir(exist_ok=True)
            
            # Load the original audio
            audio, sr = librosa.load(file_path, sr=None)
            
            # Update progress: Processing
            if task_callback:
                task_callback(50, "Processing audio with librosa...")
            
            stems = {}
            
            try:
                # Simple vocal extraction using harmonic-percussive separation
                # This is a simplified version - real Spleeter would be more sophisticated
                y_harmonic, y_percussive = librosa.effects.hpss(audio)
                
                # Vocals: emphasize harmonic content (vocals are typically more harmonic)
                vocals = y_harmonic * 0.8  # Reduce volume slightly
                
                # Instrumental: combine percussive + some harmonic
                instrumental = y_percussive + (y_harmonic * 0.3)
                
                # Normalize audio levels
                vocals = vocals / np.max(np.abs(vocals)) * 0.8
                instrumental = instrumental / np.max(np.abs(instrumental)) * 0.8
                
                # Save vocals
                vocals_path = output_dir / "vocals.wav"
                sf.write(str(vocals_path), vocals, sr)
                stems["vocals"] = str(vocals_path)
                print(f"Created vocals: {vocals_path}")
                
                # Save instrumental  
                instrumental_path = output_dir / "instrumental.wav"
                sf.write(str(instrumental_path), instrumental, sr)
                stems["instrumental"] = str(instrumental_path)
                print(f"Created instrumental: {instrumental_path}")
                
            except Exception as e:
                print(f"Error in librosa processing: {e}")
                # Fallback: copy original file as both tracks
                vocals_path = output_dir / "vocals.wav"
                instrumental_path = output_dir / "instrumental.wav"
                shutil.copy2(file_path, vocals_path)
                shutil.copy2(file_path, instrumental_path)
                stems["vocals"] = str(vocals_path)
                stems["instrumental"] = str(instrumental_path)
                print(f"Fallback: copied original to both tracks")
            
            # Update progress: Files created
            if task_callback:
                task_callback(80, f"Created {len(stems)} separated tracks")
            
            return stems
            
        except Exception as e:
            print(f"Error in Spleeter simulation: {e}")
            raise
    
    async def separate_custom_tracks(self, file_path: str, tracks: Dict[str, bool], hi_fi: bool = False) -> Dict[str, str]:
        """Separate custom tracks - use Demucs for 4+ tracks, Spleeter simulation for 2 tracks"""
        try:
            enabled_tracks = [name for name, enabled in tracks.items() if enabled]
            
            # If requesting 4 tracks (vocals, drums, bass, other), use Demucs
            if len(enabled_tracks) >= 4 and any(track in enabled_tracks for track in ["drums", "bass", "other"]):
                print(f"[MUSIC] Using Demucs for {len(enabled_tracks)} tracks: {enabled_tracks}")
                return await self.separate_with_demucs(file_path, requested_tracks=enabled_tracks)
            
            # If requesting 2 tracks (vocals, instrumental), use Spleeter simulation
            elif len(enabled_tracks) == 2 and "instrumental" in enabled_tracks:
                print(f"[MUSIC] Using Spleeter simulation for 2 tracks: {enabled_tracks}")
                return await self.separate_with_spleeter_simulated(file_path, requested_tracks=enabled_tracks)
            
            # Default: use Demucs for any other case
            else:
                print(f"[MUSIC] Using Demucs as default for tracks: {enabled_tracks}")
                return await self.separate_with_demucs(file_path, requested_tracks=enabled_tracks)
                
        except Exception as e:
            print(f"[ERROR] Error in custom track separation: {e}")
            raise

# Global instance
audio_processor = SmartAudioProcessor()
