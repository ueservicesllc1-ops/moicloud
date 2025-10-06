import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc,
  onSnapshot 
} from 'firebase/firestore'
import { db } from './firebase'

export interface Song {
  id?: string
  title: string
  artist: string
  genre: string
  bpm: number | null
  key: string
  duration: string
  durationSeconds?: number
  timeSignature?: string
  year?: number
  album?: string
  track?: number
  thumbnail: string
  fileUrl: string
  uploadedAt: string
  userId: string
  fileSize: number
  fileName: string
  status: 'uploaded' | 'processing' | 'completed' | 'failed'
  stems?: {
    vocals?: string
    drums?: string
    bass?: string
    other?: string
    instrumental?: string
    click?: string
    [key: string]: string | undefined
  }
  trackColors?: {
    [key: string]: string
  }
  separationTaskId?: string
  clickMetadata?: {
    name: string
    bpm: number
    timeSignature: string
    duration: string
    durationSeconds: number
    generatedAt: string
    onsetOffsetSeconds?: number
  }
}

// Guardar nueva canción en Firestore
export async function saveSong(song: Omit<Song, 'id'>): Promise<string> {
  try {
    console.log('💾 Saving song to Firestore:', song)
    console.log('🔍 Song details:', {
      title: song.title,
      artist: song.artist,
      bpm: song.bpm,
      key: song.key,
      genre: song.genre,
      duration: song.duration,
      userId: song.userId
    })
    
    const docRef = await addDoc(collection(db, 'songs'), {
      ...song,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    
    console.log('✅ Song saved with ID:', docRef.id)
    return docRef.id
  } catch (error) {
    console.error('❌ Error saving song:', error)
    if (error instanceof Error) {
      console.error('❌ Error details:', error.message)
      console.error('❌ Error stack:', error.stack)
    }
    throw error
  }
}

// Obtener canciones del usuario
export async function getUserSongs(userId: string): Promise<Song[]> {
  try {
    console.log('Getting user songs for:', userId)
    
    const q = query(
      collection(db, 'songs'),
      where('userId', '==', userId)
      // Removido orderBy temporalmente para evitar necesidad de índice
    )
    
    const querySnapshot = await getDocs(q)
    const songs: Song[] = []
    
    querySnapshot.forEach((doc) => {
      songs.push({
        id: doc.id,
        ...doc.data()
      } as Song)
    })
    
    // Ordenar por fecha de creación (más reciente primero)
    songs.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || 0)
      const dateB = new Date(b.uploadedAt || 0)
      return dateB.getTime() - dateA.getTime()
    })
    
    console.log('Found songs:', songs.length)
    return songs
  } catch (error) {
    console.error('Error getting user songs:', error)
    throw error
  }
}

// Actualizar estado de canción
export async function updateSongStatus(songId: string, status: Song['status']): Promise<void> {
  try {
    const songRef = doc(db, 'songs', songId)
    await updateDoc(songRef, { status })
  } catch (error) {
    console.error('Error updating song status:', error)
    throw error
  }
}

// Eliminar canción
export async function deleteSong(songId: string): Promise<void> {
  try {
    // Primero obtener la canción para eliminar archivos de B2
    const songDoc = await getDoc(doc(db, 'songs', songId))
    if (songDoc.exists()) {
      const songData = songDoc.data() as Song
      
      // Eliminar archivos de B2 si existen
      if (songData.fileUrl || songData.stems) {
        try {
          const deleteResponse = await fetch('http://localhost:8000/api/delete-files', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              songId: songId,
              fileUrl: songData.fileUrl,
              stems: songData.stems
            })
          })
          
          if (deleteResponse.ok) {
            console.log('✅ Archivos de B2 eliminados correctamente')
          } else {
            console.warn('⚠️ Error eliminando archivos de B2, continuando con eliminación de Firestore')
          }
        } catch (b2Error) {
          console.warn('⚠️ Error eliminando archivos de B2:', b2Error)
          // Continuar con la eliminación de Firestore aunque falle B2
        }
      }
    }
    
    // Eliminar documento de Firestore
    await deleteDoc(doc(db, 'songs', songId))
    console.log('✅ Canción eliminada de Firestore')
  } catch (error) {
    console.error('❌ Error deleting song:', error)
    throw error
  }
}

// Limpiar stems antiguos (mantener solo vocals e instrumental) - TEMPORALMENTE DESHABILITADO
// export async function cleanOldStems(songId: string): Promise<void> {
//   try {
//     const songRef = doc(db, 'songs', songId)
//     const songDoc = await getDoc(songRef)
//     
//     if (songDoc.exists()) {
//       const songData = songDoc.data()
//       if (songData.stems) {
//         // Mantener solo vocals e instrumental
//         const cleanStems: any = {}
//         if (songData.stems.vocals) cleanStems.vocals = songData.stems.vocals
//         if (songData.stems.instrumental) cleanStems.instrumental = songData.stems.instrumental
//         
//         // Remover drums, bass, other si existen
//         await updateDoc(songRef, { stems: cleanStems })
//         console.log('✅ Cleaned old stems for song:', songId)
//       }
//     }
//   } catch (error) {
//     console.error('Error cleaning old stems:', error)
//     throw error
//   }
// }

// Escuchar cambios en tiempo real
export function subscribeToUserSongs(userId: string, callback: (songs: Song[]) => void) {
  console.log('🔍 Subscribing to user songs for:', userId)
  
  const q = query(
    collection(db, 'songs'),
    where('userId', '==', userId)
    // Removido orderBy temporalmente para evitar necesidad de índice
  )
  
  const unsubscribe = onSnapshot(q, 
    (querySnapshot) => {
      console.log('📊 Query snapshot received:', querySnapshot.size, 'docs')
      const songs: Song[] = []
      
      querySnapshot.forEach((doc) => {
        console.log('📄 Processing doc:', doc.id, doc.data())
        songs.push({
          id: doc.id,
          ...doc.data()
        } as Song)
      })
      
      // Ordenar por fecha de creación (más reciente primero)
      songs.sort((a, b) => {
        const dateA = new Date(a.uploadedAt || 0)
        const dateB = new Date(b.uploadedAt || 0)
        return dateB.getTime() - dateA.getTime()
      })
      
      console.log('🎵 Real-time update:', songs.length, 'songs')
      callback(songs)
    },
    (error) => {
      console.error('❌ Firestore subscription error:', error)
      callback([]) // Pasar array vacío en caso de error
    }
  )
  
  return unsubscribe
}
