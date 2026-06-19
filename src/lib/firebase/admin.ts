import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

const app = getApps().length === 0 
  ? initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "stellar-perigee-498907-c4",
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "stellar-perigee-498907-c4.firebasestorage.app"
    }) 
  : getApp();

// Bind specifically to our provisioned custom Firestore database ID
export const adminDb = getFirestore(app, "ai-studio-36d6feb3-b3c2-4e2a-9c6b-46c7b67a02e9");

// Optional evidence fields (e.g. originalText/extractedText/storageProvider) may be
// undefined; ignore them on write instead of throwing.
adminDb.settings({ ignoreUndefinedProperties: true });

export const adminAuth = getAuth(app);
export const adminStorage = getStorage(app);

