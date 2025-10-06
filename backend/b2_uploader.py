"""
B2 Uploader - Subir pistas separadas a Backblaze B2
"""

import os
import asyncio
import aiohttp
import aiofiles
from pathlib import Path
from typing import Dict, Optional

class B2Uploader:
    def __init__(self):
        self.proxy_url = "http://localhost:3001"
        self.b2_bucket = "moises2"
        self.b2_endpoint = "https://s3.us-east-005.backblazeb2.com"
    
    async def upload_stem_to_b2(self, file_path: str, user_id: str, song_id: str, stem_name: str) -> str:
        """Subir una pista separada a B2"""
        try:
            print(f"[UPLOAD] Uploading stem to B2: {stem_name}")
            
            # Leer el archivo
            async with aiofiles.open(file_path, 'rb') as f:
                file_data = await f.read()
            
            # Crear FormData
            form_data = aiohttp.FormData()
            form_data.add_field('file', file_data, filename=f"{stem_name}.wav", content_type='audio/wav')
            form_data.add_field('userId', user_id)
            form_data.add_field('songId', song_id)
            form_data.add_field('trackName', stem_name)
            form_data.add_field('folder', 'stems')
            
            # Subir a B2 via proxy
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.proxy_url}/api/upload", data=form_data) as response:
                    if response.status == 200:
                        result = await response.json()
                        download_url = result.get('downloadUrl', '')
                        print(f"[OK] Stem uploaded to B2: {stem_name} -> {download_url}")
                        return download_url
                    else:
                        error_text = await response.text()
                        print(f"[ERROR] Error uploading stem {stem_name}: {response.status} - {error_text}")
                        return ""
        
        except Exception as e:
            print(f"[ERROR] Error uploading stem {stem_name}: {e}")
            return ""
    
    async def upload_all_stems_to_b2(self, stems: Dict[str, str], user_id: str, song_id: str) -> Dict[str, str]:
        """Subir todas las pistas separadas a B2"""
        print(f"[START] Uploading all stems to B2 for song: {song_id}")
        
        b2_stems = {}
        
        # Subir cada pista en paralelo
        upload_tasks = []
        for stem_name, stem_path in stems.items():
            if os.path.exists(stem_path):
                task = self.upload_stem_to_b2(stem_path, user_id, song_id, stem_name)
                upload_tasks.append((stem_name, task))
        
        # Esperar a que todas las subidas terminen
        for stem_name, task in upload_tasks:
            try:
                b2_url = await task
                if b2_url:
                    b2_stems[stem_name] = b2_url
                    print(f"[OK] {stem_name} uploaded to B2: {b2_url}")
                else:
                    print(f"[ERROR] Failed to upload {stem_name}")
            except Exception as e:
                print(f"[ERROR] Error uploading {stem_name}: {e}")
        
        print(f"[MUSIC] Upload complete. {len(b2_stems)} stems uploaded to B2")
        return b2_stems

# Instancia global
b2_uploader = B2Uploader()
