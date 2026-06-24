import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { resolveFirestoreDatabaseId } from "../config/runtimeConfig";

const app = getApps().length === 0 
  ? initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "stellar-perigee-498907-c4",
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "stellar-perigee-498907-c4.firebasestorage.app"
    }) 
  : getApp();

// Bind to the provisioned custom Firestore database. Defaults to the AI Studio database id; a
// separate staging project can override it via FIRESTORE_DATABASE_ID (never silently `(default)`).
export const adminDb = getFirestore(app, resolveFirestoreDatabaseId());

// Optional evidence fields (e.g. originalText/extractedText/storageProvider) may be
// undefined; ignore them on write instead of throwing.
adminDb.settings({ ignoreUndefinedProperties: true });

export const adminAuth = getAuth(app);
export const adminStorage = getStorage(app);

