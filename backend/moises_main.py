"""
Moises Style Main API - Arquitectura simplificada estilo Moises
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import uuid
from typing import Optional
import json
from datetime import datetime

from moises_style_processor import moises_processor
from b2_storage import b2_storage
from cleanup_service import cleanup_service
# from bpm_analyzer import bpm_analyzer  # Temporalmente deshabilitado por problemas de encoding
import tempfile
from pathlib import Path

app = FastAPI(
    title="Moises Clone API - Estilo Moises",
    description="API simplificada estilo Moises para separación de audio",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar B2 y cleanup service al startup
@app.on_event("startup")
async def startup_event():
    await b2_storage.initialize()
    
    # Iniciar servicio de limpieza automática
    import asyncio
    asyncio.create_task(cleanup_service.start_cleanup_service())
    
    print("Moises Style API iniciada con cleanup automático")

@app.get("/")
async def root():
    return {
        "message": "Moises Clone API - Estilo Moises", 
        "status": "running",
        "version": "2.0.0"
    }

@app.get("/api/health")
async def health_check():
    return {"status": "OK", "message": "Backend Moises Style is running"}

@app.post("/api/separate")
async def separate_audio_moises_style(
    file: UploadFile = File(...),
    separation_type: str = "vocals-instrumental",
    hi_fi: bool = False,
    user_id: str = None
):
    """
    Separar audio estilo Moises:
    - Solo B2 Storage
    - URLs consistentes
    - Sin almacenamiento local
    """
    
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")
    
    if not user_id:
        user_id = "anonymous"
    
    try:
        # Leer contenido del archivo
        file_content = await file.read()
        
        print(f"[MUSIC] Procesando archivo: {file.filename}")
        print(f"[?] Usuario: {user_id}")
        print(f"[FIX] Tipo separación: {separation_type}")
        print(f"[?] Hi-Fi: {hi_fi}")
        
        # Procesar estilo Moises
        result = await moises_processor.separate_audio_moises_style(
            file_content=file_content,
            filename=file.filename,
            user_id=user_id,
            separation_type=separation_type,
            hi_fi=hi_fi
        )
        
        if result["success"]:
            return {
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
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except Exception as e:
        print(f"[ERROR] Error en separación: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-original")
async def upload_original_only(
    file: UploadFile = File(...),
    user_id: str = None,
    song_id: str = None
):
    """
    Solo subir archivo original a B2 (sin procesamiento)
    """
    
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")
    
    if not user_id:
        user_id = "anonymous"
    
    if not song_id:
        song_id = f"song_{int(datetime.now().timestamp())}"
    
    try:
        file_content = await file.read()
        
        # Subir a B2
        b2_path = f"originals/{user_id}/{song_id}/{file.filename}"
        upload_result = await b2_storage.upload_file(
            file_content=file_content,
            filename=b2_path,
            content_type=file.content_type
        )
        
        if upload_result.get("success"):
            return {
                "success": True,
                "message": "Archivo subido exitosamente",
                "data": {
                    "song_id": song_id,
                    "user_id": user_id,
                    "original_url": upload_result["download_url"],
                    "file_id": upload_result["file_id"],
                    "filename": b2_path
                }
            }
        else:
            raise HTTPException(status_code=500, detail="Error uploading to B2")
            
    except Exception as e:
        print(f"[ERROR] Error subiendo archivo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user-files/{user_id}")
async def get_user_files(user_id: str):
    """
    Obtener archivos del usuario (simulado - en realidad consultarías Firestore)
    """
    try:
        # En una implementación real, esto consultaría Firestore
        # Por ahora retornamos estructura de ejemplo
        return {
            "success": True,
            "user_id": user_id,
            "files": [
                {
                    "song_id": "song_123",
                    "title": "Mi Canción",
                    "artist": "Usuario",
                    "original_url": "https://s3.us-east-005.backblazeb2.com/moises/originals/user123/song123/audio.mp3",
                    "stems": {
                        "vocals": "https://s3.us-east-005.backblazeb2.com/moises/stems/user123/song123/vocals.wav",
                        "instrumental": "https://s3.us-east-005.backblazeb2.com/moises/stems/user123/song123/instrumental.wav"
                    },
                    "created_at": datetime.now().isoformat()
                }
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cleanup/{user_id}")
async def cleanup_user_files(user_id: str, days_old: int = 7):
    """
    Limpiar archivos antiguos del usuario
    """
    try:
        await cleanup_service.cleanup_user_files(user_id, days_old)
        return {
            "success": True,
            "message": f"Limpieza completada para usuario {user_id}",
            "days_old": days_old
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cleanup/stats")
async def get_cleanup_stats():
    """
    Obtener estadísticas del servicio de limpieza
    """
    try:
        stats = cleanup_service.get_cleanup_stats()
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cleanup/manual")
async def manual_cleanup():
    """
    Ejecutar limpieza manual
    """
    try:
        await cleanup_service.run_cleanup()
        return {
            "success": True,
            "message": "Limpieza manual ejecutada"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats():
    """
    Estadísticas del sistema
    """
    try:
        return {
            "success": True,
            "stats": {
                "system": "Moises Style API",
                "version": "2.0.0",
                "storage": "B2 Only",
                "database": "Firestore",
                "status": "running",
                "uptime": "active"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Temporalmente deshabilitado - problema de encoding en Windows
# Los endpoints de BPM se habilitarán cuando se resuelva el problema de encoding

if __name__ == "__main__":
    import uvicorn
    print("Iniciando Moises Style API en puerto 8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)
