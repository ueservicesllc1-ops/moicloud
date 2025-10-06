"""
B2 Storage - Real implementation
"""

import aiohttp
import asyncio
import base64
import hashlib
import hmac
import json
from typing import AsyncGenerator

class B2Storage:
    def __init__(self):
        self.initialized = False
        self.key_id = "005c2b526be0baa0000000017"
        self.application_key = "K005gAZLuxJaOS4/gW0b5/+YtoaJ/6s"
        self.bucket_name = "moises2"
        self.bucket_id = "5ce20b5552a69b8e909b0a1a"
        self.api_url = "https://api.backblazeb2.com"
        self.download_url = "https://s3.us-east-005.backblazeb2.com"
        self.auth_token = None
        self.api_url_authorized = None
    
    async def initialize(self):
        """Initialize B2 storage with real authentication"""
        try:
            # Authenticate with B2
            auth_string = f"{self.key_id}:{self.application_key}"
            auth_bytes = base64.b64encode(auth_string.encode()).decode()
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.api_url}/b2api/v2/b2_authorize_account",
                    headers={"Authorization": f"Basic {auth_bytes}"}
                ) as response:
                    if response.status == 200:
                        auth_data = await response.json()
                        self.auth_token = auth_data["authorizationToken"]
                        self.api_url_authorized = auth_data["apiUrl"]
                        self.initialized = True
                        print("B2 Storage initialized (real mode)")
                    else:
                        print(f"B2 authentication failed: {response.status}")
                        self.initialized = False
        except Exception as e:
            print(f"B2 initialization error: {e}")
            self.initialized = False
    
    async def upload_file(self, file_content: bytes, filename: str, content_type: str = "audio/mpeg"):
        """Upload file to B2 storage"""
        try:
            if not self.initialized:
                await self.initialize()
            
            if not self.initialized:
                raise Exception("B2 not initialized")
            
            print(f"Uploading to B2: {filename}")
            print(f"File size: {len(file_content)} bytes")
            print(f"Bucket ID: {self.bucket_id}")
            print(f"API URL: {self.api_url_authorized}")
            
            # Get upload URL
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_url_authorized}/b2api/v2/b2_get_upload_url",
                    headers={"Authorization": self.auth_token},
                    json={"bucketId": self.bucket_id}
                ) as response:
                    if response.status == 200:
                        upload_data = await response.json()
                        upload_url = upload_data["uploadUrl"]
                        upload_token = upload_data["authorizationToken"]
                        
                        # Upload file
                        sha1_hash = hashlib.sha1(file_content).hexdigest()
                        
                        async with session.post(
                            upload_url,
                            headers={
                                "Authorization": upload_token,
                                "X-Bz-File-Name": filename,
                                "X-Bz-Content-Type": content_type,
                                "X-Bz-Content-Sha1": sha1_hash
                            },
                            data=file_content
                        ) as upload_response:
                            if upload_response.status == 200:
                                try:
                                    file_data = await upload_response.json()
                                    file_id = file_data.get("fileId", "unknown")
                                except:
                                    file_id = "unknown"
                                
                                download_url = f"{self.download_url}/{self.bucket_name}/{filename}"
                                
                                print(f"Successfully uploaded to B2: {download_url}")
                                
                                return {
                                    "success": True,
                                    "download_url": download_url,
                                    "file_id": file_id,
                                    "filename": filename
                                }
                            else:
                                error_text = await upload_response.text()
                                print(f"B2 upload error: {upload_response.status} - {error_text}")
                                raise Exception(f"Upload failed: {upload_response.status} - {error_text}")
                    else:
                        error_text = await response.text()
                        raise Exception(f"Failed to get upload URL: {response.status} - {error_text}")
                        
        except Exception as e:
            print(f"Error in upload_file: {e}")
            raise

    async def download_file(self, file_path: str) -> AsyncGenerator[bytes, None]:
        """Download file from B2 and stream it"""
        try:
            # Construir URL completa de B2
            b2_url = f"https://s3.us-east-005.backblazeb2.com/moises2/{file_path}"
            print(f"Downloading from B2: {b2_url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(b2_url) as response:
                    if response.status == 200:
                        async for chunk in response.content.iter_chunked(8192):
                            yield chunk
                    else:
                        print(f"Error downloading {file_path}: {response.status}")
                        raise Exception(f"Failed to download file: {response.status}")
        except Exception as e:
            print(f"Error in download_file: {e}")
            raise

    async def download_file_bytes(self, file_path: str) -> bytes:
        """Download file from B2 and return all bytes"""
        try:
            if not self.initialized:
                await self.initialize()
            
            # Usar URL de S3 compatible (más confiable)
            s3_url = f"https://s3.us-east-005.backblazeb2.com/moises2/{file_path}"
            print(f"Downloading from B2 S3 URL: {s3_url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(s3_url) as response:
                    if response.status == 200:
                        content = await response.read()
                        print(f"Successfully downloaded {file_path}: {len(content)} bytes")
                        return content
                    else:
                        print(f"Error downloading {file_path}: {response.status}")
                        return None
        except Exception as e:
            print(f"Error in download_file_bytes: {e}")
            return None

    async def delete_file(self, file_path: str) -> bool:
        """Delete file from B2"""
        try:
            if not self.initialized:
                await self.initialize()
            
            # Primero necesitamos obtener el file_id del archivo
            file_id = await self._get_file_id(file_path)
            if not file_id:
                print(f"File not found in B2: {file_path}")
                return False
            
            # Eliminar archivo usando la API de B2
            delete_url = f"{self.api_url_authorized}/b2api/v2/b2_delete_file_version"
            
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": self.auth_token,
                    "Content-Type": "application/json"
                }
                
                delete_data = {
                    "fileId": file_id,
                    "fileName": file_path
                }
                
                async with session.post(delete_url, headers=headers, json=delete_data) as response:
                    if response.status == 200:
                        print(f"Archivo eliminado de B2: {file_path}")
                        return True
                    else:
                        error_text = await response.text()
                        print(f"Error eliminando archivo {file_path}: {response.status} - {error_text}")
                        return False
                        
        except Exception as e:
            print(f"Error in delete_file: {e}")
            return False

    async def _get_file_id(self, file_path: str) -> str:
        """Obtener el file_id de un archivo en B2"""
        try:
            if not self.initialized:
                await self.initialize()
            
            list_url = f"{self.api_url_authorized}/b2api/v2/b2_list_file_names"
            
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": self.auth_token,
                    "Content-Type": "application/json"
                }
                
                list_data = {
                    "bucketId": self.bucket_id,
                    "startFileName": file_path,
                    "maxFileCount": 1
                }
                
                async with session.post(list_url, headers=headers, json=list_data) as response:
                    if response.status == 200:
                        data = await response.json()
                        files = data.get("files", [])
                        for file_info in files:
                            if file_info["fileName"] == file_path:
                                return file_info["fileId"]
                    else:
                        print(f"Error listando archivos: {response.status}")
                        
        except Exception as e:
            print(f"Error in _get_file_id: {e}")
            
        return None

# Global instance
b2_storage = B2Storage()
