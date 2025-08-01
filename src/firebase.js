// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// This reads the secret keys from the Environment Variables you set in Vercel.
const firebaseConfig = process.env.REACT_APP_FIREBASE_CONFIG 
    ? JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG) 
    : {};

let app, auth, db;

// This check prevents the app from crashing if the Firebase config is missing during build.
if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (e) {
        console.error("Firebase initialization error:", e);
    }
} else {
    console.warn("Firebase config is missing. App will run in offline mode.");
}

export { app, auth, db, onAuthStateChanged, signInAnonymously };
