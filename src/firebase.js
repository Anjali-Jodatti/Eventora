import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBblevAgO0j0tVOpPUdp06frM-kAT1cAIQ",
  authDomain: "eventora-8c15e.firebaseapp.com",
  projectId: "eventora-8c15e",
  storageBucket: "eventora-8c15e.firebasestorage.app",
  messagingSenderId: "863159791389",
  appId: "1:863159791389:web:e8eb9199f05f2a57c73bf4",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);