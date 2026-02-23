import { db, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, where, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let editandoId = null;
let clientesCache = [];

document.addEventListener('DOMContentLoaded', () => {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) return window.location.href = "../index.html";
    
    document.getElementById('nome-utilizador').innerText = localStorage.getItem('VESTIO_USER_NAME') || 'Admin';

    carregarClientes(empresaId);

    document.getElementById('btn-salvar-cliente').addEventListener('click', () => salvarCliente(empresaId));
    document.getElementById('btn-cancelar').addEventListener('click', limparFormulario);
    document.getElementById('busca-cliente').addEventListener('input', (e) => filtrarClientes(e.target.value));

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await signOut(auth);
        localStorage.clear();
        window.location.href = "../index.html";
    });
});

function calcularScore(vendasCliente) {
    let pontuacao = 100; 
    vendasCliente.forEach(venda => {
        if(venda.parcelas) {
            venda.parcelas.forEach(p => {
                if(p.pago) {
                    if (p.dataPagamento && p.vencimento && p.dataPagamento.toDate() <= p.vencimento.toDate()) {
                        pontuacao += 10;
                    } else {
                        pontuacao -= 15;
                    }
                }
            });
        }
    });
    if (pontuacao > 150) return { texto: "💎 ÓTIMO PAGADOR", cor: "#30D158" };
    if (pontuacao < 50) return { texto: "⚠️ RISCO ALTO", cor: "#FF453A" };
    return { texto: "😐 REGULAR", cor: "#FF9F0A" };
}

window.verCliente = async function(id) {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    
    // Buscar Dados do Cliente
    const clienteRef = doc(db, "empresas", empresaId, "clientes", id);
    const clienteSnap = await getDoc(clienteRef);
    if (!clienteSnap.exists()) return;
    const c = clienteSnap.data();

    // Buscar Histórico de Compras
    const q = query(collection(db, "empresas", empresaId, "vendas"), where("clienteId", "==", id));
    const snap = await getDocs(q);
    
    let vendasArr = [];
    snap.forEach(d => vendasArr.push(d.data()));
    const score = calcularScore(vendasArr);

    Swal.fire({
        title: 'Ficha do Cliente',
        html: `
            <div style="text-align:left; font-size:14px;">
                <p><strong>Nome:</strong> ${c.nome}</p>
                <p><strong>CPF:</strong> ${c.cpf || '-'}</p>
                <p><strong>Whats:</strong> ${c.telefone || '-'}</p>
                <p><strong>Limite:</strong> R$ ${(c.limiteCredito||0).toFixed(2)}</p>
                <hr style="border-color:#444">
                <h3 style="text-align:center; color:${score.cor}; margin:10px 0;">${score.texto}</h3>
                <p style="text-align:center; font-size:12px; color:#999;">${vendasArr.length} compras registradas</p>
            </div>
        `,
        background: '#1e293b', color: '#fff',
        confirmButtonText: 'Fechar'
    });
}

async function salvarCliente(empresaId) {
    const nome = document.getElementById('nome-cliente').value;
    const cpf = document.getElementById('cpf-cliente').value;
    const tel = document.getElementById('tel-cliente').value;
    const end = document.getElementById('end-cliente').value;
    const limite = parseFloat(document.getElementById('limite-credito').value) || 0;

    if (!nome) return Swal.fire('Erro', 'Nome é obrigatório', 'error');

    const btn = document.getElementById('btn-salvar-cliente');
    btn.disabled = true; btn.innerText = "Salvando...";

    try {
        const dados = { nome, cpf, telefone: tel, endereco: end, limiteCredito: limite };
        if (editandoId) {
            await updateDoc(doc(db, "empresas", empresaId, "clientes", editandoId), dados);
            Swal.fire('Sucesso', 'Cliente atualizado!', 'success');
        } else {
            await addDoc(collection(db, "empresas", empresaId, "clientes"), dados);
            Swal.fire('Sucesso', 'Cliente cadastrado!', 'success');
        }
        limparFormulario();
        carregarClientes(empresaId);
    } catch (error) {
        console.error(error);
        Swal.fire('Erro', 'Erro ao salvar.', 'error');
    } finally {
        btn.disabled = false; btn.innerText = editandoId ? "Atualizar Cliente" : "Salvar Cliente";
    }
}

async function carregarClientes(empresaId) {
    const tbody = document.getElementById('lista-clientes');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Carregando...</td></tr>';

    try {
        const q = query(collection(db, "empresas", empresaId, "clientes"), orderBy("nome"));
        const snap = await getDocs(q);
        
        tbody.innerHTML = '';
        if(snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Nenhum cliente cadastrado.</td></tr>';
            return;
        }

        clientesCache = []; 
        snap.forEach(docSnap => {
            const c = docSnap.data();
            clientesCache.push({id: docSnap.id, ...c});
            criarLinhaTabela(docSnap.id, c);
        });
    } catch (error) { console.error(error); }
}

function criarLinhaTabela(id, c) {
    const tbody = document.getElementById('lista-clientes');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><strong style="color:white">${c.nome}</strong><br><small style="color:#94a3b8">${c.cpf || ''}</small></td>
        <td>${c.telefone || '-'}</td>
        <td style="color:#64D2FF">R$ ${(c.limiteCredito || 0).toFixed(2)}</td>
        <td style="display:flex; gap:5px;">
            <button onclick="window.verCliente('${id}')" style="background:rgba(10,132,255,0.2); color:#64D2FF; padding:5px 10px; border-radius:4px; border:none; cursor:pointer;" title="Ver">👁️</button>
            <button onclick="window.location.href='crediario.html?id=${id}'" style="background:rgba(48, 209, 88, 0.2); color:#30D158; padding:5px 10px; border-radius:4px; border:none; cursor:pointer;" title="Crediário">💲</button>
            <button onclick="window.editarCliente('${id}')" style="background:rgba(255,159,10,0.2); color:#FF9F0A; padding:5px 10px; border-radius:4px; border:none; cursor:pointer;" title="Editar">✏️</button>
            <button onclick="window.excluirCliente('${id}')" style="background:rgba(255,69,58,0.2); color:#FF453A; padding:5px 10px; border-radius:4px; border:none; cursor:pointer;" title="Excluir">🗑️</button>
        </td>
    `;
    tbody.appendChild(tr);
}

function filtrarClientes(texto) {
    const tbody = document.getElementById('lista-clientes');
    tbody.innerHTML = '';
    const filtrados = clientesCache.filter(c => c.nome.toLowerCase().includes(texto.toLowerCase()) || (c.cpf && c.cpf.includes(texto)));
    if(filtrados.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Nenhum cliente encontrado.</td></tr>';
    else filtrados.forEach(c => criarLinhaTabela(c.id, c));
}

window.editarCliente = async function(id) {
    const cliente = clientesCache.find(c => c.id === id);
    if(cliente) {
        document.getElementById('nome-cliente').value = cliente.nome;
        document.getElementById('cpf-cliente').value = cliente.cpf || '';
        document.getElementById('tel-cliente').value = cliente.telefone || '';
        document.getElementById('end-cliente').value = cliente.endereco || '';
        document.getElementById('limite-credito').value = cliente.limiteCredito || 0;
        document.getElementById('cliente-id').value = id;
        
        editandoId = id;
        document.getElementById('btn-salvar-cliente').innerText = "Atualizar Cliente";
        document.getElementById('btn-cancelar').style.display = 'block';
        window.scrollTo({top:0, behavior:'smooth'});
    }
}

window.excluirCliente = async function(id) {
    const res = await Swal.fire({
        title: 'Excluir?',
        text: 'Não será possível reverter.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        background: '#1e293b', color: '#fff'
    });

    if(res.isConfirmed) {
        const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
        await deleteDoc(doc(db, "empresas", empresaId, "clientes", id));
        carregarClientes(empresaId);
        Swal.fire('Deletado!', '', 'success');
    }
}

function limparFormulario() {
    editandoId = null;
    document.getElementById('nome-cliente').value = '';
    document.getElementById('cpf-cliente').value = '';
    document.getElementById('tel-cliente').value = '';
    document.getElementById('end-cliente').value = '';
    document.getElementById('limite-credito').value = '';
    document.getElementById('cliente-id').value = '';
    document.getElementById('btn-salvar-cliente').innerText = "Salvar Cliente";
    document.getElementById('btn-cancelar').style.display = 'none';
}