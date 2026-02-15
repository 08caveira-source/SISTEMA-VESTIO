// Importações Padrão
import { db, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// IMPORTANTE: Importamos 'initializeApp' e 'getAuth' de novo para criar a instância secundária
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth as getAuthSecondary, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// REPETIR A CONFIGURAÇÃO AQUI (Necessário para a instância secundária)
// Cole aqui EXATAMENTE a mesma const firebaseConfig que está no seu firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyA84eShsab8KAgnS4f9eEr9w0CZW4h6nr4",
  authDomain: "sistema-vestio.firebaseapp.com",
  projectId: "sistema-vestio",
  storageBucket: "sistema-vestio.firebasestorage.app",
  messagingSenderId: "905688551564",
  appId: "1:905688551564:web:f0166253952199b3d7eba9",
  measurementId: "G-SSQ74HY1Q5"
};

// =======================================================
// LÓGICA DA PÁGINA
// =======================================================

// Logout (Cabeçalho)
document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOut(auth);
    localStorage.clear();
    window.location.href = "../index.html";
});

// 1. CARREGAR LISTA DE USUÁRIOS
async function carregarUsuarios() {
    const tabela = document.getElementById('tabela-usuarios');
    tabela.innerHTML = '';

    try {
        const querySnapshot = await getDocs(collection(db, "usuarios_registros")); // Usamos uma coleção personalizada
        
        if (querySnapshot.empty) {
            tabela.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum usuário extra encontrado.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const id = docSnap.id;
            
            const badgeClass = user.role === 'admin' ? 'badge-admin' : 'badge-vendedor';
            const roleNome = user.role === 'admin' ? 'Administrador' : 'Vendedor';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${user.nome}</strong></td>
                <td>${user.email}</td>
                <td><span class="${badgeClass}">${roleNome}</span></td>
                <td>
                    <button onclick="removerAcesso('${id}', '${user.nome}')" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remover</button>
                </td>
            `;
            tabela.appendChild(tr);
        });

    } catch (error) {
        console.error("Erro ao listar:", error);
    }
}

// 2. CRIAR NOVO USUÁRIO (SEM DESLOGAR O ADMIN)
document.getElementById('form-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const role = document.getElementById('role').value;
    const btnSubmit = document.getElementById('btn-submit');

    btnSubmit.innerText = "Criando...";
    btnSubmit.disabled = true;

    try {
        // TRUQUE: Inicializa uma segunda app Firebase temporária
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuthSecondary(secondaryApp);

        // Cria o usuário na Authentication usando a App Secundária
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
        const novoUid = userCredential.user.uid;

        // Salva os dados extras no Firestore (na coleção 'usuarios_registros')
        // Usamos o UID como ID do documento para facilitar a busca depois
        await setDoc(doc(db, "usuarios_registros", novoUid), {
            nome: nome,
            email: email,
            role: role,
            criadoEm: new Date()
        });

        // Limpa a app secundária para não pesar a memória
        // (Nota: em versões novas do SDK Web modular, o delete() não é estritamente exposto, 
        // mas como é escopo local, apenas deixamos de usar).
        
        alert(`Usuário ${nome} criado com sucesso!`);
        document.getElementById('form-usuario').reset();
        carregarUsuarios();

    } catch (error) {
        console.error("Erro ao criar:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("Este e-mail já está sendo usado por outra pessoa.");
        } else {
            alert("Erro ao criar usuário: " + error.message);
        }
    } finally {
        btnSubmit.innerText = "Criar Usuário";
        btnSubmit.disabled = false;
    }
});

// 3. REMOVER USUÁRIO
// Nota: O Client SDK não permite deletar o Auth de outra pessoa por segurança.
// Aqui vamos apenas deletar o registro do banco de dados. 
// Para bloquear o acesso real, o Login deve verificar se o usuário existe nessa coleção.
window.removerAcesso = async function(id, nome) {
    if (confirm(`Tem certeza que deseja remover o acesso de ${nome}?`)) {
        try {
            await deleteDoc(doc(db, "usuarios_registros", id));
            alert("Usuário removido da lista de acesso.");
            carregarUsuarios();
        } catch (error) {
            console.error("Erro ao deletar:", error);
            alert("Erro ao remover.");
        }
    }
};

document.addEventListener('DOMContentLoaded', carregarUsuarios);