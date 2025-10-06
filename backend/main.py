from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
import os
import sys
import uuid
import asyncio
import subprocess
from pathlib import Path
from typing import List, Optional, Dict
import json

# Configurar encoding para Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

from smart_audio_processor import audio_processor
from chord_analyzer import ChordAnalyzer
from models import ProcessingTask, TaskStatus
from database import get_db, init_db
from b2_storage import b2_storage
from moises_style_processor import moises_processor
# from bpm_analyzer import bpm_analyzer  # Temporalmente deshabilitado por problemas de encoding
from bpm_analyzer_simple import bpm_analyzer_simple
from key_analyzer_simple import key_analyzer_simple
from click_generator_simple import click_generator_simple
import time_signature_analyzer
import tempfile
import uuid

# In-memory task storage
tasks_storage = {}
# Store active processes for cancellation
active_processes = {}

app = FastAPI(
    title="Moises Clone API",
    description="AI-powered audio separation service",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for serving uploaded files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Initialize database and B2
# Temporalmente deshabilitado - causa problemas al iniciar
# @app.on_event("startup")
# async def startup_event():
#     init_db()
#     # await b2_storage.initialize()  # Temporalmente deshabilitado - inicializa lazy

# Audio processor instance (already imported)

@app.get("/")
async def root():
    return {"message": "Moises Clone API", "status": "running"}

@app.get("/api/health")
async def health_check():
    return {"status": "OK", "message": "Backend is running"}

@app.get("/api/audio/{path:path}")
async def serve_audio_file(path: str):
    """Proxy para servir archivos de audio desde B2 con CORS habilitado"""
    try:
        print(f"Serving audio file: {path}")
        
        # Descargar archivo desde B2
        file_data = await b2_storage.download_file_bytes(path)
        
        if not file_data:
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        # Determinar content type basado en la extensión
        extension = path.split('.')[-1].lower()
        content_type_map = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'm4a': 'audio/mp4',
            'ogg': 'audio/ogg',
            'flac': 'audio/flac'
        }
        content_type = content_type_map.get(extension, 'audio/mpeg')
        
        # Retornar archivo con headers CORS
        from fastapi.responses import Response
        return Response(
            content=file_data,
            media_type=content_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Cache-Control": "public, max-age=3600"
            }
        )
        
    except Exception as e:
        print(f"Error serving audio file {path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/delete-files")
async def delete_files_from_b2(request: dict):
    """Eliminar archivos de B2 cuando se borra una canción"""
    try:
        song_id = request.get("songId")
        file_url = request.get("fileUrl")
        stems = request.get("stems", {})
        
        print(f"Eliminando archivos para canción {song_id}")
        
        deleted_files = []
        
        # Eliminar archivo original si existe
        if file_url:
            original_path = _extract_b2_path_from_url(file_url)
            if original_path:
                success = await b2_storage.delete_file(original_path)
                if success:
                    deleted_files.append(f"Original: {original_path}")
                    print(f"Archivo original eliminado: {original_path}")
        
        # Eliminar stems si existen
        if stems:
            for stem_name, stem_url in stems.items():
                if stem_url:
                    stem_path = _extract_b2_path_from_url(stem_url)
                    if stem_path:
                        success = await b2_storage.delete_file(stem_path)
                        if success:
                            deleted_files.append(f"{stem_name}: {stem_path}")
                            print(f"Stem {stem_name} eliminado: {stem_path}")
        
        return {
            "success": True,
            "deleted_files": deleted_files,
            "message": f"Eliminados {len(deleted_files)} archivos de B2"
        }
        
    except Exception as e:
        print(f"Error eliminando archivos de B2: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _extract_b2_path_from_url(url: str) -> str:
    """Extraer la ruta del archivo desde la URL de B2"""
    try:
        if 'moises/' in url:
            return url.split('moises/')[1]
        return None
    except:
        return None

@app.post("/upload")
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    separation_type: str = "2stems",
    separation_options: Optional[str] = None,
    hi_fi: bool = False
):
    """Upload audio file and start separation process"""
    
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")
    
    # Generate unique task ID
    task_id = str(uuid.uuid4())
    
    # Create upload directory
    upload_dir = Path(f"uploads/{task_id}")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Save uploaded file
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'mp3'
    file_path = upload_dir / f"original.{file_ext}"
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    print(f"File saved to: {file_path}")
    print(f"File exists: {file_path.exists()}")
    
    # Parse separation options if provided
    custom_tracks = None
    if separation_options:
        try:
            import json
            custom_tracks = json.loads(separation_options)
        except:
            pass
    
    # Create processing task
    task = ProcessingTask(
        id=task_id,
        original_filename=file.filename,
        file_path=str(file_path),
        separation_type=separation_type,
        status=TaskStatus.PROCESSING
    )
    
    # Start background processing with options
    background_tasks.add_task(process_audio, task, custom_tracks, hi_fi)
    
    return {
        "task_id": task_id,
        "status": "uploaded",
        "message": "Audio upload successful",
        "file_url": f"http://localhost:8000/uploads/{task_id}/original.{file_ext}",
        "separation_type": separation_type,
        "hi_fi": hi_fi
    }

@app.post("/api/upload")
async def upload_to_b2(
    file: UploadFile = File(...),
    user_id: str = None,
    song_id: str = None,
    folder: str = "newsongs"
):
    """Upload file to B2 storage via proxy"""
    
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")
    
    try:
        # Upload to B2 using the existing b2_storage
        file_content = await file.read()
        
        # Generate unique filename
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'mp3'
        b2_filename = f"{song_id or 'unknown'}/{file.filename}"
        
        # Upload to B2
        upload_result = await b2_storage.upload_file(
            file_content=file_content,
            filename=b2_filename,
            content_type=file.content_type
        )
        
        return {
            "success": True,
            "downloadUrl": upload_result.get("download_url"),
            "fileId": upload_result.get("file_id"),
            "filename": b2_filename
        }
        
    except Exception as e:
        print(f"Error uploading to B2: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/separate")
async def separate_audio_direct(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    separation_type: str = Form("vocals-instrumental"),
    separation_options: Optional[str] = Form(None),
    hi_fi: bool = Form(False),
    song_id: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
):
    """Separate audio using Moises Style architecture - Solo B2 Storage"""
    
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")
    
    # Siempre usar arquitectura Moises Style
    try:
        print(f"Iniciando separacion Moises Style para: {file.filename}")
        print(f"Usuario: {user_id or 'anonymous'}")
        print(f"Tipo separacion: {separation_type}")
        print(f"Hi-Fi: {hi_fi}")
        
        # Leer contenido del archivo
        file_content = await file.read()
        print(f"Archivo leido: {len(file_content)} bytes")
        
        # Usar el procesador Moises Style
        try:
            result = await moises_processor.separate_audio_moises_style(
                file_content=file_content,
                filename=file.filename,
                user_id=user_id or "anonymous",
                separation_type=separation_type,
                hi_fi=hi_fi
            )
            print(f"Procesador Moises Style completado: {result}")
        except Exception as proc_error:
            print(f"Error en procesador Moises Style: {proc_error}")
            import traceback
            print(f"Stack trace procesador: {traceback.format_exc()}")
            raise proc_error
        
        print(f"Resultado procesador: {result}")
        
        if result["success"]:
            response_data = {
                "success": True,
                "message": "Audio separado exitosamente estilo Moises",
                "data": {
                    "task_id": result["task_id"],
                    "song_id": result["song_id"],
                    "original_url": result["original_url"],
                    "stems": result["stems"],
                    "separation_type": result["separation_type"],
                    "hi_fi": result["hi_fi"],
                    "processed_at": result["processed_at"],
                    "user_id": result["user_id"]
                }
            }
            print(f"Respuesta exitosa: {response_data}")
            return response_data
        else:
            error_msg = result.get("error", "Error desconocido en procesamiento")
            print(f"Error en procesamiento: {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
            
    except Exception as e:
        print(f"Error completo en Moises Style: {e}")
        print(f"Tipo de error: {type(e)}")
        import traceback
        print(f"Stack trace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}")
async def get_status(task_id: str):
    """Get processing status"""
    task = await get_task_status(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Return B2 URLs directly (already uploaded to B2)
    stems_urls = None
    if task.status == TaskStatus.COMPLETED and task.stems:
        stems_urls = task.stems  # These are already B2 URLs
    
    return {
        "task_id": task_id,
        "status": task.status,
        "progress": task.progress,
        "stems": stems_urls,
        "bpm": 126,  # Default BPM
        "key": "E",  # Default key
        "timeSignature": "4/4",  # Default time signature
        "duration": "5:00"  # Default duration
    }

@app.get("/audio/{path:path}")
async def serve_audio(path: str):
    """Serve audio files from B2 to avoid CORS issues"""
    try:
        # Download file from B2
        file_content = await b2_storage.download_file(path)
        
        # Return as streaming response
        return StreamingResponse(
            file_content,
            media_type="audio/wav",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "Range",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        print(f"Error serving audio {path}: {e}")
        raise HTTPException(status_code=404, detail="Audio file not found")

@app.get("/download/{task_id}/{stem_name}")
async def download_stem(task_id: str, stem_name: str):
    """Download separated stem"""
    task = await get_task_status(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Task not completed")
    
    # Check if stems exist in the task
    if not task.stems or stem_name not in task.stems:
        raise HTTPException(status_code=404, detail="Stem not found")
    
    stem_path = Path(task.stems[stem_name])
    if not stem_path.exists():
        raise HTTPException(status_code=404, detail="Stem file not found")
    
    return FileResponse(
        path=str(stem_path),
        filename=f"{stem_name}",
        media_type="audio/wav"
    )

async def process_audio(task: ProcessingTask, custom_tracks: Optional[Dict] = None, hi_fi: bool = False):
    """Background task to process audio"""
    try:
        # Update task status
        task.status = TaskStatus.PROCESSING
        task.progress = 10
        
        # Process based on separation type
        if task.separation_type == "custom" and custom_tracks:
            # Custom track separation with REAL AI
            stems = await audio_processor.separate_custom_tracks(
                task.file_path,
                custom_tracks,
                hi_fi
            )
        else:
            # Use REAL Demucs AI processing for best quality
            def update_progress(progress: int, message: str = ""):
                task.progress = progress
                print(f"Progress: {progress}% - {message}")
            
            # SMART logic: Demucs for 4 tracks, Spleeter simulation for 2 tracks
            if task.separation_type == "vocals-instrumental":
                # Use Spleeter simulation for 2 tracks
                stems = await audio_processor.separate_with_spleeter_simulated(task.file_path, update_progress)
            elif task.separation_type == "vocals-drums-bass-other":
                # Use Demucs for 4 tracks
                stems = await audio_processor.separate_with_demucs(task.file_path, update_progress)
            else:
                # Default to Demucs
                stems = await audio_processor.separate_with_demucs(task.file_path, update_progress)
        
        # Upload stems to B2 for online playback
        print(f"Uploading {len(stems)} stems to B2...")
        task.progress = 85
        b2_stems = await upload_stems_to_b2(stems, task.id)
        task.progress = 95
        
        # Update task with B2 URLs
        task.stems = b2_stems
        task.status = TaskStatus.COMPLETED
        task.progress = 100
        
        print(f"Audio processing completed with B2 URLs: {b2_stems}")
        
    except Exception as e:
        task.status = TaskStatus.FAILED
        task.error = str(e)
        print(f"Processing error: {e}")

async def upload_stems_to_b2(stems: Dict[str, str], task_id: str) -> Dict[str, str]:
    """Upload separated stems to B2 and return URLs"""
    try:
        import aiohttp
        import aiofiles
        
        b2_stems = {}
        
        for stem_name, stem_path in stems.items():
            if os.path.exists(stem_path):
                print(f"Uploading {stem_name} to B2...")
                
                # Read file
                async with aiofiles.open(stem_path, 'rb') as f:
                    file_data = await f.read()
                
                # Create FormData
                form_data = aiohttp.FormData()
                form_data.add_field('file', file_data, filename=f"{stem_name}.wav", content_type='audio/wav')
                form_data.add_field('userId', 'system')
                form_data.add_field('songId', task_id)
                form_data.add_field('trackName', stem_name)
                form_data.add_field('folder', 'stems')
                
                # Upload to B2 via proxy
                async with aiohttp.ClientSession() as session:
                    async with session.post('http://localhost:3001/api/upload', data=form_data) as response:
                        if response.status == 200:
                            result = await response.json()
                            b2_url = result.get('downloadUrl', '')
                            b2_stems[stem_name] = b2_url
                            print(f"SUCCESS: {stem_name} uploaded to B2: {b2_url}")
                        else:
                            print(f"ERROR: Failed to upload {stem_name}: {response.status}")
        
        return b2_stems
        
    except Exception as e:
        print(f"ERROR uploading stems to B2: {e}")
        return stems  # Return local paths as fallback

async def get_task_status(task_id: str) -> Optional[ProcessingTask]:
    """Get task status from memory storage"""
    return tasks_storage.get(task_id)

# Chord Analysis Endpoints
@app.post("/api/analyze-chords")
async def analyze_chords(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Analyze chords and key of an audio file"""
    try:
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Save uploaded file
        upload_dir = Path("uploads") / task_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = upload_dir / "audio.wav"
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Create task
        task = ProcessingTask(
            id=task_id,
            status=TaskStatus.PROCESSING,
            file_path=str(file_path),
            progress=0
        )
        tasks_storage[task_id] = task
        
        # Start chord analysis in background
        background_tasks.add_task(process_chord_analysis, task)
        
        return {
            "task_id": task_id,
            "status": "processing",
            "message": "Chord analysis started"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chord-analysis/{task_id}")
async def get_chord_analysis(task_id: str):
    """Get chord analysis results"""
    task = tasks_storage.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "task_id": task_id,
        "status": task.status,
        "progress": task.progress,
        "chords": task.chords if hasattr(task, 'chords') else None,
        "key": task.key if hasattr(task, 'key') else None,
        "error": task.error if hasattr(task, 'error') else None
    }

async def process_chord_analysis(task: ProcessingTask):
    """Background task to analyze chords"""
    try:
        # Initialize chord analyzer
        analyzer = ChordAnalyzer()
        
        # Update progress
        task.progress = 20
        task.status = TaskStatus.PROCESSING
        
        # Analyze chords
        chords = analyzer.analyze_chords(task.file_path)
        task.progress = 60
        
        # Analyze key
        key_info = analyzer.analyze_key(task.file_path)
        task.progress = 80
        
        # Save results
        task.chords = [
            {
                "chord": chord.chord,
                "confidence": chord.confidence,
                "start_time": chord.start_time,
                "end_time": chord.end_time,
                "root_note": chord.root_note,
                "chord_type": chord.chord_type
            }
            for chord in chords
        ]
        
        task.key = {
            "key": key_info.key if key_info else "Unknown",
            "mode": key_info.mode if key_info else "Unknown",
            "confidence": key_info.confidence if key_info else 0.0,
            "tonic": key_info.tonic if key_info else "Unknown"
        } if key_info else None
        
        task.progress = 100
        task.status = TaskStatus.COMPLETED
        
        print(f"Chord analysis completed for task {task.id}")
        
    except Exception as e:
        task.status = TaskStatus.FAILED
        task.error = str(e)
        print(f"Chord analysis error: {e}")

@app.post("/cancel/{task_id}")
async def cancel_separation(task_id: str):
    """Cancel an active separation process"""
    try:
        if task_id not in tasks_storage:
            raise HTTPException(status_code=404, detail="Task not found")
        
        task = tasks_storage[task_id]
        
        # Mark task as cancelled
        task.status = TaskStatus.FAILED
        task.error = "Process cancelled by user"
        
        # Kill the process if it exists
        if task_id in active_processes:
            process = active_processes[task_id]
            if process.poll() is None:  # Process is still running
                process.terminate()
                print(f"Process {task_id} terminated")
            del active_processes[task_id]
        
        # Clean up files
        try:
            upload_dir = Path(f"uploads/{task_id}")
            if upload_dir.exists():
                import shutil
                shutil.rmtree(upload_dir)
                print(f"Cleaned up files for task {task_id}")
        except Exception as e:
            print(f"Error cleaning up files: {e}")
        
        return {"message": "Separation cancelled successfully", "task_id": task_id}
        
    except Exception as e:
        print(f"Error cancelling separation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-bpm")
async def analyze_bpm_endpoint(file: UploadFile = File(...)):
    """
    Analiza el BPM de un archivo de audio usando archivo local
    """
    try:
        print(f"[BPM] Analizando archivo: {file.filename}")
        
        # Guardar archivo temporalmente
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        print(f"[BPM] Archivo temporal: {tmp_path}")
        
        # Analizar BPM usando archivo local
        result = bpm_analyzer_simple.analyze_bpm_from_file(tmp_path)
        
        # Limpiar archivo temporal
        try:
            os.unlink(tmp_path)
        except:
            pass
        
        print(f"[BPM] Resultado: BPM={result.get('bpm')}, Confianza={result.get('confidence', 0)*100:.1f}%")
        
        return {
            "success": True,
            "bpm": result.get("bpm"),
            "confidence": result.get("confidence", 0),
            "details": result
        }
        
    except Exception as e:
        print(f"[BPM] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analyze-bpm-from-file")
async def analyze_bpm_from_file(file_path: str):
    """
    Analiza el BPM de un archivo que ya está en el servidor (cache local)
    """
    try:
        print(f"[BPM] Analizando archivo local: {file_path}")
        
        # Verificar que el archivo existe
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {file_path}")
        
        # Analizar BPM usando archivo local
        result = bpm_analyzer_simple.analyze_bpm_from_file(file_path)
        
        print(f"[BPM] Resultado: BPM={result.get('bpm')}, Confianza={result.get('confidence', 0)*100:.1f}%")
        
        return {
            "success": True,
            "bpm": result.get("bpm"),
            "confidence": result.get("confidence", 0),
            "details": result
        }
        
    except Exception as e:
        print(f"[BPM] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analyze-bpm-from-url")
async def analyze_bpm_from_url(audio_url: str):
    """
    Analiza el BPM de un archivo de audio desde una URL (B2)
    """
    try:
        print(f"[BPM] Analizando desde URL: {audio_url}")
        
        # Descargar archivo desde URL
        import httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(audio_url)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"No se pudo descargar el archivo: {response.status_code}")
            
            file_content = response.content
        
        print(f"[BPM] Archivo descargado: {len(file_content)} bytes")
        
        # Guardar temporalmente
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name
        
        print(f"[BPM] Archivo temporal: {tmp_path}")
        
        # Analizar BPM
        result = bpm_analyzer_simple.analyze_bpm_from_file(tmp_path)
        
        # Limpiar archivo temporal
        try:
            os.unlink(tmp_path)
        except:
            pass
        
        print(f"[BPM] Resultado: BPM={result.get('bpm')}, Confianza={result.get('confidence', 0)*100:.1f}%")
        
        return {
            "success": True,
            "bpm": result.get("bpm"),
            "confidence": result.get("confidence", 0),
            "details": result
        }
        
    except Exception as e:
        print(f"[BPM] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analyze-key-from-url")
async def analyze_key_from_url(audio_url: str):
    """
    Analiza la tonalidad (key) de un archivo de audio desde una URL (B2)
    """
    try:
        print(f"[KEY] Analizando desde URL: {audio_url}")
        
        # Descargar archivo desde URL
        import httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(audio_url)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"No se pudo descargar el archivo: {response.status_code}")
            
            file_content = response.content
        
        print(f"[KEY] Archivo descargado: {len(file_content)} bytes")
        
        # Guardar temporalmente
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name
        
        print(f"[KEY] Archivo temporal: {tmp_path}")
        
        # Analizar tonalidad
        result = key_analyzer_simple.analyze_key_from_file(tmp_path)
        
        # Limpiar archivo temporal
        try:
            os.unlink(tmp_path)
        except:
            pass
        
        print(f"[KEY] Resultado: Key={result.get('key_string')}, Confianza={result.get('confidence', 0)*100:.1f}%")
        
        return {
            "success": True,
            "key": result.get("key"),
            "scale": result.get("scale"),
            "key_string": result.get("key_string"),
            "confidence": result.get("confidence", 0),
            "details": result
        }
        
    except Exception as e:
        print(f"[KEY] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analyze-time-signature-from-url")
async def analyze_time_signature_from_url(audio_url: str):
    """
    Analiza el compás (time signature) de un archivo de audio desde una URL (B2)
    """
    try:
        print(f"[TIME SIG] Analizando desde URL: {audio_url}")
        
        # Descargar archivo desde URL
        import httpx
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.get(audio_url)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"No se pudo descargar el archivo: {response.status_code}")
            
            file_content = response.content
        
        print(f"[TIME SIG] Archivo descargado: {len(file_content)} bytes")
        
        # Guardar temporalmente
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name
        
        print(f"[TIME SIG] Archivo temporal: {tmp_path}")
        
        # Analizar compás
        result = time_signature_analyzer.analyze_time_signature_from_file(tmp_path)
        
        # Limpiar archivo temporal
        try:
            os.unlink(tmp_path)
        except:
            pass
        
        print(f"[TIME SIG] Resultado: {result.get('time_signature')}, Confianza={result.get('confidence', 0)*100:.1f}%")
        
        return {
            "success": True,
            "time_signature": result.get("time_signature"),
            "confidence": result.get("confidence", 0),
            "detected_pattern": result.get("detected_pattern"),
            "details": result
        }
        
    except Exception as e:
        print(f"[TIME SIG] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.options("/api/generate-click-track")
async def generate_click_track_options():
    """Handle CORS preflight request"""
    return {"message": "OK"}

@app.post("/api/generate-click-track")
async def generate_click_track(request: Request):
    """
    Genera un click track alineado con el primer ataque de la canción y lo sube a B2
    """
    print("[CLICK] ==================== INICIO GENERATE CLICK TRACK ====================")
    try:
        print("[CLICK] 1. Parseando request body...")
        body = await request.json()
        print(f"[CLICK] Body recibido: {body}")
        
        bpm = body.get("bpm")
        duration_seconds = body.get("duration_seconds")
        time_signature = body.get("time_signature", "4/4")
        song_id = body.get("song_id")
        user_id = body.get("user_id")
        audio_url = body.get("audio_url")  # URL del audio original
        silence_ms = body.get("silence_ms", 0)  # Silencio inicial en ms desde frontend
        
        print(f"[CLICK] 2. Validando parametros: bpm={bpm}, duration={duration_seconds}, song_id={song_id}, user_id={user_id}, silence_ms={silence_ms}")
        
        if not bpm or not duration_seconds:
            print("[CLICK] ERROR: Falta BPM o duracion")
            raise HTTPException(status_code=400, detail="BPM y duración son requeridos")
        
        if not song_id or not user_id:
            print("[CLICK] ADVERTENCIA: Falta song_id o user_id, usando valores por defecto")
            song_id = song_id or "unknown"
            user_id = user_id or "unknown"
        
        print(f"[CLICK] 3. Generando click track: BPM={bpm}, Duración={duration_seconds}s, Compás={time_signature}, Silencio={silence_ms}ms")
        
        # Detectar el onset (primer ataque de sonido) si se proporciona audio_url
        onset_time = 0.0
        
        if audio_url:
            print(f"[CLICK] Descargando audio desde: {audio_url}")
            try:
                import httpx
                import librosa
                
                # Descargar el audio
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.get(audio_url)
                    if response.status_code == 200:
                        audio_content = response.content
                        print(f"[CLICK] Audio descargado: {len(audio_content)} bytes")
                        
                        # Guardar temporalmente
                        temp_audio_path = os.path.join(tempfile.gettempdir(), f"temp_audio_{uuid.uuid4().hex}.mp3")
                        with open(temp_audio_path, 'wb') as f:
                            f.write(audio_content)
                        
                        print(f"[CLICK] Detectando primer ataque de sonido...")
                        
                        # Cargar audio con librosa (solo primeros 10 segundos para velocidad)
                        y, sr = librosa.load(temp_audio_path, sr=22050, duration=10.0)
                        print(f"[CLICK] Audio cargado: {len(y)} samples, sr={sr}")
                        
                        # Detectar onsets (ataques de sonido) con parámetros ajustados
                        onset_frames = librosa.onset.onset_detect(
                            y=y, 
                            sr=sr, 
                            backtrack=True,
                            units='frames'
                        )
                        
                        print(f"[CLICK] Onsets detectados: {len(onset_frames)}")
                        
                        if len(onset_frames) > 0:
                            # Convertir frames a tiempo
                            onset_times = librosa.frames_to_time(onset_frames, sr=sr)
                            onset_time = float(onset_times[0])
                            print(f"[CLICK] OK: Primer sonido detectado en: {onset_time:.3f}s ({onset_time*1000:.0f}ms)")
                            print(f"[CLICK] INFO: Onset detectado por librosa en el audio original")
                        else:
                            print(f"[CLICK] ADVERTENCIA: No se detectaron onsets, usando tiempo 0")
                        
                        # Limpiar archivo temporal
                        try:
                            os.unlink(temp_audio_path)
                            print(f"[CLICK] Archivo temporal eliminado")
                        except Exception as cleanup_error:
                            print(f"[CLICK] Error limpiando: {cleanup_error}")
                    else:
                        print(f"[CLICK] Error HTTP: {response.status_code}")
            except Exception as e:
                print(f"[CLICK] ADVERTENCIA: Error detectando onset: {e}, usando tiempo 0")
                import traceback
                traceback.print_exc()
                onset_time = 0.0
        
        print(f"[CLICK] 4. Usando onset offset: {onset_time:.3f}s")
        
        # Rutas a los archivos de click
        print("[CLICK] 5. Buscando archivos de audio de click...")
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(backend_dir)
        click_path = os.path.join(project_root, "public", "audio", "click.wav")
        click2_path = os.path.join(project_root, "public", "audio", "click2.wav")
        
        print(f"[CLICK] Archivos de click: {click_path}, {click2_path}")
        print(f"[CLICK] Existe click.wav? {os.path.exists(click_path)}")
        print(f"[CLICK] Existe click2.wav? {os.path.exists(click2_path)}")
        
        # Generar archivo temporal de salida
        print("[CLICK] 6. Preparando archivo temporal de salida...")
        output_path = os.path.join(tempfile.gettempdir(), f"click_track_{song_id}_{uuid.uuid4().hex}.wav")
        print(f"[CLICK] Output path: {output_path}")
        
        # Generar click track con onset del audio original
        print(f"[CLICK] 7. Generando click track con pydub... (onset detectado: {onset_time}s, silencio frontend: {silence_ms}ms)")
        
        # USAR EL ONSET DEL AUDIO ORIGINAL (más confiable que los onsets de tracks individuales)
        total_offset_seconds = onset_time
        print(f"[CLICK] Offset final: {total_offset_seconds:.3f}s")
        print(f"[CLICK] NOTA: Click track usará onset del audio original ({onset_time:.3f}s) para sincronización")
        print(f"[CLICK] NOTA: Ignorando silencio del frontend ({silence_ms}ms) - usando detección automática")
        
        result_path = click_generator_simple.generate_click_track(
            bpm=int(bpm),
            duration_seconds=float(duration_seconds),
            click_path=click_path,
            click2_path=click2_path,
            time_signature=time_signature,
            output_path=output_path,
            onset_offset_seconds=total_offset_seconds  # Solo el delay del frontend
        )
        
        print(f"[CLICK] 8. Click track generado exitosamente: {result_path}")
        
        # Subir a B2
        print("[CLICK] 9. Leyendo archivo para subir a B2...")
        with open(result_path, 'rb') as f:
            file_content = f.read()
        
        print(f"[CLICK] Archivo leído: {len(file_content)} bytes")
        
        # Generar nombre de archivo para B2
        b2_filename = f"stems/{user_id}/{song_id}/click.wav"
        print(f"[CLICK] 10. Subiendo a B2 como: {b2_filename}")
        
        # Subir a B2
        upload_result = await b2_storage.upload_file(
            file_content=file_content,
            filename=b2_filename,
            content_type='audio/wav'
        )
        
        print(f"[CLICK] 11. Subida a B2 completada: {upload_result}")
        
        # Limpiar archivo temporal
        try:
            os.unlink(result_path)
        except:
            pass
        
        print(f"[CLICK] Click track subido a B2: {upload_result.get('download_url')}")
        print(f"[CLICK] Onset offset: {onset_time:.3f}s")
        print(f"[CLICK] OK: Proceso completado exitosamente")
        
        return {
            "success": True,
            "click_url": upload_result.get("download_url"),
            "file_id": upload_result.get("file_id"),
            "onset_offset_seconds": onset_time
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"[CLICK] ERROR: {error_msg}")
        import traceback
        traceback.print_exc()
        
        # Retornar error detallado
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
