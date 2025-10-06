"""
Moises Style Audio Processor - Arquitectura simplificada estilo Moises
- Solo B2 Storage
- Solo Firestore para metadata
- URLs consistentes
- Limpieza automática
"""

import os
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, Optional, List
import json
import tempfile
import shutil
from datetime import datetime, timedelta

from b2_storage import b2_storage
from bpm_analyzer_simple import bpm_analyzer_simple
from click_track_generator import click_generator

class MoisesStyleProcessor:
    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "moises_temp"
        self.temp_dir.mkdir(exist_ok=True)
        
    async def separate_audio_moises_style(
        self, 
        file_content: bytes, 
        filename: str,
        user_id: str,
        separation_type: str = "vocals-instrumental",
        hi_fi: bool = False
    ) -> Dict:
        """
        Procesar audio estilo Moises:
        1. Subir archivo original a B2
        2. Procesar con IA
        3. Subir stems a B2
        4. Retornar URLs de B2
        """
        try:
            # Generar IDs únicos
            task_id = f"task_{int(datetime.now().timestamp())}_{user_id[:8]}"
            song_id = f"song_{int(datetime.now().timestamp())}_{user_id[:8]}"
            
            print(f"Procesando audio estilo Moises - Task: {task_id}")
            print(f"Archivo: {filename}, Tamano: {len(file_content)} bytes")
            print(f"Usuario: {user_id}, Tipo: {separation_type}, Hi-Fi: {hi_fi}")
            
            # 1. SUBIR ARCHIVO ORIGINAL A B2
            # Sanitizar nombre de archivo para B2
            safe_filename = self._sanitize_filename(filename)
            original_b2_path = f"originals/{user_id}/{song_id}/{safe_filename}"
            print(f"Subiendo archivo original a B2: {original_b2_path}")
            
            original_upload = await b2_storage.upload_file(
                file_content=file_content,
                filename=original_b2_path,
                content_type="audio/mpeg"
            )
            
            if not original_upload.get("success"):
                raise Exception("Error subiendo archivo original a B2")
            
            original_b2_url = original_upload["download_url"]
            print(f"Archivo original subido: {original_b2_url}")
            
            # 2. PROCESAR CON IA (version simplificada para debug)
            print("Iniciando procesamiento con IA...")
            
            # Separación real con Demucs
            b2_stems = await self._separate_audio_real(file_content, user_id, song_id, separation_type)
            
            # 4. ANALIZAR BPM DEL ARCHIVO LOCAL
            bpm_result = None
            try:
                # Guardar archivo temporal para análisis BPM
                temp_file = await self._save_temp_file(file_content, "temp_for_bpm.wav")
                print(f"Analizando BPM del archivo local: {temp_file}")
                bpm_result = bpm_analyzer_simple.analyze_bpm_from_file(temp_file)
                if bpm_result.get('bpm'):
                    print(f"BPM detectado: {bpm_result['bpm']} (confianza: {bpm_result.get('confidence', 0)*100:.1f}%)")
                else:
                    print("No se pudo detectar BPM")
            except Exception as bpm_error:
                print(f"Error analizando BPM: {bpm_error}")
            
            # 5. GENERAR CLICK TRACK PROFESIONAL SI HAY BPM
            click_track_url = None
            if bpm_result and bpm_result.get('bpm'):
                try:
                    # Obtener duración del archivo para el click track
                    import librosa
                    y, sr = librosa.load(temp_file)
                    duration = len(y) / sr
                    
                    print(f"Generando click track profesional: BPM={bpm_result['bpm']}, Duración={duration}s")
                    click_track_url = await click_generator.generate_and_upload_click_track(
                        bpm=bpm_result['bpm'],
                        duration=duration,
                        user_id=user_id,
                        song_id=song_id,
                        audio_file_path=temp_file  # Pasar archivo para detección de beats reales
                    )
                    
                    if click_track_url:
                        b2_stems["click"] = click_track_url
                        print(f"Click track profesional generado y subido: {click_track_url}")
                    else:
                        print("Error generando click track profesional")
                        
                except Exception as click_error:
                    print(f"Error generando click track profesional: {click_error}")
                    import traceback
                    print(f"Stack trace click: {traceback.format_exc()}")
            
            # 6. CONVERTIR URLs DE B2 A URLs DEL PROXY
            proxy_original_url = self._convert_b2_url_to_proxy(original_b2_url)
            proxy_stems = {}
            for stem_name, b2_url in b2_stems.items():
                proxy_stems[stem_name] = self._convert_b2_url_to_proxy(b2_url)
            
            # 6. RETORNAR RESULTADO ESTILO MOISES
            result = {
                "success": True,
                "task_id": task_id,
                "song_id": song_id,
                "original_url": proxy_original_url,
                "stems": proxy_stems,
                "separation_type": separation_type,
                "hi_fi": hi_fi,
                "processed_at": datetime.now().isoformat(),
                "user_id": user_id,
                "status": "completed",
                "bpm": bpm_result.get('bpm') if bpm_result else None,
                "bpm_confidence": bpm_result.get('confidence', 0) if bpm_result else 0
            }
            
            print(f"Procesamiento completado estilo Moises: {song_id}")
            return result
            
        except Exception as e:
            print(f"Error en procesamiento estilo Moises: {e}")
            return {
                "success": False,
                "error": str(e),
                "status": "failed"
            }
    
    async def _save_temp_file(self, file_content: bytes, filename: str) -> str:
        """Guardar archivo temporal para procesamiento"""
        temp_file = self.temp_dir / filename
        with open(temp_file, 'wb') as f:
            f.write(file_content)
        return str(temp_file)
    
    async def _process_with_demucs(
        self, 
        file_path: str, 
        separation_type: str,
        hi_fi: bool = False
    ) -> Dict[str, str]:
        """Procesar con Demucs y retornar paths de stems"""
        
        # Crear directorio de salida temporal
        output_dir = Path(file_path).parent / "demucs_temp"
        output_dir.mkdir(exist_ok=True)
        
        try:
            # Comando Demucs
            cmd = [
                "python", "-m", "demucs",
                "--name", "htdemucs" if hi_fi else "htdemucs",
                "--out", str(output_dir),
                file_path
            ]
            
            print(f"[?] Ejecutando Demucs: {' '.join(cmd)}")
            
            # Ejecutar Demucs
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                print(f"Error Demucs: {stderr.decode()}")
                raise Exception(f"Demucs error: {stderr.decode()}")
            
            print(f"Demucs completado")
            
            # Buscar archivos generados
            stems = {}
            model_dir = output_dir / "htdemucs" / Path(file_path).stem
            
            if model_dir.exists():
                # Para vocals-instrumental
                if separation_type == "vocals-instrumental":
                    vocals_path = model_dir / "vocals.wav"
                    if vocals_path.exists():
                        stems["vocals"] = str(vocals_path)
                    
                    # Crear instrumental combinando drums + bass + other
                    instrumental_path = await self._create_instrumental(
                        model_dir, 
                        output_dir / "instrumental.wav"
                    )
                    if instrumental_path:
                        stems["instrumental"] = instrumental_path
                
                # Para 4 stems
                elif separation_type == "vocals-drums-bass-other":
                    for stem_name in ["vocals", "drums", "bass", "other"]:
                        stem_path = model_dir / f"{stem_name}.wav"
                        if stem_path.exists():
                            stems[stem_name] = str(stem_path)
            
            print(f"Stems generados: {list(stems.keys())}")
            return stems
            
        except Exception as e:
            print(f"Error en procesamiento Demucs: {e}")
            raise
    
    async def _create_instrumental(self, model_dir: Path, output_path: str) -> Optional[str]:
        """Crear track instrumental combinando drums + bass + other"""
        try:
            import librosa
            import soundfile as sf
            import numpy as np
            
            instrumental_tracks = []
            for track in ["drums", "bass", "other"]:
                track_path = model_dir / f"{track}.wav"
                if track_path.exists():
                    audio, sr = librosa.load(str(track_path))
                    instrumental_tracks.append(audio)
            
            if instrumental_tracks:
                # Combinar tracks
                combined = np.sum(instrumental_tracks, axis=0)
                
                # Normalizar
                combined = combined / np.max(np.abs(combined))
                
                # Guardar
                sf.write(output_path, combined, 44100)
                return output_path
            
            return None
            
        except Exception as e:
            print(f"Error creando instrumental: {e}")
            return None
    
    async def _separate_audio_real(self, file_content: bytes, user_id: str, song_id: str, separation_type: str) -> Dict[str, str]:
        """Separación real con sistema híbrido: Spleeter (rápido) + Demucs (calidad)"""
        try:
            print("Iniciando separación real con sistema híbrido...")
            
            # Importar librerías
            import tempfile
            import os
            import asyncio
            from pathlib import Path
            import subprocess
            import json
            
            # Crear directorio temporal para procesamiento
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Guardar archivo temporal
                input_file = temp_path / "input.wav"
                input_file.write_bytes(file_content)
                print(f"Archivo temporal guardado: {input_file}")
                
                # Sistema híbrido: Spleeter (rápido) + Demucs (calidad)
                use_spleeter = False  # Usar solo Demucs (Spleeter no compatible con Python 3.11)
                
                if separation_type == "vocals-instrumental":
                    # 2 pistas: vocals + instrumental
                    if use_spleeter:
                        print("Usando Spleeter para separación 2 pistas (rápido)")
                        cmd = [
                            "python", "-m", "spleeter", "separate",
                            "-p", "spleeter:2stems-16kHz",
                            "-o", str(temp_path / "spleeter_output"),
                            str(input_file)
                        ]
                        tool_name = "Spleeter"
                    else:
                        print("Usando Demucs para separación 2 pistas (calidad)")
                        cmd = [
                            "python", "-m", "demucs.separate",
                            "--name", "htdemucs",
                            "--two-stems", "vocals",
                            "--device", "cpu",
                            "--out", str(temp_path / "separated"),
                            str(input_file)
                        ]
                        tool_name = "Demucs"
                        
                elif separation_type == "vocals-drums-bass-other":
                    # 4 pistas: vocals, drums, bass, other
                    if use_spleeter:
                        print("Usando Spleeter para separación 4 pistas (rápido)")
                        cmd = [
                            "python", "-m", "spleeter", "separate",
                            "-p", "spleeter:4stems-16kHz",
                            "-o", str(temp_path / "spleeter_output"),
                            str(input_file)
                        ]
                        tool_name = "Spleeter"
                    else:
                        print("Usando Demucs para separación 4 pistas (calidad)")
                        cmd = [
                            "python", "-m", "demucs.separate",
                            "--name", "htdemucs",
                            "--device", "cpu",
                            "--out", str(temp_path / "separated"),
                            str(input_file)
                        ]
                        tool_name = "Demucs"
                        
                elif separation_type == "vocals-chorus-drums-bass-piano":
                    # 5 pistas: vocals, chorus, drums, bass, piano
                    if use_spleeter:
                        print("Usando Spleeter para separación 5 pistas (rápido)")
                        cmd = [
                            "python", "-m", "spleeter", "separate",
                            "-p", "spleeter:5stems-16kHz",
                            "-o", str(temp_path / "spleeter_output"),
                            str(input_file)
                        ]
                        tool_name = "Spleeter"
                    else:
                        print("Usando Demucs para separación 5 pistas (calidad)")
                        cmd = [
                            "python", "-m", "demucs.separate",
                            "--name", "mdx_extra_q",
                            "--device", "cpu",
                            "--out", str(temp_path / "separated"),
                            str(input_file)
                        ]
                        tool_name = "Demucs"
                else:
                    # Default: 4 pistas con Spleeter
                    print("Usando Spleeter para separación 4 pistas (default)")
                    cmd = [
                        "python", "-m", "spleeter", "separate",
                        "-p", "spleeter:4stems-16kHz",
                        "-o", str(temp_path / "spleeter_output"),
                        str(input_file)
                    ]
                    tool_name = "Spleeter"
                
                print(f"Separando con {tool_name}: tipo={separation_type}")
                print(f"Comando: {' '.join(cmd)}")
                
                # Ejecutar separación
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None, 
                    lambda: subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                )
                
                if result.returncode != 0:
                    print(f"Error ejecutando {tool_name}: {result.stderr}")
                    raise Exception(f"{tool_name} failed: {result.stderr}")
                
                print(f"{tool_name} completado exitosamente")
                print(f"Output: {result.stdout}")
                
                # Buscar archivos separados según la herramienta usada
                separated_files = {}
                
                if use_spleeter:
                    # Procesar salida de Spleeter
                    spleeter_output_dir = temp_path / "spleeter_output"
                    if not spleeter_output_dir.exists():
                        raise Exception("No se encontró directorio de salida de Spleeter")
                    
                    # Buscar el directorio con el nombre del archivo
                    input_name = input_file.stem
                    separated_dir = None
                    for item in spleeter_output_dir.iterdir():
                        if item.is_dir() and input_name in item.name:
                            separated_dir = item
                            break
                    
                    if not separated_dir:
                        raise Exception(f"No se encontró directorio separado de Spleeter para {input_name}")
                    
                    print(f"Directorio Spleeter encontrado: {separated_dir}")
                    
                    # Leer archivos de Spleeter
                    for file_path in separated_dir.glob("*.wav"):
                        stem_name = file_path.stem
                        separated_files[stem_name] = file_path.read_bytes()
                        print(f"Stem Spleeter {stem_name} leído: {len(separated_files[stem_name])} bytes")
                    
                    # Renombrar archivos de Spleeter para consistencia
                    if "accompaniment" in separated_files:
                        separated_files["instrumental"] = separated_files.pop("accompaniment")
                        
                else:
                    # Procesar salida de Demucs
                    output_dir = temp_path / "separated"
                    model_output_dir = output_dir / "htdemucs"
                    if not model_output_dir.exists():
                        raise Exception("No se encontró directorio de salida de Demucs")
                    
                    # Buscar el directorio con el nombre del archivo
                    input_name = input_file.stem
                    separated_dir = None
                    for item in model_output_dir.iterdir():
                        if item.is_dir() and input_name in item.name:
                            separated_dir = item
                            break
                    
                    if not separated_dir:
                        raise Exception(f"No se encontró directorio separado de Demucs para {input_name}")
                    
                    print(f"Directorio Demucs encontrado: {separated_dir}")
                    
                    # Leer archivos de Demucs
                    if separation_type == "vocals-instrumental":
                        # Para 2 pistas: vocals y no_vocals (instrumental)
                        for stem_name in ["vocals", "no_vocals"]:
                            file_path = separated_dir / f"{stem_name}.wav"
                            if file_path.exists():
                                separated_files[stem_name] = file_path.read_bytes()
                                print(f"Stem Demucs {stem_name} leído: {len(separated_files[stem_name])} bytes")
                            else:
                                print(f"Warning: {stem_name}.wav no encontrado")
                        
                        # Renombrar no_vocals a instrumental para consistencia
                        if "no_vocals" in separated_files:
                            separated_files["instrumental"] = separated_files.pop("no_vocals")
                    else:
                        # Para 4 o 5 pistas: leer todos los archivos .wav
                        for file_path in separated_dir.glob("*.wav"):
                            stem_name = file_path.stem
                            separated_files[stem_name] = file_path.read_bytes()
                            print(f"Stem Demucs {stem_name} leído: {len(separated_files[stem_name])} bytes")
                
                print(f"Separación completada. Archivos: {len(separated_files)}")
                
                # Procesar cada archivo separado
                b2_stems = {}
                for stem_name, stem_bytes in separated_files.items():
                    # Subir a B2
                    stem_b2_path = f"stems/{user_id}/{song_id}/{stem_name}.wav"
                    stem_upload = await b2_storage.upload_file(
                        file_content=stem_bytes,
                        filename=stem_b2_path,
                        content_type="audio/wav"
                    )
                    
                    if stem_upload.get("success"):
                        b2_stems[stem_name] = stem_upload["download_url"]
                        print(f"Stem real {stem_name} subido: {stem_upload['download_url']}")
                    else:
                        print(f"Error subiendo stem real {stem_name}")
                
                return b2_stems
            
        except Exception as e:
            print(f"Error en separación real: {e}")
            import traceback
            print(f"Stack trace: {traceback.format_exc()}")
            
            # NO FALLBACK - FALLA SI NO PUEDE SEPARAR
            raise Exception(f"Error en separación real con Demucs: {e}")


    def _sanitize_filename(self, filename: str) -> str:
        """Sanitizar nombre de archivo para B2 (sin espacios, acentos ni caracteres especiales)"""
        import re
        import unicodedata
        
        # Normalizar y remover acentos/tildes
        safe_name = unicodedata.normalize('NFD', filename)
        safe_name = ''.join(char for char in safe_name if unicodedata.category(char) != 'Mn')
        
        # Reemplazar espacios con guiones bajos
        safe_name = safe_name.replace(' ', '_')
        
        # Remover caracteres especiales excepto puntos, guiones y guiones bajos
        safe_name = re.sub(r'[^a-zA-Z0-9._-]', '_', safe_name)
        
        # Remover múltiples guiones bajos consecutivos
        safe_name = re.sub(r'_+', '_', safe_name)
        
        # Remover guiones bajos al inicio y final
        safe_name = safe_name.strip('_')
        
        # Limitar longitud
        if len(safe_name) > 100:
            name, ext = os.path.splitext(safe_name)
            safe_name = name[:95] + ext
        
        return safe_name

    def _convert_b2_url_to_proxy(self, b2_url: str) -> str:
        """Convertir URL de B2 a URL del proxy del backend"""
        # Extraer la ruta del archivo desde la URL de B2
        # Ejemplo: https://s3.us-east-005.backblazeb2.com/moises/originals/user/song/file.mp3
        # -> originals/user/song/file.mp3
        
        if 'moises/' in b2_url:
            file_path = b2_url.split('moises/')[1]
            proxy_url = f"http://localhost:8000/api/audio/{file_path}"
            print(f"Converted B2 URL to proxy: {b2_url} -> {proxy_url}")
            return proxy_url
        else:
            print(f"Warning: Could not convert B2 URL: {b2_url}")
            return b2_url

    def _cleanup_temp_files(self, temp_file: str, stems: Dict[str, str]):
        """Limpiar archivos temporales"""
        try:
            # Eliminar archivo temporal original
            if os.path.exists(temp_file):
                os.remove(temp_file)
            
            # Eliminar stems temporales
            for stem_path in stems.values():
                if os.path.exists(stem_path):
                    os.remove(stem_path)
            
            # Eliminar directorio temporal si está vacío
            temp_dir = Path(temp_file).parent / "demucs_temp"
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
                
        except Exception as e:
            print(f"Error limpiando archivos temporales: {e}")
    
    async def cleanup_old_files(self, user_id: str, days_old: int = 7):
        """Limpiar archivos antiguos del usuario (estilo Moises)"""
        try:
            print(f"Limpiando archivos antiguos para usuario {user_id} (> {days_old} dias)")
            
            # En una implementación real, aquí consultarías la base de datos
            # para obtener archivos antiguos y eliminarlos de B2
            
            # Por ahora, solo limpiar archivos temporales locales
            if self.temp_dir.exists():
                for item in self.temp_dir.iterdir():
                    if item.is_file():
                        # Eliminar archivos más antiguos que X días
                        file_age = datetime.now() - datetime.fromtimestamp(item.stat().st_mtime)
                        if file_age > timedelta(days=days_old):
                            item.unlink()
                            print(f"Eliminado archivo antiguo: {item.name}")
            
        except Exception as e:
            print(f"Error en limpieza: {e}")

# Instancia global
moises_processor = MoisesStyleProcessor()
