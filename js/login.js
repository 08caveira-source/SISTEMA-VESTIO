// Importações do Firebase Auth e Firestore
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginForm = document.getElementById('loginForm');
const mensagemErro = document.getElementById('mensagem-erro');
const btnLogin = document.getElementById('btn-login');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    
    btnLogin.innerText = "Autenticando...";
    btnLogin.disabled = true;
    mensagemErro.style.display = 'none';

    try {
        // 1. Faz o login no Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // 2. Busca o nível de acesso (role) no Firestore
        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const dadosUsuario = userDocSnap.data();
            const nivelAcesso = dadosUsuario.nivel; // 'admin' ou 'vendedor'

            // Salva o nível no LocalStorage para uso rápido nas outras telas
            localStorage.setItem('userRole', nivelAcesso);
            localStorage.setItem('userName', dadosUsuario.nome);

            // 3. Redireciona para o Painel Principal
            window.location.href = "pages/dashboard.html";
        } else {
            throw new Error("Usuário autenticado, mas sem cadastro na base de dados de funcionários.");
        }

    } catch (error) {
        console.error("Erro no login:", error);
        mensagemErro.innerText = "Erro: E-mail ou senha incorretos, ou usuário não autorizado.";
        mensagemErro.style.display = 'block';
        btnLogin.innerText = "Entrar";
        btnLogin.disabled = false;
    }
});