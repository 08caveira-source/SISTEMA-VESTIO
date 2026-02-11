// Importa as funções principais do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// As suas credenciais do Sistema Vestio
const firebaseConfig = {
  apiKey: "AIzaSyA84eShsab8KAgnS4f9eEr9w0CZW4h6nr4",
  authDomain: "sistema-vestio.firebaseapp.com",
  projectId: "sistema-vestio",
  storageBucket: "sistema-vestio.firebasestorage.app",
  messagingSenderId: "905688551564",
  appId: "1:905688551564:web:f0166253952199b3d7eba9",
  measurementId: "G-SSQ74HY1Q5"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa e exporta os serviços que vamos usar
export const auth = getAuth(app);
export const db = getFirestore(app);