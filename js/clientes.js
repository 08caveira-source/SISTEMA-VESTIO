import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Botão de voltar
document.getElementById('btn-voltar').addEventListener('click', () => { window.location.href = 'dashboard.html'; });

// Variáveis Globais
let listaClientesMemoria = [];
let clienteEmEdicaoId = null;

const formCliente = document.getElementById('form-cliente');
const tituloForm = document.getElementById('titulo-form');
const btnSubmit = document.getElementById('btn-submit-cliente');
const btnCancelar = document.getElementById('btn-cancelar-edicao');
const tabelaClientes = document.getElementById('tabela-clientes');
const inputBusca = document.getElementById('busca-cliente');

// ==========================================
// SALVAR OU ATUALIZAR CLIENTE
// ==========================================
formCliente.addEventListener('submit', async (e) => {
    e.preventDefault();

    const dadosCliente = {
        nome: document.getElementById('nomeCliente').value,
        cpf: document.getElementById('cpfCliente').value,
        dataNascimento: document.getElementById('dataNascimento').value,
        telefone: document.getElementById('telefoneCliente').value,
        endereco: document.getElementById('enderecoCliente').value,
        limiteCredito: parseFloat(document.getElementById('limiteCredito').value) || 0
    };

    btnSubmit.innerText = "Salvando...";
    btnSubmit.disabled = true;

    try {
        if (clienteEmEdicaoId) {
            // Atualizar existente
            const clienteRef = doc(db, "clientes", clienteEmEdicaoId);
            await updateDoc(clienteRef, dadosCliente);
            alert("Cadastro atualizado com sucesso!");
            cancelarEdicao();
        } else {
            // Criar novo
            dadosCliente.dataCadastro = serverTimestamp();
            await addDoc(collection(db, "clientes"), dadosCliente);
            alert("Cliente cadastrado com sucesso!");
            formCliente.reset();
        }
        
        carregarClientes(); // Atualiza a tabela

    } catch (error) {
        console.error("Erro ao salvar cliente:", error);
        alert("Erro ao conectar com o banco de dados.");
    } finally {
        if (!clienteEmEdicaoId) btnSubmit.innerText = "Salvar Cliente";
        btnSubmit.disabled = false;
    }
});

// ==========================================
// CARREGAR E RENDERIZAR CLIENTES
// ==========================================
async function carregarClientes() {
    tabelaClientes.innerHTML = '<tr><td colspan="5" style="text-align: center;">Carregando clientes...</td></tr>';
    listaClientesMemoria = [];

    try {
        const querySnapshot = await getDocs(collection(db, "clientes"));
        
        querySnapshot.forEach((documento) => {
            const cliente = documento.data();
            cliente.id = documento.id;
            listaClientesMemoria.push(cliente);
        });

        // Ordena por nome em ordem alfabética
        listaClientesMemoria.sort((a, b) => a.nome.localeCompare(b.nome));

        renderizarTabela(listaClientesMemoria);

    } catch (error) {
        console.error("Erro ao carregar:", error);
        tabelaClientes.innerHTML = '<tr><td colspan="5" style="color: red; text-align: center;">Erro ao carregar base de clientes.</td></tr>';
    }
}

function renderizarTabela(clientes) {
    tabelaClientes.innerHTML = '';

    if (clientes.length === 0) {
        tabelaClientes.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #7f8c8d;">Nenhum cliente encontrado.</td></tr>';
        return;
    }

    clientes.forEach((cliente) => {
        const limiteF = cliente.limiteCredito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // Define uma cor para o limite (Vermelho se for 0, Verde se tiver crédito)
        const corLimite = cliente.limiteCredito > 0 ? '#27ae60' : '#e74c3c';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${cliente.nome}</strong></td>
            <td>${cliente.cpf}</td>
            <td>${cliente.telefone}</td>
            <td style="color: ${corLimite}; font-weight: bold;">${limiteF}</td>
            <td>
                <button class="btn-acao btn-editar" onclick="editarCliente('${cliente.id}')">Editar</button>
                <button class="btn-acao btn-excluir" onclick="deletarCliente('${cliente.id}')">Excluir</button>
                <button class="btn-acao btn-crediario" onclick="abrirPerfilCrediario('${cliente.id}')">Ver Crediário</button>
            </td>
        `;
        tabelaClientes.appendChild(tr);
    });
}

// ==========================================
// BUSCA INTELIGENTE
// ==========================================
inputBusca.addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    
    // Filtra pelo Nome ou CPF
    const resultados = listaClientesMemoria.filter(c => 
        c.nome.toLowerCase().includes(termo) || 
        c.cpf.includes(termo)
    );
    
    renderizarTabela(resultados);
});

// ==========================================
// FUNÇÕES DE EDIÇÃO E EXCLUSÃO
// ==========================================
window.editarCliente = function(id) {
    const cliente = listaClientesMemoria.find(c => c.id === id);
    if (!cliente) return;

    document.getElementById('nomeCliente').value = cliente.nome;
    document.getElementById('cpfCliente').value = cliente.cpf;
    document.getElementById('dataNascimento').value = cliente.dataNascimento;
    document.getElementById('telefoneCliente').value = cliente.telefone;
    document.getElementById('enderecoCliente').value = cliente.endereco;
    document.getElementById('limiteCredito').value = cliente.limiteCredito;

    clienteEmEdicaoId = id;
    tituloForm.innerText = "Editando Cadastro";
    btnSubmit.innerText = "Atualizar Cliente";
    btnSubmit.style.backgroundColor = "#f39c12";
    btnCancelar.style.display = "block";
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function cancelarEdicao() {
    formCliente.reset();
    clienteEmEdicaoId = null;
    tituloForm.innerText = "Cadastrar Novo Cliente";
    btnSubmit.innerText = "Salvar Cliente";
    btnSubmit.style.backgroundColor = "#27ae60";
    btnCancelar.style.display = "none";
}

btnCancelar.addEventListener('click', cancelarEdicao);

window.deletarCliente = async function(id) {
    const role = localStorage.getItem('userRole');

    if (role !== 'admin') {
        const senhaMaster = prompt("AÇÃO RESTRITA: Digite a senha master para excluir um cliente (Senha atual: 123456):");
        if (senhaMaster !== "123456") {
            alert("Senha incorreta. Ação cancelada.");
            return;
        }
    } else {
        const confirmar = confirm("Tem certeza que deseja apagar este cliente permanentemente do sistema?");
        if (!confirmar) return;
    }

    try {
        await deleteDoc(doc(db, "clientes", id));
        alert("Cliente removido com sucesso.");
        carregarClientes();
    } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir o cliente.");
    }
};

window.abrirPerfilCrediario = function(id) {
    window.location.href = `crediario.html?id=${id}`;
};

// Inicia carregando a tabela
document.addEventListener('DOMContentLoaded', carregarClientes);