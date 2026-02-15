import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Proteção: Só roda o código quando a tela estiver carregada
document.addEventListener('DOMContentLoaded', () => {
    
    const formLogin = document.getElementById('form-login');
    const msgErro = document.getElementById('msg-erro');

    // Se por acaso não achar o formulário, para o script para não dar erro
    if (!formLogin) {
        console.error("Erro Crítico: Formulário 'form-login' não encontrado no HTML.");
        return;
    }

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const senha = document.getElementById('senha').value;
        const btn = document.querySelector('button[type="submit"]');

        btn.innerText = "Verificando...";
        btn.disabled = true;
        msgErro.style.display = 'none';

        try {
            // 1. Login no Firebase
            const userCredential = await signInWithEmailAndPassword(auth, email, senha);
            const uid = userCredential.user.uid;

            console.log("Login Auth OK. Verificando cargo...");

            // 2. Verifica Cargo no Banco de Dados
            const docRef = doc(db, "usuarios_registros", uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const dados = docSnap.data();
                localStorage.setItem('userRole', dados.role);
                localStorage.setItem('userName', dados.nome);
            } else {
                // Se não está na lista de funcionários, é o Admin/Dono
                localStorage.setItem('userRole', 'admin');
                localStorage.setItem('userName', 'Administrador');
            }

            // 3. Redireciona
            window.location.href = "pages/dashboard.html";

        } catch (error) {
            console.error("Erro Login:", error);
            
            // Mostra mensagem amigável
            msgErro.style.display = 'block';
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                msgErro.innerText = "E-mail ou senha incorretos.";
            } else if (error.code === 'auth/too-many-requests') {
                msgErro.innerText = "Muitas tentativas. Aguarde alguns instantes.";
            } else {
                msgErro.innerText = "Erro ao acessar: " + error.code;
            }
            
            btn.innerText = "Entrar";
            btn.disabled = false;
        }
    });
});