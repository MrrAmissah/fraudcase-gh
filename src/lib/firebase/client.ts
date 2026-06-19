/// <reference types="vite/client" />
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCTAEH25dT_H54-KdhfRCe-W1KE2VKbQqM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "stellar-perigee-498907-c4.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "stellar-perigee-498907-c4",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "stellar-perigee-498907-c4.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "583548147736",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:583548147736:web:43865ceae5cbbd3dd78b6d",
};

const databaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-36d6feb3-b3c2-4e2a-9c6b-46c7b67a02e9";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Correct multi-database Web SDK initialization syntax
export const db = getFirestore(app, databaseId);

export const auth = getAuth(app);
