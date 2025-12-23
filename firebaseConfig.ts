import { initializeApp } from "firebase/app";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
const firebaseConfig = {
  apiKey: "AIzaSyCJ5ZbxyToHBaaGvBrqkdlGDe1Ok4WvSnc",
  authDomain: "infofix-app.firebaseapp.com",
  projectId: "infofix-app",
  storageBucket: "infofix-app.firebasestorage.app",
  messagingSenderId: "937096843222",
  appId: "1:937096843222:web:f34e953b9f437be0a29e77",
  measurementId: "G-LZ9S4ZVYX0",
};

// Logic to check if the user has actually configured Firebase
const isFirebaseConfigured = firebaseConfig.projectId !== "YOUR_PROJECT_ID";
{/*
let app;
let db = null;
let analytics = null;

if (isFirebaseConfigured) {
  try {
    // Suppress verbose connection errors in console (e.g. "Could not reach Cloud Firestore backend")
    setLogLevel("silent");

    app = initializeApp(firebaseConfig);
    db = getFirestore(app);

    // Analytics is safe to initialize but might not work in all restricted environments
    try {
      analytics = getAnalytics(app);
    } catch (e) {
      // Silently fail analytics if blocked
    }
    // console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
} else {
  console.warn(
    "Firebase configuration is missing or using placeholders. Falling back to Local Storage mode."
  );
}

export { db, isFirebaseConfigured, analytics };*/}

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

let analytics;
try {
  analytics = getAnalytics(app);
} catch {}

export { analytics,isFirebaseConfigured };
