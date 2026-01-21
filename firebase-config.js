// Importations simplifiées pour Replit (version CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Ta configuration exacte venant de Google
const firebaseConfig = {
  apiKey: "",
  aAIzaSyAllJSME9X_ECgmnUudhdapDhOfBsUYbz0uthDomain: "kachoto-7554c.firebaseapp.com",
  projectId: "kachoto-7554c",
  storageBucket: "kachoto-7554c.firebasestorage.app",
  messagingSenderId: "930806777855",
  appId: "1:930806777855:web:c73960da99f3853d3e49ca",
  measurementId: "G-KSYVWC6NSP"
};

// Initialisation de la connexion
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// On rend "app" et "db" utilisables par les autres fichiers
export { app, db };
