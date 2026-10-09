import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Kullanıcının sağladığı Firebase Web yapılandırması.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'PASTE_FIREBASE_API_KEY_HERE',
  authDomain: 'ambul-b4bd0.firebaseapp.com',
  databaseURL: 'https://ambul-b4bd0-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'ambul-b4bd0',
  storageBucket: 'ambul-b4bd0.firebasestorage.app',
  messagingSenderId: '924078389988',
  appId: '1:924078389988:web:758e67d2f953d690d34af1'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
