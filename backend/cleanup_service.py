"""
Cleanup Service - Sistema de limpieza automática estilo Moises
"""

import asyncio
import os
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import shutil
from typing import List, Dict
import json

from b2_storage import b2_storage

class CleanupService:
    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "moises_temp"
        self.cleanup_interval = 3600  # 1 hora en segundos
        self.file_retention_days = 7  # Mantener archivos por 7 días
        self.is_running = False
        
    async def start_cleanup_service(self):
        """Iniciar servicio de limpieza automática"""
        if self.is_running:
            print("[?] Cleanup service ya está corriendo")
            return
            
        self.is_running = True
        print(f"Iniciando Cleanup Service - Intervalo: {self.cleanup_interval}s")
        
        while self.is_running:
            try:
                await self.run_cleanup()
                print(f"⏰ Próxima limpieza en {self.cleanup_interval} segundos...")
                await asyncio.sleep(self.cleanup_interval)
            except Exception as e:
                print(f"[ERROR] Error en cleanup service: {e}")
                await asyncio.sleep(300)  # Esperar 5 minutos antes de reintentar
    
    def stop_cleanup_service(self):
        """Detener servicio de limpieza"""
        self.is_running = False
        print("Cleanup Service detenido")
    
    async def run_cleanup(self):
        """Ejecutar limpieza completa"""
        print(f"Ejecutando limpieza automática - {datetime.now()}")
        
        # 1. Limpiar archivos temporales locales
        await self.cleanup_temp_files()
        
        # 2. Limpiar archivos B2 antiguos (simulado)
        await self.cleanup_old_b2_files()
        
        # 3. Limpiar logs antiguos
        await self.cleanup_old_logs()
        
        print("[OK] Limpieza completada")
    
    async def cleanup_temp_files(self):
        """Limpiar archivos temporales locales"""
        try:
            if not self.temp_dir.exists():
                return
                
            print(f"[DELETE] Limpiando archivos temporales en: {self.temp_dir}")
            
            files_removed = 0
            total_size_removed = 0
            
            for item in self.temp_dir.iterdir():
                if item.is_file():
                    # Verificar edad del archivo
                    file_age = datetime.now() - datetime.fromtimestamp(item.stat().st_mtime)
                    
                    if file_age > timedelta(hours=1):  # Archivos más antiguos que 1 hora
                        file_size = item.stat().st_size
                        item.unlink()
                        files_removed += 1
                        total_size_removed += file_size
                        print(f"  [DELETE] Eliminado: {item.name} ({file_size / 1024:.1f} KB)")
                
                elif item.is_dir():
                    # Verificar si el directorio está vacío o es antiguo
                    try:
                        dir_age = datetime.now() - datetime.fromtimestamp(item.stat().st_mtime)
                        if dir_age > timedelta(hours=2):  # Directorios más antiguos que 2 horas
                            shutil.rmtree(item, ignore_errors=True)
                            print(f"  [DELETE] Eliminado directorio: {item.name}")
                    except:
                        pass
            
            if files_removed > 0:
                print(f"[OK] Limpieza temp completada: {files_removed} archivos, {total_size_removed / 1024:.1f} KB liberados")
            else:
                print("[OK] No hay archivos temporales para limpiar")
                
        except Exception as e:
            print(f"[ERROR] Error limpiando archivos temporales: {e}")
    
    async def cleanup_old_b2_files(self):
        """Limpiar archivos B2 antiguos (simulado)"""
        try:
            print("[?] Verificando archivos B2 antiguos...")
            
            # En una implementación real, aquí consultarías la base de datos
            # para obtener archivos antiguos y eliminarlos de B2
            
            # Por ahora solo simulamos la limpieza
            await asyncio.sleep(1)  # Simular trabajo
            
            print("[OK] Verificación B2 completada (simulado)")
            
        except Exception as e:
            print(f"[ERROR] Error verificando B2: {e}")
    
    async def cleanup_old_logs(self):
        """Limpiar logs antiguos"""
        try:
            log_dir = Path("logs")
            if not log_dir.exists():
                return
                
            print("[?] Limpiando logs antiguos...")
            
            files_removed = 0
            for log_file in log_dir.glob("*.log"):
                file_age = datetime.now() - datetime.fromtimestamp(log_file.stat().st_mtime)
                
                if file_age > timedelta(days=7):  # Logs más antiguos que 7 días
                    log_file.unlink()
                    files_removed += 1
                    print(f"  [DELETE] Eliminado log: {log_file.name}")
            
            if files_removed > 0:
                print(f"[OK] Limpieza logs completada: {files_removed} archivos")
            else:
                print("[OK] No hay logs antiguos para limpiar")
                
        except Exception as e:
            print(f"[ERROR] Error limpiando logs: {e}")
    
    async def cleanup_user_files(self, user_id: str, days_old: int = 7):
        """Limpieza específica para un usuario"""
        try:
            print(f"[CLEAN] Limpieza específica para usuario {user_id} (> {days_old} días)")
            
            # Limpiar archivos temporales del usuario
            user_temp_dir = self.temp_dir / f"user_{user_id}"
            if user_temp_dir.exists():
                shutil.rmtree(user_temp_dir, ignore_errors=True)
                print(f"  [DELETE] Eliminado directorio temporal del usuario: {user_temp_dir}")
            
            # En una implementación real, aquí también eliminarías archivos B2 antiguos
            # y actualizarías la base de datos
            
            print(f"[OK] Limpieza usuario {user_id} completada")
            
        except Exception as e:
            print(f"[ERROR] Error en limpieza usuario {user_id}: {e}")
    
    def get_cleanup_stats(self) -> Dict:
        """Obtener estadísticas de limpieza"""
        try:
            stats = {
                "is_running": self.is_running,
                "cleanup_interval": self.cleanup_interval,
                "file_retention_days": self.file_retention_days,
                "temp_dir": str(self.temp_dir),
                "temp_dir_exists": self.temp_dir.exists(),
                "temp_files_count": 0,
                "temp_dir_size": 0
            }
            
            if self.temp_dir.exists():
                files = list(self.temp_dir.iterdir())
                stats["temp_files_count"] = len(files)
                
                total_size = 0
                for item in files:
                    if item.is_file():
                        total_size += item.stat().st_size
                stats["temp_dir_size"] = total_size
            
            return stats
            
        except Exception as e:
            print(f"[ERROR] Error obteniendo stats: {e}")
            return {"error": str(e)}

# Instancia global
cleanup_service = CleanupService()

# Función para ejecutar cleanup como tarea independiente
async def run_cleanup_task():
    """Ejecutar cleanup como tarea independiente"""
    try:
        await cleanup_service.start_cleanup_service()
    except KeyboardInterrupt:
        print("[?] Cleanup service interrumpido por usuario")
        cleanup_service.stop_cleanup_service()
    except Exception as e:
        print(f"[ERROR] Error en cleanup task: {e}")

if __name__ == "__main__":
    print("[CLEAN] Iniciando Cleanup Service independiente...")
    asyncio.run(run_cleanup_task())
