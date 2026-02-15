import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, serverTimestamp, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.getElementById('btn-voltar').addEventListener('click', () => { window.location.href = 'dashboard.html'; });

// VARIÁVEIS GLOBAIS
let gradeTemporaria = [];
let produtoEmEdicaoId = null;
let listaCompletaProdutos = []; // Guarda tudo que veio do banco
let listaFiltrada = []; // Guarda o resultado da busca
let paginaAtual = 1;
const itensPorPagina = 10; // QUANTIDADE POR PÁGINA

const formProduto = document.getElementById('form-produto');
const btnSubmit = document.querySelector('#form-produto button[type="submit"]');
const btnAddVariante = document.getElementById('btn-add-variante');
const listaVariantes = document.getElementById('lista-variantes');
const inputBusca = document.getElementById('filtro-busca');

// ==========================================
// PAGINAÇÃO E RENDERIZAÇÃO
// ==========================================
function renderizarTabela() {
    const tabela = document.getElementById('tabela-produtos');
    tabela.innerHTML = '';

    // Calcula índices
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensPagina = listaFiltrada.slice(inicio, fim); // Pega só o pedaço da página
    
    const totalPaginas = Math.ceil(listaFiltrada.length / itensPorPagina) || 1;
    document.getElementById('info-paginacao').innerText = `Página ${paginaAtual} de ${totalPaginas}`;

    if (itensPagina.length === 0) {
        tabela.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Nenhum produto encontrado.</td></tr>';
        return;
    }

    const role = localStorage.getItem('userRole');

    itensPagina.forEach((produto) => {
        const precoFormatado = produto.precoVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // Imagem
        const imgHtml = produto.imagemUrl 
            ? `<img src="${produto.imagemUrl}" class="foto-tabela" style="width:50px; height:50px; object-fit:cover; border-radius:4px;" alt="${produto.nome}">`
            : `<div style="width:50px; height:50px; background:#eee; display:flex; align-items:center; justify-content:center; color:#ccc; border-radius:4px; font-size:10px;">Sem Foto</div>`;

        // Botões
        let botoesAcao = `<button onclick="visualizarProduto('${produto.id}')" style="background: #3498db; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Ver</button>`;
        if (role === 'admin') {
            botoesAcao += `
                <button onclick="editarProduto('${produto.id}')" style="background: #f39c12; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Editar</button>
                <button onclick="deletarProduto('${produto.id}')" style="background: #e74c3c; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">Excluir</button>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${imgHtml}</td>
            <td><strong>${produto.nome}</strong><br><small style="color:#7f8c8d;">${produto.marca}</small></td>
            <td>${produto.categoria}</td>
            <td>${precoFormatado}</td>
            <td>${produto.estoqueTotal} un.</td>
            <td>${botoesAcao}</td>
        `;
        tabela.appendChild(tr);
    });

    // Controla botões
    document.getElementById('btn-ant').disabled = paginaAtual === 1;
    document.getElementById('btn-prox').disabled = paginaAtual === totalPaginas;
    document.getElementById('btn-ant').style.opacity = paginaAtual === 1 ? "0.5" : "1";
    document.getElementById('btn-prox').style.opacity = paginaAtual === totalPaginas ? "0.5" : "1";
}

// Eventos de Paginação
document.getElementById('btn-ant').addEventListener('click', () => {
    if (paginaAtual > 1) { paginaAtual--; renderizarTabela(); }
});
document.getElementById('btn-prox').addEventListener('click', () => {
    const totalPaginas = Math.ceil(listaFiltrada.length / itensPorPagina);
    if (paginaAtual < totalPaginas) { paginaAtual++; renderizarTabela(); }
});

// Evento de Busca
inputBusca.addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    listaFiltrada = listaCompletaProdutos.filter(p => 
        p.nome.toLowerCase().includes(termo) || 
        p.marca.toLowerCase().includes(termo) ||
        p.categoria.toLowerCase().includes(termo)
    );
    paginaAtual = 1; // Volta pra primeira página ao buscar
    renderizarTabela();
});


// ==========================================
// CARREGAR DADOS INICIAIS
// ==========================================
async function carregarProdutos() {
    const tabela = document.getElementById('tabela-produtos');
    tabela.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "produtos"));
        listaCompletaProdutos = [];
        
        querySnapshot.forEach((doc) => {
            const p = doc.data();
            p.id = doc.id;
            listaCompletaProdutos.push(p);
        });

        listaFiltrada = [...listaCompletaProdutos]; // Inicializa a filtrada com tudo
        renderizarTabela();

    } catch (error) { console.error(error); }
}

// ==========================================
// FUNÇÕES DE CADASTRO / EDIÇÃO (MANTIDAS)
// ==========================================
btnAddVariante.addEventListener('click', () => {
    const tamanho = document.getElementById('var-tamanho').value;
    const cor = document.getElementById('var-cor').value.trim() || 'Padrão';
    const qtd = parseInt(document.getElementById('var-qtd').value);
    if (qtd > 0) {
        gradeTemporaria.push({ tamanho, cor, qtd });
        atualizarListaVariantes();
        document.getElementById('var-cor').value = ''; document.getElementById('var-qtd').value = '1';
    } else { alert("Qtd deve ser maior que zero."); }
});

function atualizarListaVariantes() {
    listaVariantes.innerHTML = '';
    gradeTemporaria.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span><b>${item.tamanho}</b> - ${item.cor} (${item.qtd} un.)</span><button type="button" onclick="removerVariante(${index})" style="background: red; color: white; border: none; padding: 2px 8px; border-radius: 4px;">X</button>`;
        listaVariantes.appendChild(li);
    });
}
window.removerVariante = function(index) { gradeTemporaria.splice(index, 1); atualizarListaVariantes(); };

formProduto.addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = localStorage.getItem('userRole');
    if (role === 'vendedor') { alert("Vendedores não podem alterar produtos."); return; }
    if (gradeTemporaria.length === 0) { alert("Adicione grade."); return; }

    const estoqueTotal = gradeTemporaria.reduce((total, item) => total + item.qtd, 0);
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
            await updateDoc(doc(db, "produtos", produtoEmEdicaoId), dadosProduto);
            alert("Produto atualizado!");
            cancelarEdicao();
        } else {
            dadosProduto.dataEntrada = serverTimestamp();
            dadosProduto.ativo = true;
            await addDoc(collection(db, "produtos"), dadosProduto);
            alert("Produto cadastrado!");
        }
        formProduto.reset(); gradeTemporaria = []; atualizarListaVariantes(); carregarProdutos();
    } catch (error) { console.error(error); alert("Erro ao salvar."); }
});

// EDIÇÃO E VISUALIZAÇÃO
window.editarProduto = function(id) {
    const produto = listaCompletaProdutos.find(p => p.id === id);
    if (!produto) return;
    document.getElementById('nome').value = produto.nome;
    document.getElementById('categoria').value = produto.categoria;
    document.getElementById('marca').value = produto.marca;
    document.getElementById('precoCusto').value = produto.precoCusto;
    document.getElementById('precoVenda').value = produto.precoVenda;
    gradeTemporaria = [...produto.grade];
    atualizarListaVariantes();
    produtoEmEdicaoId = id;
    btnSubmit.innerText = "Atualizar Produto"; btnSubmit.style.backgroundColor = "#f39c12";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function cancelarEdicao() {
    produtoEmEdicaoId = null;
    btnSubmit.innerText = "Salvar Produto"; btnSubmit.style.backgroundColor = "#27ae60";
}

window.visualizarProduto = function(id) {
    const produto = listaCompletaProdutos.find(p => p.id === id);
    const role = localStorage.getItem('userRole');
    if (!produto) return;
    document.getElementById('view-nome').innerText = produto.nome;
    document.getElementById('view-marca').innerText = produto.marca;
    document.getElementById('view-categoria').innerText = produto.categoria;
    document.getElementById('view-total').innerText = produto.estoqueTotal;
    document.getElementById('view-custo').innerText = role === 'admin' ? (produto.precoCusto||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '---';
    document.getElementById('view-venda').innerText = produto.precoVenda.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const listaGrade = document.getElementById('view-grade'); listaGrade.innerHTML = '';
    if (produto.grade) { produto.grade.forEach(item => {
        const li = document.createElement('li'); li.style.cssText = "padding: 5px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;";
        li.innerHTML = `<span>Tam <b>${item.tamanho}</b> - Cor ${item.cor}</span><strong>${item.qtd} un.</strong>`;
        listaGrade.appendChild(li);
    }); }
    document.getElementById('modal-visualizar').style.display = 'flex';
};

window.fecharModal = function() { document.getElementById('modal-visualizar').style.display = 'none'; };
window.deletarProduto = async function(id) {
    if(confirm("Excluir?")) { await deleteDoc(doc(db, "produtos", id)); carregarProdutos(); }
};

document.addEventListener('DOMContentLoaded', carregarProdutos);