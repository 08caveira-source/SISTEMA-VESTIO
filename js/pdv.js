import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.getElementById('btn-voltar').addEventListener('click', () => { window.location.href = 'dashboard.html'; });

// Variáveis Globais
let estoqueCompleto = []; 
let carrinho = []; 
let totalVenda = 0;

// Elementos da Tela
const inputBusca = document.getElementById('input-busca');
const listaResultados = document.getElementById('lista-resultados');
const divItensCarrinho = document.getElementById('itens-carrinho');
const divTotalVenda = document.getElementById('total-venda');
const btnFinalizar = document.getElementById('btn-finalizar-venda');
const selectCliente = document.getElementById('select-cliente');

// ==========================================
// 1. CARREGAR ESTOQUE E CLIENTES
// ==========================================
async function carregarDadosPDV() {
    try {
        const queryEstoque = await getDocs(collection(db, "produtos"));
        estoqueCompleto = [];
        queryEstoque.forEach((doc) => {
            const prod = doc.data();
            prod.id = doc.id; 
            estoqueCompleto.push(prod);
        });
    } catch (error) {
        console.error("Erro ao carregar estoque: ", error);
    }

    try {
        const queryClientes = await getDocs(collection(db, "clientes"));
        selectCliente.innerHTML = '<option value="Consumidor Final" data-telefone="">Consumidor Final</option>';
        
        let clientesTemp = [];
        queryClientes.forEach((doc) => {
            const cliente = doc.data();
            cliente.id = doc.id;
            clientesTemp.push(cliente);
        });

        clientesTemp.sort((a, b) => a.nome.localeCompare(b.nome));

        clientesTemp.forEach((cliente) => {
            const option = document.createElement('option');
            option.value = cliente.id; 
            option.textContent = cliente.nome;
            option.dataset.nome = cliente.nome; 
            option.dataset.limite = cliente.limiteCredito; 
            // NOVO: Guardamos o telefone do cliente no option
            option.dataset.telefone = cliente.telefone || ""; 
            
            selectCliente.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao carregar clientes: ", error);
    }
}

document.addEventListener('DOMContentLoaded', carregarDadosPDV);

// ==========================================
// 2. SISTEMA DE BUSCA NA TELA
// ==========================================
inputBusca.addEventListener('input', (e) => {
    const termoBusca = e.target.value.toLowerCase();
    
    if (termoBusca.length === 0) {
        listaResultados.innerHTML = '<p style="color: #7f8c8d; text-align: center; margin-top: 50px;">Digite algo para buscar no estoque...</p>';
        return;
    }

    const resultados = estoqueCompleto.filter(p => 
        p.nome.toLowerCase().includes(termoBusca) || 
        p.marca.toLowerCase().includes(termoBusca)
    );

    renderizarResultadosBusca(resultados);
});

function renderizarResultadosBusca(produtos) {
    listaResultados.innerHTML = '';

    if (produtos.length === 0) {
        listaResultados.innerHTML = '<p style="color: red; text-align: center;">Nenhum produto encontrado.</p>';
        return;
    }

    produtos.forEach(produto => {
        const precoF = produto.precoVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        let opcoesVariantes = '';
        
        produto.grade.forEach((varItem, index) => {
            if (varItem.qtd > 0) {
                opcoesVariantes += `<option value="${index}">${varItem.tamanho} - ${varItem.cor} (${varItem.qtd} un.)</option>`;
            }
        });

        if (opcoesVariantes === '') opcoesVariantes = `<option disabled>Sem estoque</option>`;

        const div = document.createElement('div');
        div.className = 'produto-item';
        div.innerHTML = `
            <div class="produto-info">
                <h4>${produto.nome}</h4>
                <p>${precoF}</p>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <select id="select-var-${produto.id}" style="padding: 5px;">${opcoesVariantes}</select>
                <button onclick="adicionarAoCarrinho('${produto.id}')" style="background: #3498db; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">+</button>
            </div>
        `;
        listaResultados.appendChild(div);
    });
}

// ==========================================
// 3. ADICIONAR AO CARRINHO
// ==========================================
window.adicionarAoCarrinho = function(produtoId) {
    const produto = estoqueCompleto.find(p => p.id === produtoId);
    const selectElement = document.getElementById(`select-var-${produtoId}`);
    
    if (selectElement.disabled) {
        alert("Produto sem estoque.");
        return;
    }
    
    const indexVariante = selectElement.value;
    const varianteEscolhida = produto.grade[indexVariante];

    carrinho.push({
        produtoId: produto.id,
        nome: produto.nome,
        precoUnitario: produto.precoVenda,
        tamanho: varianteEscolhida.tamanho,
        cor: varianteEscolhida.cor,
        indexGrade: indexVariante 
    });

    atualizarVisualCarrinho();
    inputBusca.value = '';
    inputBusca.focus();
    listaResultados.innerHTML = '';
};

function atualizarVisualCarrinho() {
    divItensCarrinho.innerHTML = '';
    totalVenda = 0;

    if (carrinho.length === 0) {
        divItensCarrinho.innerHTML = '<p style="color: #7f8c8d; text-align: center; margin-top: 20px;">Carrinho vazio.</p>';
    } else {
        carrinho.forEach((item, index) => {
            totalVenda += item.precoUnitario;
            const div = document.createElement('div');
            div.className = 'item-carrinho';
            div.innerHTML = `
                <div style="flex: 1;"><strong>${item.nome}</strong><br><small>${item.tamanho} / ${item.cor}</small></div>
                <div style="text-align: right; margin-right: 15px;">R$ ${item.precoUnitario.toFixed(2).replace('.', ',')}</div>
                <button onclick="removerDoCarrinho(${index})">X</button>
            `;
            divItensCarrinho.appendChild(div);
        });
    }
    divTotalVenda.innerText = totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

window.removerDoCarrinho = function(index) {
    carrinho.splice(index, 1);
    atualizarVisualCarrinho();
};

// ==========================================
// 4. GERAR TEXTO DO RECIBO
// ==========================================
// ✏️ ALTERE AQUI O NOME DA SUA LOJA:
const NOME_DA_LOJA = "DISTRITO 51 - VISTA SUA QUEBRADA!"; 

function gerarTextoRecibo(itens, total, formaPgto, nomeCli) {
    let texto = `*🛍️ ${NOME_DA_LOJA.toUpperCase()} - RECIBO*\n`;
    texto += `--------------------------------------\n`;
    texto += `*Cliente:* ${nomeCli}\n`;
    texto += `*Data:* ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n`;
    texto += `--------------------------------------\n`;
    texto += `*ITENS DA COMPRA:*\n`;
    
    itens.forEach(item => {
        texto += `▪️ ${item.nome} (${item.tamanho}/${item.cor})\n`;
        texto += `   Valor: R$ ${item.precoUnitario.toFixed(2).replace('.', ',')}\n`;
    });
    
    texto += `--------------------------------------\n`;
    texto += `*TOTAL:* R$ ${total.toFixed(2).replace('.', ',')}\n`;
    texto += `*Pagamento:* ${formaPgto}\n`;
    texto += `--------------------------------------\n`;
    texto += `Obrigado pela preferência! Volte sempre. ✨`;

    return texto;
}

// ==========================================
// 5. FINALIZAR VENDA
// ==========================================
btnFinalizar.addEventListener('click', async () => {
    if (carrinho.length === 0) {
        alert("Adicione produtos ao carrinho antes de finalizar.");
        return;
    }

    const formaPagamento = document.getElementById('forma-pagamento').value;
    const clienteIdSelecionado = selectCliente.value;
    const vendedor = localStorage.getItem('userName') || "Desconhecido";
    
    const opcaoSelecionada = selectCliente.options[selectCliente.selectedIndex];
    const nomeCliente = opcaoSelecionada.value === "Consumidor Final" ? "Consumidor Final" : opcaoSelecionada.dataset.nome;

    btnFinalizar.innerText = "Calculando...";
    btnFinalizar.disabled = true;

    // Regra de Trava do Crediário
    if (formaPagamento === 'Crediário') {
        if (clienteIdSelecionado === 'Consumidor Final') {
            alert("⚠️ Para vender no Crediário, selecione um cliente cadastrado.");
            btnFinalizar.innerText = "Finalizar Venda";
            btnFinalizar.disabled = false;
            return;
        }

        const limiteTotal = parseFloat(opcaoSelecionada.dataset.limite) || 0;
        let dividaAtual = 0;

        try {
            const qVendas = query(collection(db, "vendas"), where("clienteId", "==", clienteIdSelecionado), where("statusPagamento", "==", "Pendente"));
            const snapVendas = await getDocs(qVendas);
            snapVendas.forEach(doc => { dividaAtual += doc.data().total; });

            const qParcelas = query(collection(db, "parcelas"), where("clienteId", "==", clienteIdSelecionado), where("status", "==", "Pendente"));
            const snapParcelas = await getDocs(qParcelas);
            snapParcelas.forEach(doc => { dividaAtual += doc.data().valor; });
        } catch (error) {
            console.error("Erro ao calcular dívida:", error);
            btnFinalizar.innerText = "Finalizar Venda";
            btnFinalizar.disabled = false;
            return;
        }

        const limiteDisponivel = limiteTotal - dividaAtual;

        if (totalVenda > limiteDisponivel) {
            alert(`⛔ Venda Bloqueada!\nLimite Disponível: R$ ${limiteDisponivel.toFixed(2)}\nO valor ultrapassa o limite restante.`);
            btnFinalizar.innerText = "Finalizar Venda";
            btnFinalizar.disabled = false;
            return; 
        }
    }

    btnFinalizar.innerText = "Processando...";

    try {
        // 1. Salvar Venda
        const novaVenda = {
            itens: carrinho,
            total: totalVenda,
            formaPagamento: formaPagamento,
            clienteId: clienteIdSelecionado === "Consumidor Final" ? null : clienteIdSelecionado,
            clienteNome: nomeCliente,
            vendedor: vendedor,
            dataVenda: serverTimestamp(),
            statusPagamento: formaPagamento === 'Crediário' ? 'Pendente' : 'Pago'
        };
        
        await addDoc(collection(db, "vendas"), novaVenda);

        // 2. Dar baixa no estoque
        for (const item of carrinho) {
            const produtoOriginal = estoqueCompleto.find(p => p.id === item.produtoId);
            produtoOriginal.grade[item.indexGrade].qtd -= 1;
            produtoOriginal.estoqueTotal -= 1;

            const produtoRef = doc(db, "produtos", item.produtoId);
            await updateDoc(produtoRef, {
                grade: produtoOriginal.grade,
                estoqueTotal: produtoOriginal.estoqueTotal
            });
        }

        // ==========================================
        // NOVO: COPIA O RECIBO PARA A ÁREA DE TRANSFERÊNCIA
        // ==========================================
        const desejaRecibo = confirm("Venda finalizada com sucesso!\n\nDeseja copiar o recibo para enviar no WhatsApp?");
        
        if (desejaRecibo) {
            const textoRecibo = gerarTextoRecibo(carrinho, totalVenda, formaPagamento, nomeCliente);
            
            // Comando que copia o texto silenciosamente
            navigator.clipboard.writeText(textoRecibo).then(() => {
                alert("✅ Recibo copiado! Vá para a aba do WhatsApp e aperte Ctrl+V.");
            }).catch(err => {
                console.error("Erro ao copiar: ", err);
                alert("Não foi possível copiar automaticamente. Verifique as permissões do navegador.");
            });
        } else {
            // Se o usuário clicar em "Cancelar" no confirm, não faz nada extra
        }
        
        // Limpa a tela para o próximo cliente
        carrinho = [];
        atualizarVisualCarrinho();
        selectCliente.value = "Consumidor Final";
        document.getElementById('forma-pagamento').value = "Dinheiro";
        carregarDadosPDV(); 
        
    } catch (error) {
        console.error("Erro ao finalizar venda:", error);
        alert("Erro ao processar a venda.");
    } finally {
        btnFinalizar.innerText = "Finalizar Venda";
        btnFinalizar.disabled = false;
    }
});