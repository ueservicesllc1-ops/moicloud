#!/usr/bin/env python3
"""
Simple script to run the FastAPI backend
"""
if __name__ == "__main__":
    import uvicorn
    print("Starting MoisesClone Backend on port 8000...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
