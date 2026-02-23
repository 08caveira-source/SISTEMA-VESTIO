import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const SUPER_ADMIN_EMAIL = "08caveira@gmail.com"; 

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const emailElement = document.getElementById('email');
    const senhaElement = document.getElementById('senha');

    if (!emailElement || !senhaElement) return;

    const email = emailElement.value.trim();
    const senha = senhaElement.value;
    
    const btn = document.getElementById('btn-login');
    const msgErro = document.getElementById('msg-erro');

    btn.disabled = true;
    btn.innerText = "Verificando...";
    msgErro.style.display = 'none';

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        if (user.email === SUPER_ADMIN_EMAIL) {
            window.location.href = "admin-saas.html";
        } else {
            await rotearParaLoja(user.email);
        }

    } catch (error) {
        console.error("Erro Login:", error);
        let msg = "Erro ao acessar.";
        if(error.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
        if(error.message === "EMPRESA_BLOQUEADA") msg = "🚫 Acesso Bloqueado. Contate o suporte.";
        
        msgErro.innerText = msg;
        msgErro.style.display = 'block';
        btn.disabled = false;
        btn.innerText = "ENTRAR NO SISTEMA";
        if(error.message === "EMPRESA_BLOQUEADA") await auth.signOut();
    }
});

async function rotearParaLoja(email) {
    const q = query(collection(db, "empresas"), where("emailDono", "==", email));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        const empresaDoc = snapshot.docs[0];
        const dados = empresaDoc.data();

        // --- VERIFICAÇÃO DE BLOQUEIO ---
        if (dados.status === 'bloqueado') {
            throw new Error("EMPRESA_BLOQUEADA");
        }

        localStorage.setItem('VESTIO_EMPRESA_ID', empresaDoc.id);
        localStorage.setItem('VESTIO_USER_NAME', dados.nomeFantasia || 'Admin');
        
        window.location.href = "pages/dashboard.html";
    } else {
        // Se não achou como dono, verifica se é funcionário (futuro)
        throw new Error("Usuário não vinculado.");
    }
}