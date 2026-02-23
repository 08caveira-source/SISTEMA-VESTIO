import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, doc, deleteDoc, query 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ATENÇÃO: Criar usuário secundário requer um segundo App Firebase ou Cloud Functions 
// para não deslogar o admin atual. 
// Para simplificar neste protótipo, vamos apenas salvar no Banco de Dados
// para simular a gestão, já que o Firebase Client-Side não permite criar outro user sem deslogar.

document.addEventListener('DOMContentLoaded', () => {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) return window.location.href = "../index.html";

    document.getElementById('nome-utilizador').innerText = localStorage.getItem('VESTIO_USER_NAME') || 'Admin';

    carregarUsuarios(empresaId);

    // 1. Botão Criar
    const btnCriar = document.getElementById('btn-criar-user');
    if(btnCriar) {
        btnCriar.addEventListener('click', () => criarUsuarioSimulado(empresaId));
    }

    // 2. Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await signOut(auth);
        localStorage.clear();
        window.location.href = "../index.html";
    });
});

async function criarUsuarioSimulado(empresaId) {
    const email = document.getElementById('email-user').value;
    const senha = document.getElementById('senha-user').value; // Apenas didático
    const role = document.getElementById('role-user').value;

    if(!email || !senha) return alert("Preencha e-mail e senha.");

    try {
        // Salvamos apenas o registro no banco para visualização
        await addDoc(collection(db, "empresas", empresaId, "usuarios"), {
            email: email,
            role: role,
            status: 'ativo',
            dataCriacao: new Date()
        });
        
        alert("Usuário registrado no sistema com sucesso!");
        document.getElementById('email-user').value = '';
        document.getElementById('senha-user').value = '';
        carregarUsuarios(empresaId);

    } catch (error) {
        console.error(error);
        alert("Erro ao registrar usuário.");
    }
}

async function carregarUsuarios(empresaId) {
    const tbody = document.getElementById('lista-usuarios');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Carregando...</td></tr>';

    try {
        const q = query(collection(db, "empresas", empresaId, "usuarios"));
        const snap = await getDocs(q);

        tbody.innerHTML = '';
        if(snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Nenhum usuário extra.</td></tr>';
            return;
        }

        snap.forEach(docSnap => {
            const u = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.email}</td>
                <td>${u.role.toUpperCase()}</td>
                <td><span class="badge" style="background:rgba(48, 209, 88, 0.2); color:#30D158">ATIVO</span></td>
                <td>
                    <button onclick="window.excluirUsuario('${docSnap.id}')" style="background:none; color:#FF453A; padding:0; height:auto; min-height:0;">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Erro ao carregar.</td></tr>';
    }
}

window.excluirUsuario = async function(id) {
    if(confirm("Remover este usuário?")) {
        const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
        await deleteDoc(doc(db, "empresas", empresaId, "usuarios", id));
        carregarUsuarios(empresaId);
    }
}