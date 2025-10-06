from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import uuid
import asyncio
from pathlib import Path
from typing import Dict, List
import json

app = FastAPI(
    title="Moises Clone API",
    description="AI-powered audio separation service",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

# In-memory storage for demo
tasks = {}

@app.get("/")
async def root():
    return {"message": "Moises Clone API", "status": "running"}

@app.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    separation_type: str = "2stems"
):
    """Upload audio file and start separation process"""
    
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")
    
    # Generate unique task ID
    task_id = str(uuid.uuid4())
    
    # Create upload directory
    task_dir = uploads_dir / task_id
    task_dir.mkdir(exist_ok=True)
    
    # Save uploaded file
    file_path = task_dir / f"original.{file.filename.split('.')[-1]}"
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Create processing task
    task = {
        "id": task_id,
        "original_filename": file.filename,
        "file_path": str(file_path),
        "separation_type": separation_type,
        "status": "processing",
        "progress": 0,
        "stems": None,
        "error": None
    }
    
    tasks[task_id] = task
    
    # Simulate processing (in real app, this would be background task)
    asyncio.create_task(simulate_processing(task_id))
    
    return {
        "task_id": task_id,
        "status": "processing",
        "message": "Audio upload successful, processing started"
    }

@app.get("/status/{task_id}")
async def get_status(task_id: str):
    """Get processing status"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = tasks[task_id]
    return {
        "task_id": task_id,
        "status": task["status"],
        "progress": task["progress"],
        "stems": task["stems"] if task["status"] == "completed" else None
    }

@app.get("/download/{task_id}/{stem_name}")
async def download_stem(task_id: str, stem_name: str):
    """Download separated stem"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = tasks[task_id]
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="Task not completed")
    
    # In real app, this would serve the actual file
    return JSONResponse({
        "message": f"Downloading {stem_name} for task {task_id}",
        "stem_name": stem_name,
        "task_id": task_id
    })

async def simulate_processing(task_id: str):
    """Simulate audio processing"""
    try:
        task = tasks[task_id]
        
        # Simulate processing steps
        for progress in [20, 40, 60, 80, 100]:
            await asyncio.sleep(2)  # Simulate processing time
            task["progress"] = progress
            tasks[task_id] = task
        
        # Simulate completed stems
        stems = {
            "vocals": f"vocals_{task_id}.wav",
            "accompaniment": f"accompaniment_{task_id}.wav"
        }
        
        task["stems"] = stems
        task["status"] = "completed"
        task["progress"] = 100
        tasks[task_id] = task
        
    except Exception as e:
        task["status"] = "failed"
        task["error"] = str(e)
        tasks[task_id] = task

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
