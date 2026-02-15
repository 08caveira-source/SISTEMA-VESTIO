import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// GLOBAIS
let listaVendasHoje = [];
let paginaAtual = 1;
const itensPorPagina = 8; // Ajuste conforme caber na tela
let vendaParaPDF = null;
let NOME_LOJA="MINHA LOJA", CNPJ_LOJA="", TEL_LOJA="", LOGO_LOJA=null;

document.addEventListener('DOMContentLoaded', async () => {
    const nomeSpan = document.getElementById('nome-utilizador');
    const userName = localStorage.getItem('userName');
    if (userName) nomeSpan.innerText = `Olá, ${userName}`;
    
    await carregarConfigLoja(); // Carrega logo para o PDF
    carregarMetricasDoDashboard();
});

const btnLogout = document.getElementById('btn-logout');
btnLogout.addEventListener('click', async () => {
    try { await signOut(auth); localStorage.clear(); window.location.href = "../index.html"; } 
    catch (error) { console.error("Erro logout: ", error); }
});

async function carregarConfigLoja() {
    try {
        const snap = await getDoc(doc(db, "configuracoes", "dados_loja"));
        if (snap.exists()) {
            const d = snap.data();
            NOME_LOJA=d.nome; CNPJ_LOJA=d.cnpj; TEL_LOJA=d.telefone; LOGO_LOJA=d.logo;
        }
    } catch(e){}
}

async function carregarMetricasDoDashboard() {
    const cardVendasHoje = document.getElementById('card-vendas-hoje');
    const cardCrediario = document.getElementById('card-crediario-pendente');
    const cardValorEstoque = document.getElementById('card-valor-estoque');
    const listaAlertas = document.getElementById('lista-alerta-estoque');

    try {
        const inicioDoDia = new Date();
        inicioDoDia.setHours(0, 0, 0, 0);

        // 1. VENDAS HOJE (Busca + Paginação)
        const qVendas = query(collection(db, "vendas"), where("dataVenda", ">=", inicioDoDia), orderBy("dataVenda", "desc"));
        const snapshotVendas = await getDocs(qVendas);
        
        let totalVendasHoje = 0;
        listaVendasHoje = [];

        snapshotVendas.forEach(doc => {
            const venda = doc.data();
            venda.id = doc.id; // Importante para o botão Ver
            totalVendasHoje += venda.total;
            listaVendasHoje.push(venda);
        });
        
        cardVendasHoje.innerText = totalVendasHoje.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        renderizarTabelaVendas(); // Chama a paginação

        // 2. CREDIÁRIO
        const qParcelas = query(collection(db, "parcelas"), where("status", "==", "Pendente"));
        const snapshotParcelas = await getDocs(qParcelas);
        let totalCrediario = 0;
        snapshotParcelas.forEach(doc => { totalCrediario += doc.data().valor; });
        cardCrediario.innerText = totalCrediario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // 3. ESTOQUE (VALOR TOTAL)
        const snapshotProdutos = await getDocs(collection(db, "produtos"));
        let valorTotalEstoque = 0;
        let itensEmAlerta = [];

        snapshotProdutos.forEach(doc => {
            const produto = doc.data();
            const preco = produto.precoVenda || 0;
            const qtdTotal = produto.estoqueTotal || 0;
            
            // Soma valor (Preço x Quantidade)
            valorTotalEstoque += (preco * qtdTotal);

            if (produto.grade && produto.grade.length > 0) {
                produto.grade.forEach(item => {
                    if (item.qtd <= 3) {
                        itensEmAlerta.push({
                            nome: produto.nome, variacao: `${item.tamanho} / ${item.cor}`, qtd: item.qtd
                        });
                    }
                });
            }
        });

        // Exibe Valor Monetário no Card
        cardValorEstoque.innerText = valorTotalEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Alertas
        listaAlertas.innerHTML = '';
        if (itensEmAlerta.length === 0) {
            listaAlertas.innerHTML = '<tr><td colspan="2" style="padding: 15px; text-align: center; color: #27ae60;">✅ Estoque saudável!</td></tr>';
        } else {
            itensEmAlerta.sort((a, b) => a.qtd - b.qtd);
            itensEmAlerta.forEach(item => {
                const corTexto = item.qtd === 0 ? 'red' : '#e67e22';
                const textoQtd = item.qtd === 0 ? 'ESGOTADO' : `${item.qtd}`;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${item.nome}</strong><br><small style="color: #7f8c8d;">${item.variacao}</small></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${corTexto}; font-weight: bold; text-align: center;">${textoQtd}</td>
                `;
                listaAlertas.appendChild(tr);
            });
        }

    } catch (error) { console.error("Erro métricas:", error); }
}

// ==========================================
// LÓGICA DE PAGINAÇÃO DA TABELA
// ==========================================
function renderizarTabelaVendas() {
    const tabela = document.getElementById('tabela-vendas-hoje');
    tabela.innerHTML = '';

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const vendasPagina = listaVendasHoje.slice(inicio, fim);
    const totalPaginas = Math.ceil(listaVendasHoje.length / itensPorPagina) || 1;

    document.getElementById('info-paginacao').innerText = `Página ${paginaAtual} de ${totalPaginas}`;

    if (vendasPagina.length === 0) {
        tabela.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #95a5a6;">Nenhuma venda hoje.</td></tr>';
        return;
    }

    vendasPagina.forEach(venda => {
        const hora = venda.dataVenda ? venda.dataVenda.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '-';
        
        let statusTexto = venda.statusPagamento || 'Pago';
        let statusClass = 'bg-pago';
        if(statusTexto === 'Pendente' || statusTexto === 'Parcelado') statusClass = 'bg-pendente';
        if(statusTexto === 'Quitado') statusClass = 'bg-quitado';

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';
        tr.innerHTML = `
            <td style="padding: 10px;">${hora}</td>
            <td style="padding: 10px;">${venda.clienteNome}</td>
            <td style="padding: 10px;">${venda.vendedor || '-'}</td>
            <td style="padding: 10px; font-weight: bold; color: #27ae60;">R$ ${venda.total.toFixed(2).replace('.',',')}</td>
            <td style="padding: 10px;">${venda.formaPagamento}</td>
            <td style="padding: 10px;"><span class="badge ${statusClass}">${statusTexto}</span></td>
            <td style="padding: 10px;">
                <button onclick="verDetalhesVenda('${venda.id}')" class="btn-acao">Ver Itens</button>
            </td>
        `;
        tabela.appendChild(tr);
    });

    document.getElementById('btn-ant').disabled = paginaAtual === 1;
    document.getElementById('btn-prox').disabled = paginaAtual === totalPaginas;
    document.getElementById('btn-ant').style.opacity = paginaAtual === 1 ? "0.5" : "1";
    document.getElementById('btn-prox').style.opacity = paginaAtual === totalPaginas ? "0.5" : "1";
}

document.getElementById('btn-ant').addEventListener('click', () => { if(paginaAtual > 1) { paginaAtual--; renderizarTabelaVendas(); } });
document.getElementById('btn-prox').addEventListener('click', () => { 
    const total = Math.ceil(listaVendasHoje.length/itensPorPagina);
    if(paginaAtual < total) { paginaAtual++; renderizarTabelaVendas(); } 
});

// ==========================================
// FUNÇÕES DO MODAL (DETALHES E PDF)
// ==========================================
window.verDetalhesVenda = async function(id) {
    const venda = listaVendasHoje.find(v => v.id === id);
    if(!venda) return;
    vendaParaPDF = venda;

    document.getElementById('detalhe-vendedor').innerText = venda.vendedor || '-';
    document.getElementById('detalhe-cliente').innerText = venda.clienteNome || '-';
    
    const lista = document.getElementById('lista-itens-venda'); lista.innerHTML = '';
    if(venda.itens) {
        venda.itens.forEach(i => {
            lista.innerHTML += `<tr><td>${i.nome} (${i.tamanho})</td><td style="text-align:right;">R$ ${i.precoUnitario.toFixed(2)}</td></tr>`;
        });
    }

    if (venda.descontoPorcentagem > 0) {
        document.getElementById('detalhe-subtotal').innerText = (venda.totalBruto||venda.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
        document.getElementById('detalhe-desconto-linha').innerText = `Desc: -${venda.descontoPorcentagem}% (R$ ${(venda.valorDesconto||0).toFixed(2)})`;
    } else {
        document.getElementById('detalhe-subtotal').innerText = venda.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
        document.getElementById('detalhe-desconto-linha').innerText = "";
    }
    document.getElementById('detalhe-total').innerText = venda.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    
    document.getElementById('modal-detalhes').style.display = 'flex';
};

document.getElementById('btn-segunda-via').addEventListener('click', () => {
    if(!vendaParaPDF) return;
    const v = vendaParaPDF;
    
    document.getElementById('cupom-nome-loja').innerText = NOME_LOJA;
    document.getElementById('cupom-info-loja').innerText = `CNPJ: ${CNPJ_LOJA} | ${TEL_LOJA}`;
    if(LOGO_LOJA) { const i = document.getElementById('cupom-logo'); i.src = LOGO_LOJA; i.style.display = 'block'; }
    
    document.getElementById('cupom-data').innerText = v.dataVenda ? v.dataVenda.toDate().toLocaleDateString() : '-';
    document.getElementById('cupom-cliente').innerText = v.clienteNome;
    document.getElementById('cupom-vendedor').innerText = v.vendedor;
    
    const tb = document.getElementById('cupom-itens'); tb.innerHTML = '';
    v.itens.forEach(i => tb.innerHTML += `<tr><td>${i.nome} (${i.tamanho})</td><td style="text-align:right;">${i.precoUnitario.toFixed(2)}</td></tr>`);
    
    document.getElementById('cupom-total').innerText = v.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    document.getElementById('cupom-desc-info').innerText = (v.descontoPorcentagem > 0) ? `Desc: ${v.descontoPorcentagem}%` : '';

    const el = document.getElementById('cupom-fiscal');
    const opt = { margin: 0, filename: `2Via_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: [80, 200] } };
    html2pdf().set(opt).from(el).save();
});