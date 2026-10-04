import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDXnRBis_CgEnNVKMQKdKMl1CzbYibsUHQ",
  authDomain: "devflowext.firebaseapp.com",
  projectId: "devflowext",
  storageBucket: "devflowext.firebasestorage.app",
  messagingSenderId: "931470206843",
  appId: "1:931470206843:web:8a7237674166dc2d847fde"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
