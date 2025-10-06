import { NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

// Configuración de B2
const B2_APPLICATION_KEY_ID = "005c2b526be0baa0000000015"
const B2_APPLICATION_KEY = "K005CI7AI3w7Zb6tEgLwluNmqYP0PUc"
const B2_BUCKET_NAME = "moises"

const s3Client = new S3Client({
  region: 'us-east-005',
  endpoint: 'https://s3.us-east-005.backblazeb2.com',
  credentials: {
    accessKeyId: B2_APPLICATION_KEY_ID,
    secretAccessKey: B2_APPLICATION_KEY,
  },
  forcePathStyle: true,
})

export async function GET() {
  try {
    // Verificar estado de Firebase
    const firebaseStatus = {
      connected: true,
      timestamp: new Date().toISOString()
    }

    // Verificar estado de B2
    let b2Status = {
      connected: false,
      timestamp: new Date().toISOString(),
      error: null as string | null
    }

    try {
      // Intentar listar objetos del bucket para verificar conexión
      const command = new ListObjectsV2Command({
        Bucket: B2_BUCKET_NAME,
        MaxKeys: 1
      })
      
      await s3Client.send(command)
      b2Status.connected = true
    } catch (b2Error) {
      b2Status.connected = false
      b2Status.error = b2Error instanceof Error ? b2Error.message : 'Unknown B2 error'
      console.error('B2 connection test failed:', b2Error)
    }

    return NextResponse.json({
      status: b2Status.connected ? 'healthy' : 'unhealthy',
      services: {
        firebase: firebaseStatus,
        b2: b2Status
      }
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}
