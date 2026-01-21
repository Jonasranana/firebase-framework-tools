import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAllJSME9X_ECgmnUudhdapDhOfBsUYbz0",
  authDomain: "kachoto-7554c.firebaseapp.com",
  projectId: "kachoto-7554c",
  storageBucket: "kachoto-7554c.firebasestorage.app",
  messagingSenderId: "930806777855",
  appId: "1:930806777855:web:c73960da99f3853d3e49ca",
  measurementId: "G-KSYVWC6NSP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };