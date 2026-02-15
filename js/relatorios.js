import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const dataHoje = new Date();
const params = new URLSearchParams(window.location.search);

// GLOBAIS DE PAGINAÇÃO
let listaVendasFiltradas = [];
let paginaAtual = 1;
const itensPorPagina = 10;

document.getElementById('btn-voltar').addEventListener('click', () => { window.location.href = 'dashboard.html'; });

function formatarDataLocal(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// Configura datas
if (params.get('periodo') === 'hoje') {
    const hojeFormatado = formatarDataLocal(dataHoje);
    document.getElementById('data-inicio').value = hojeFormatado;
    document.getElementById('data-fim').value = hojeFormatado;
} else {
    const primeiroDiaMes = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), 1);
    document.getElementById('data-inicio').value = formatarDataLocal(primeiroDiaMes);
    document.getElementById('data-fim').value = formatarDataLocal(dataHoje);
}

// ==========================================
// RENDERIZAR TABELA (PAGINADA)
// ==========================================
function renderizarTabela() {
    const tabela = document.getElementById('lista-vendas-periodo');
    tabela.innerHTML = '';

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const vendasPagina = listaVendasFiltradas.slice(inicio, fim);

    const totalPaginas = Math.ceil(listaVendasFiltradas.length / itensPorPagina) || 1;
    document.getElementById('info-paginacao').innerText = `Página ${paginaAtual} de ${totalPaginas}`;

    if (vendasPagina.length === 0) {
        tabela.innerHTML = '<tr><td colspan="8" style="text-align: center;">Nenhuma venda.</td></tr>';
        return;
    }

    vendasPagina.forEach((venda) => {
        const dataF = venda.dataVenda ? venda.dataVenda.toDate().toLocaleDateString('pt-BR') : '-';
        const vendedorNome = venda.vendedor || 'Desconhecido';
        const nomesItens = venda.itens.map(i => `${i.nome} (${i.tamanho})`).join(', ');
        
        // Desconto
        let descontoTexto = "-";
        if (venda.descontoPorcentagem > 0) {
            let valorDesc = venda.valorDesconto;
            if (!valorDesc) { 
                const brutoEstimado = venda.total / (1 - (venda.descontoPorcentagem/100));
                valorDesc = brutoEstimado - venda.total;
            }
            descontoTexto = `<span style="color: #c0392b; font-weight:bold;">${venda.descontoPorcentagem}%</span> <small>(R$ ${valorDesc.toFixed(2)})</small>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dataF}</td>
            <td>${vendedorNome}</td>
            <td>${venda.clienteNome}</td>
            <td style="font-size: 11px; max-width: 150px;">${nomesItens}</td>
            <td>${descontoTexto}</td>
            <td style="font-weight: bold;">R$ ${venda.total.toFixed(2).replace('.', ',')}</td>
            <td style="color: #c0392b;">R$ ${venda.custoVenda.toFixed(2).replace('.', ',')}</td>
            <td style="color: #27ae60; font-weight: bold;">R$ ${venda.lucroVenda.toFixed(2).replace('.', ',')}</td>
        `;
        tabela.appendChild(tr);
    });

    // Controles
    document.getElementById('btn-ant').disabled = paginaAtual === 1;
    document.getElementById('btn-prox').disabled = paginaAtual === totalPaginas;
    document.getElementById('btn-ant').style.opacity = paginaAtual === 1 ? "0.5" : "1";
    document.getElementById('btn-prox').style.opacity = paginaAtual === totalPaginas ? "0.5" : "1";
}

document.getElementById('btn-ant').addEventListener('click', () => { if(paginaAtual > 1) { paginaAtual--; renderizarTabela(); } });
document.getElementById('btn-prox').addEventListener('click', () => { const total = Math.ceil(listaVendasFiltradas.length/itensPorPagina); if(paginaAtual < total) { paginaAtual++; renderizarTabela(); } });

// ==========================================
// BUSCAR DADOS
// ==========================================
async function gerarRelatorio() {
    const dataInicioStr = document.getElementById('data-inicio').value;
    const dataFimStr = document.getElementById('data-fim').value;

    if (!dataInicioStr || !dataFimStr) { alert("Selecione o período."); return; }

    const dtInicio = new Date(dataInicioStr + 'T00:00:00');
    const dtFim = new Date(dataFimStr + 'T23:59:59');

    document.getElementById('lista-vendas-periodo').innerHTML = '<tr><td colspan="8" style="text-align: center;">Carregando...</td></tr>';

    try {
        const q = query(collection(db, "vendas"), where("dataVenda", ">=", dtInicio), where("dataVenda", "<=", dtFim), orderBy("dataVenda", "desc"));
        const querySnapshot = await getDocs(q);
        
        listaVendasFiltradas = [];
        let fatTotal = 0, custoTotal = 0, lucroTotal = 0;

        if (querySnapshot.empty) {
            zerarTotais(); renderizarTabela(); return;
        }

        querySnapshot.forEach((doc) => {
            const venda = doc.data();
            
            // Cálculos
            let custoVenda = 0;
            venda.itens.forEach(item => { custoVenda += (item.precoCusto || 0); });
            const lucroVenda = venda.total - custoVenda;

            // Salva dados processados na lista
            venda.custoVenda = custoVenda;
            venda.lucroVenda = lucroVenda;
            
            listaVendasFiltradas.push(venda);

            // Soma Totais Gerais
            fatTotal += venda.total;
            custoTotal += custoVenda;
            lucroTotal += lucroVenda;
        });

        // Atualiza Cards de Cima (Totais do período inteiro)
        document.getElementById('total-faturamento').innerText = fatTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('total-custo').innerText = custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('total-lucro').innerText = lucroTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        paginaAtual = 1;
        renderizarTabela();

    } catch (error) { console.error(error); alert("Erro ao buscar dados."); }
}

function zerarTotais() {
    document.getElementById('total-faturamento').innerText = "R$ 0,00";
    document.getElementById('total-custo').innerText = "R$ 0,00";
    document.getElementById('total-lucro').innerText = "R$ 0,00";
}

// PDF (Lógica mantida para imprimir a tela)
document.getElementById('btn-pdf').addEventListener('click', async () => {
    // Nota: O PDF vai imprimir apenas a página atual da tabela.
    // Para imprimir tudo, precisaríamos renderizar tudo temporariamente.
    const element = document.getElementById('area-impressao-relatorio');
    const headerPdf = document.getElementById('header-pdf');
    const btn = document.getElementById('btn-pdf');
    btn.innerText = "Gerando PDF...";
    
    // Tenta pegar logo
    try {
        const configSnap = await getDoc(doc(db, "configuracoes", "dados_loja"));
        if (configSnap.exists()) {
            const d = configSnap.data();
            document.getElementById('nome-loja-relatorio').innerText = d.nome || "Minha Loja";
            if(d.logo) document.getElementById('logo-relatorio').src = d.logo;
        }
    } catch(e){}
    
    const d1 = new Date(document.getElementById('data-inicio').value).toLocaleDateString('pt-BR');
    const d2 = new Date(document.getElementById('data-fim').value).toLocaleDateString('pt-BR');
    document.getElementById('periodo-relatorio').innerText = `Período: ${d1} até ${d2}`;

    headerPdf.style.display = 'block';
    
    const opt = { margin: 5, filename: `Relatorio_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
    html2pdf().set(opt).from(element).save().then(() => {
        headerPdf.style.display = 'none';
        btn.innerText = "📄 Baixar PDF";
    });
});

document.getElementById('btn-filtrar').addEventListener('click', gerarRelatorio);
document.addEventListener('DOMContentLoaded', gerarRelatorio);