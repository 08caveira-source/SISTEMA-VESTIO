import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, serverTimestamp, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Botão de voltar
document.getElementById('btn-voltar').addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

// Variáveis Globais de Controle
let gradeTemporaria = [];
let produtoEmEdicaoId = null; // Guarda o ID do produto se estivermos editando
let listaProdutosMemoria = {}; // Guarda os dados carregados para facilitar a edição

const formProduto = document.getElementById('form-produto');
const btnSubmit = document.querySelector('#form-produto button[type="submit"]');
const btnAddVariante = document.getElementById('btn-add-variante');
const listaVariantes = document.getElementById('lista-variantes');

// ==========================================
// CONTROLE DA GRADE (Tamanhos e Cores)
// ==========================================
btnAddVariante.addEventListener('click', () => {
    const tamanho = document.getElementById('var-tamanho').value;
    const cor = document.getElementById('var-cor').value.trim() || 'Padrão';
    const qtd = parseInt(document.getElementById('var-qtd').value);

    if (qtd > 0) {
        gradeTemporaria.push({ tamanho, cor, qtd });
        atualizarListaVariantes();
        document.getElementById('var-cor').value = '';
        document.getElementById('var-qtd').value = '1';
    } else {
        alert("A quantidade deve ser maior que zero.");
    }
});

function atualizarListaVariantes() {
    listaVariantes.innerHTML = '';
    gradeTemporaria.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span><b>${item.tamanho}</b> - ${item.cor} (${item.qtd} un.)</span>
            <button type="button" onclick="removerVariante(${index})" style="background: red; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer;">X</button>
        `;
        listaVariantes.appendChild(li);
    });
}

window.removerVariante = function(index) {
    gradeTemporaria.splice(index, 1);
    atualizarListaVariantes();
};

// ==========================================
// SALVAR OU ATUALIZAR PRODUTO NO FIREBASE
// ==========================================
formProduto.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (gradeTemporaria.length === 0) {
        alert("Adicione pelo menos um tamanho/cor na grade antes de salvar!");
        return;
    }

    const estoqueTotal = gradeTemporaria.reduce((total, item) => total + item.qtd, 0);
    
    // Monta o objeto com os dados da tela
    const dadosProduto = {
        nome: document.getElementById('nome').value,
        categoria: document.getElementById('categoria').value,
        marca: document.getElementById('marca').value,
        precoCusto: parseFloat(document.getElementById('precoCusto').value),
        precoVenda: parseFloat(document.getElementById('precoVenda').value),
        grade: gradeTemporaria,
        estoqueTotal: estoqueTotal
    };

    try {
        if (produtoEmEdicaoId) {
            // Se tem ID, estamos ATUALIZANDO
            const produtoRef = doc(db, "produtos", produtoEmEdicaoId);
            await updateDoc(produtoRef, dadosProduto);
            alert("Produto atualizado com sucesso!");
            
            // Restaura o visual do botão
            produtoEmEdicaoId = null;
            btnSubmit.innerText = "Salvar Produto no Estoque";
            btnSubmit.style.backgroundColor = "#27ae60";

        } else {
            // Se NÃO tem ID, estamos CRIANDO
            dadosProduto.dataEntrada = serverTimestamp();
            dadosProduto.ativo = true;
            await addDoc(collection(db, "produtos"), dadosProduto);
            alert("Produto cadastrado com sucesso!");
        }
        
        // Limpa tudo e recarrega a tabela
        formProduto.reset();
        gradeTemporaria = [];
        atualizarListaVariantes();
        carregarProdutos();

    } catch (error) {
        console.error("Erro ao salvar/atualizar:", error);
        alert("Erro de comunicação com o banco de dados.");
    }
});

// ==========================================
// CARREGAR, EDITAR E EXCLUIR PRODUTOS
// ==========================================
async function carregarProdutos() {
    const tabela = document.getElementById('tabela-produtos');
    tabela.innerHTML = '<tr><td colspan="5">Carregando estoque...</td></tr>';
    listaProdutosMemoria = {}; // Limpa a memória

    try {
        const querySnapshot = await getDocs(collection(db, "produtos"));
        tabela.innerHTML = '';

        if (querySnapshot.empty) {
            tabela.innerHTML = '<tr><td colspan="5">Nenhum produto cadastrado ainda.</td></tr>';
            return;
        }

        querySnapshot.forEach((documento) => {
            const id = documento.id;
            const produto = documento.data();
            listaProdutosMemoria[id] = produto; // Salva na memória usando o ID como chave
            
            const precoFormatado = produto.precoVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${produto.nome}</strong><br><small style="color: #7f8c8d;">${produto.marca}</small></td>
                <td>${produto.categoria}</td>
                <td>${precoFormatado}</td>
                <td>${produto.estoqueTotal} un.</td>
                <td>
                    <button onclick="editarProduto('${id}')" style="background: #f39c12; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Editar</button>
                    <button onclick="deletarProduto('${id}')" style="background: #e74c3c; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">Excluir</button>
                </td>
            `;
            tabela.appendChild(tr);
        });
    } catch (error) {
        console.error("Erro ao carregar:", error);
        tabela.innerHTML = '<tr><td colspan="5" style="color: red;">Erro ao carregar estoque.</td></tr>';
    }
}

// Função de Editar
window.editarProduto = function(id) {
    const produto = listaProdutosMemoria[id];
    if (!produto) return;

    // Preenche o formulário com os dados
    document.getElementById('nome').value = produto.nome;
    document.getElementById('categoria').value = produto.categoria;
    document.getElementById('marca').value = produto.marca;
    document.getElementById('precoCusto').value = produto.precoCusto;
    document.getElementById('precoVenda').value = produto.precoVenda;

    // Carrega a grade
    gradeTemporaria = [...produto.grade];
    atualizarListaVariantes();

    // Muda o estado do formulário para "Edição"
    produtoEmEdicaoId = id;
    btnSubmit.innerText = "Atualizar Produto";
    btnSubmit.style.backgroundColor = "#f39c12"; // Fica laranja para chamar atenção
    
    // Rola a tela para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Função de Excluir com Trava de Segurança
window.deletarProduto = async function(id) {
    const role = localStorage.getItem('userRole');

    // Se NÃO for admin, exige a senha master (Senha de teste: 123456)
    if (role !== 'admin') {
        const senhaMaster = prompt("AÇÃO RESTRITA: Digite a senha master para excluir um produto (Senha atual: 123456):");
        if (senhaMaster !== "123456") {
            alert("Senha incorreta. Ação cancelada.");
            return;
        }
    } else {
        // Se for admin, só pede a confirmação padrão
        const confirmar = confirm("Tem certeza que deseja excluir permanentemente este produto e todo o seu estoque?");
        if (!confirmar) return;
    }

    try {
        await deleteDoc(doc(db, "produtos", id));
        alert("Produto removido do estoque.");
        carregarProdutos(); // Atualiza a tabela na hora
    } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir o produto. Verifique as permissões do Firebase.");
    }
};

// Inicia a tabela
document.addEventListener('DOMContentLoaded', carregarProdutos);