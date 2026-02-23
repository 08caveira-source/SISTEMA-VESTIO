import { db, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const SUPER_ADMIN_EMAIL = "08caveira@gmail.com"; 

document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(() => {
        if (!auth.currentUser) window.location.href = "index.html";
    }, 2000);

    carregarEmpresas();

    document.getElementById('btn-criar-empresa').addEventListener('click', criarEmpresa);
    document.getElementById('btn-sair').addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = "index.html";
    });
});

async function criarEmpresa() {
    const nome = document.getElementById('nome-empresa').value;
    const email = document.getElementById('email-dono').value;
    const senha = document.getElementById('senha-dono').value;
    const validade = document.getElementById('validade-empresa').value;

    if (!nome || !email || !senha || !validade) return Swal.fire('Erro', 'Preencha tudo.', 'error');

    const btn = document.getElementById('btn-criar-empresa');
    btn.disabled = true; btn.innerText = "Criando...";

    try {
        try {
            await createUserWithEmailAndPassword(auth, email, senha);
        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                if(!confirm("E-mail já existe. Vincular empresa a este usuário existente?")) {
                    btn.disabled = false; btn.innerText = "CRIAR (+)";
                    return;
                }
            } else { throw e; }
        }

        await addDoc(collection(db, "empresas"), {
            nomeFantasia: nome,
            cnpj: document.getElementById('cnpj-empresa').value,
            emailDono: email,
            dono: document.getElementById('nome-dono').value,
            licencaValidade: Timestamp.fromDate(new Date(validade + "T23:59:59")),
            status: 'ativo',
            dataCriacao: Timestamp.now()
        });

        Swal.fire('Sucesso', 'Empresa criada! (Se criou usuário novo, você foi deslogado)', 'success')
        .then(() => window.location.href = "index.html");

    } catch (error) {
        console.error(error);
        Swal.fire('Erro', error.message, 'error');
        btn.disabled = false; btn.innerText = "CRIAR (+)";
    }
}

async function carregarEmpresas() {
    const tbody = document.getElementById('lista-empresas');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Carregando...</td></tr>';

    try {
        const snap = await getDocs(collection(db, "empresas"));
        tbody.innerHTML = '';

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Nenhuma empresa.</td></tr>';
            return;
        }

        snap.forEach(docSnap => {
            const emp = docSnap.data();
            const vencimento = emp.licencaValidade ? new Date(emp.licencaValidade.toDate()).toLocaleDateString('pt-BR') : '-';
            const isBloq = emp.status === 'bloqueado';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <b style="color:white">${emp.nomeFantasia}</b><br>
                    <small style="color:#94a3b8">${emp.emailDono}</small>
                </td>
                <td>${vencimento}</td>
                <td>
                    <span class="badge" style="background:${isBloq ? '#c0392b' : '#27ae60'}">${isBloq ? 'BLOQUEADO' : 'ATIVO'}</span>
                </td>
                <td style="display:flex;">
                    <button onclick="window.verDados('${docSnap.id}')" class="btn-mini btn-ver" title="Ver Detalhes">👁️</button>
                    <button onclick="window.renovarLicenca('${docSnap.id}')" class="btn-mini btn-renovar" title="Adicionar 30 Dias">1 CRÉDITO<br>+30 DIAS</button>
                    <button onclick="window.toggleBloqueio('${docSnap.id}', '${emp.status}')" class="btn-mini ${isBloq ? 'btn-on' : 'btn-bloq'}" title="${isBloq ? 'Desbloquear' : 'Bloquear'}">${isBloq ? '🔓' : '🔒'}</button>
                    <button onclick="window.resetSenha('${emp.emailDono}')" class="btn-mini btn-senha" title="Enviar Email Redefinição">🔑</button>
                    <button onclick="window.excluirEmpresa('${docSnap.id}')" class="btn-mini btn-del" title="Excluir Definitivamente">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// 0. RESTAURADO: RENOVAR LICENÇA
window.renovarLicenca = async (id) => {
    const { isConfirmed } = await Swal.fire({
        title: 'Renovar Licença?',
        text: "Adicionar 30 dias de crédito para esta empresa?",
        icon: 'question',
        showCancelButton: true,
        background: '#1e293b', color: '#fff',
        confirmButtonText: 'Sim, adicionar'
    });

    if(isConfirmed) {
        try {
            const empRef = doc(db, "empresas", id);
            const snap = await getDoc(empRef);
            let novaData = new Date();
            
            // Se já tem validade e ainda não venceu, soma a partir do vencimento
            if(snap.exists() && snap.data().licencaValidade) {
                const valAtual = snap.data().licencaValidade.toDate();
                if(valAtual > novaData) novaData = valAtual; 
            }
            
            novaData.setDate(novaData.getDate() + 30);
            
            await updateDoc(empRef, { licencaValidade: Timestamp.fromDate(novaData) });
            Swal.fire('Renovado!', '30 dias adicionados com sucesso.', 'success');
            carregarEmpresas();
        } catch(e) {
            Swal.fire('Erro', 'Falha ao renovar.', 'error');
        }
    }
};

// 1. VER DADOS
window.verDados = async (id) => {
    const snap = await getDoc(doc(db, "empresas", id));
    if(snap.exists()) {
        const d = snap.data();
        const html = `
            <p><b>ID:</b> ${id}</p>
            <p><b>Empresa:</b> ${d.nomeFantasia}</p>
            <p><b>CNPJ:</b> ${d.cnpj || '-'}</p>
            <p><b>Dono:</b> ${d.dono}</p>
            <p><b>E-mail:</b> ${d.emailDono}</p>
            <p><b>Criado em:</b> ${new Date(d.dataCriacao.toDate()).toLocaleDateString()}</p>
        `;
        document.getElementById('conteudo-detalhes').innerHTML = html;
        document.getElementById('modal-detalhes').style.display = 'flex';
    }
}

// 2. BLOQUEAR / DESBLOQUEAR
window.toggleBloqueio = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'bloqueado' ? 'ativo' : 'bloqueado';
    const acao = novoStatus === 'bloqueado' ? 'BLOQUEAR' : 'DESBLOQUEAR';
    
    if(confirm(`Tem certeza que deseja ${acao} esta empresa?`)) {
        await updateDoc(doc(db, "empresas", id), { status: novoStatus });
        carregarEmpresas();
        Swal.fire('Atualizado', `Empresa ${novoStatus}!`, 'success');
    }
}

// 3. RESET SENHA (Envia E-mail)
window.resetSenha = async (email) => {
    if(confirm(`Enviar e-mail de redefinição de senha para ${email}?`)) {
        try {
            await sendPasswordResetEmail(auth, email);
            Swal.fire('Enviado', 'O usuário receberá um link no e-mail.', 'success');
        } catch(e) {
            Swal.fire('Erro', e.message, 'error');
        }
    }
}

// 4. EXCLUIR TOTAL (Limpa subcoleções)
window.excluirEmpresa = async (id) => {
    const { isConfirmed } = await Swal.fire({
        title: 'DESTRUIR EMPRESA?',
        text: "Isso apagará TODOS os dados (Vendas, Clientes, Produtos) desta empresa permanentemente. Não há volta.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        background: '#1e293b', color: '#fff',
        confirmButtonText: 'SIM, DESTRUIR TUDO'
    });

    if(isConfirmed) {
        Swal.fire({title: 'Apagando dados...', background: '#1e293b', color: '#fff', didOpen:()=>Swal.showLoading()});
        
        try {
            const colecoes = ["vendas", "produtos", "clientes", "usuarios", "parcelas", "configuracoes"];
            
            for (const colName of colecoes) {
                const subColRef = collection(db, "empresas", id, colName);
                const snapshot = await getDocs(subColRef);
                
                const batch = writeBatch(db);
                let contador = 0;
                
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                    contador++;
                });
                
                if (contador > 0) await batch.commit();
            }

            await deleteDoc(doc(db, "empresas", id));
            
            Swal.fire('Excluído', 'Empresa removida do sistema.', 'success');
            carregarEmpresas();

        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao excluir dados: ' + e.message, 'error');
        }
    }
}