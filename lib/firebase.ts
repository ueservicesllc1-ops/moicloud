import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyD3Bbk9WaUHYCMWs5Yc4Gbd6MUY4KMR8lg",
  authDomain: "moises-17d22.firebaseapp.com",
  projectId: "moises-17d22",
  storageBucket: "moises-17d22.firebasestorage.app",
  messagingSenderId: "987812763731",
  appId: "1:987812763731:web:2096d74998f255f2038ea6"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Initialize Firestore
export const db = getFirestore(app)

export default app
