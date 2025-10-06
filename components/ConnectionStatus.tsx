'use client'

import { useState, useEffect } from 'react'
import { Cloud, Database } from 'lucide-react'

export default function ConnectionStatus() {
  const [b2Status, setB2Status] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const [b2Error, setB2Error] = useState<string | null>(null)

  // Verificar estado de B2
  useEffect(() => {
    const checkB2Status = async () => {
      try {
        // Verificar si el proxy server responde
        const response = await fetch('http://localhost:8000/')
        const data = await response.json()
        
        if (data.status === 'running') {
          setB2Status('connected')
          setB2Error(null)
        } else {
          setB2Status('disconnected')
          setB2Error('B2 proxy server not responding')
        }
      } catch (error) {
        setB2Status('disconnected')
        setB2Error('B2 proxy server not running')
      }
    }

    checkB2Status()
    // Verificar cada 10 segundos para diagnóstico
    const interval = setInterval(checkB2Status, 10000)
    return () => clearInterval(interval)
  }, [])

  // Verificar estado de Firebase
  useEffect(() => {
    const checkFirebaseStatus = async () => {
      try {
        // Verificar si Firebase está configurado (simplificado)
        // Por ahora asumimos que Firebase está conectado si no hay errores
        setFirebaseStatus('connected')
      } catch (error) {
        setFirebaseStatus('disconnected')
      }
    }

    checkFirebaseStatus()
    // Verificar cada 30 segundos
    const interval = setInterval(checkFirebaseStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center space-x-3">
      {/* B2 Status */}
      <div className="flex items-center space-x-2 group relative">
        <div className="relative">
          <Cloud 
            className={`w-5 h-5 ${
              b2Status === 'connected' 
                ? 'text-blue-500' 
                : b2Status === 'checking'
                ? 'text-yellow-500 animate-pulse'
                : 'text-red-500'
            }`} 
          />
          {b2Status === 'connected' && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
          )}
        </div>
        <span className="text-sm text-gray-400">B2</span>
        
        {/* Tooltip con error */}
        {b2Error && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-red-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            {b2Error}
          </div>
        )}
      </div>

      {/* Firebase Status */}
      <div className="flex items-center space-x-2">
        <div className="relative">
          <Database 
            className={`w-5 h-5 ${
              firebaseStatus === 'connected' 
                ? 'text-blue-500' 
                : firebaseStatus === 'checking'
                ? 'text-yellow-500 animate-pulse'
                : 'text-gray-500'
            }`} 
          />
          {firebaseStatus === 'connected' && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
          )}
        </div>
        <span className="text-sm text-gray-400">FB</span>
      </div>
    </div>
  )
}
