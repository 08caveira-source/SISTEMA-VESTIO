import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDocs, query, where, orderBy, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let listaVendasFiltradas = [];
let paginaAtual = 1;
const itensPorPagina = 10;

document.addEventListener('DOMContentLoaded', () => {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) return window.location.href = "../index.html";
    
    // Captura o filtro enviado pelo Dashboard (se existir)
    const filtroInicio = localStorage.getItem('FILTRO_DATA_INICIO');
    const filtroFim = localStorage.getItem('FILTRO_DATA_FIM');
    const hoje = new Date();

    if (filtroInicio && filtroFim) {
        document.getElementById('data-inicio').value = filtroInicio;
        document.getElementById('data-fim').value = filtroFim;
        
        // Limpa a memória para que nas próximas vezes ele não fique preso nesta data
        localStorage.removeItem('FILTRO_DATA_INICIO');
        localStorage.removeItem('FILTRO_DATA_FIM');
    } else {
        // Comportamento padrão: Filtra do dia 1 até hoje
        document.getElementById('data-inicio').value = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
        document.getElementById('data-fim').value = hoje.toISOString().split('T')[0];
    }

    document.getElementById('btn-filtrar').addEventListener('click', () => carregarRelatorio(empresaId));
    document.getElementById('btn-pdf').addEventListener('click', gerarPDFProfissional);
    document.getElementById('btn-logout').addEventListener('click', async () => { await signOut(auth); window.location.href = "../index.html"; });
    
    document.getElementById('btn-ant').addEventListener('click', () => { paginaAtual--; renderizarTabela(); });
    document.getElementById('btn-prox').addEventListener('click', () => { paginaAtual++; renderizarTabela(); });

    carregarRelatorio(empresaId);
});

async function carregarRelatorio(empresaId) {
    const tbody = document.getElementById('lista-relatorio');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando...</td></tr>';

    try {
        const dInicio = new Date(document.getElementById('data-inicio').value + "T00:00:00");
        const dFim = new Date(document.getElementById('data-fim').value + "T23:59:59");

        const q = query(collection(db, "empresas", empresaId, "vendas"), where("dataVenda", ">=", dInicio), where("dataVenda", "<=", dFim), orderBy("dataVenda", "desc"));
        const snapshot = await getDocs(q);
        
        listaVendasFiltradas = [];
        let totalFat = 0;
        let totalCusto = 0;

        snapshot.forEach(doc => {
            const v = doc.data();
            listaVendasFiltradas.push(v);
            totalFat += v.total || 0;
            if(v.itens) v.itens.forEach(i => totalCusto += (i.custo || 0) * (i.qtd || 1));
        });

        document.getElementById('total-faturamento').innerText = totalFat.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        document.getElementById('total-custo').innerText = totalCusto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        document.getElementById('total-lucro').innerText = (totalFat - totalCusto).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        
        paginaAtual = 1;
        renderizarTabela();

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="5">Erro: ${error.message}</td></tr>`;
    }
}

function renderizarTabela() {
    const tbody = document.getElementById('lista-relatorio');
    tbody.innerHTML = '';

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensPagina = listaVendasFiltradas.slice(inicio, fim);
    const totalPaginas = Math.ceil(listaVendasFiltradas.length / itensPorPagina) || 1;

    document.getElementById('info-paginacao').innerText = `Página ${paginaAtual} de ${totalPaginas}`;
    document.getElementById('btn-ant').disabled = paginaAtual === 1;
    document.getElementById('btn-prox').disabled = paginaAtual >= totalPaginas;

    if (itensPagina.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhuma venda encontrada.</td></tr>';
        return;
    }

    itensPagina.forEach(v => {
        let custo = 0;
        if(v.itens) v.itens.forEach(i => custo += (i.custo || 0) * (i.qtd || 1));
        const lucro = (v.total || 0) - custo;

        tbody.innerHTML += `
            <tr>
                <td>${new Date(v.dataVenda.toDate()).toLocaleDateString()}</td>
                <td>${v.vendedor || '-'}</td>
                <td>${v.clienteNome || 'Consumidor'}</td>
                <td>R$ ${v.total.toFixed(2)}</td>
                <td style="color:#30D158">R$ ${lucro.toFixed(2)}</td>
            </tr>`;
    });
}

function gerarPDFProfissional() {
    const lojaNome = localStorage.getItem('VESTIO_USER_NAME') || 'Minha Loja';
    const periodo = `Período: ${document.getElementById('data-inicio').value} a ${document.getElementById('data-fim').value}`;
    
    // Geração da String HTML direta (Resolve o problema da folha em branco)
    let html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: black; background: white;">
            <h2 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">${lojaNome}</h2>
            <h3 style="text-align:center;">Relatório Financeiro</h3>
            <p style="text-align:center; color:#666;">${periodo}</p>
            <br>
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
                <thead>
                    <tr style="background:#eee;">
                        <th style="border:1px solid #ccc; padding:8px; text-align:left;">Data</th>
                        <th style="border:1px solid #ccc; padding:8px; text-align:left;">Vendedor</th>
                        <th style="border:1px solid #ccc; padding:8px; text-align:left;">Cliente</th>
                        <th style="border:1px solid #ccc; padding:8px; text-align:right;">Total</th>
                        <th style="border:1px solid #ccc; padding:8px; text-align:right;">Lucro Est.</th>
                    </tr>
                </thead>
                <tbody>
    `;

    listaVendasFiltradas.forEach(v => {
        let custo = 0; if(v.itens) v.itens.forEach(i => custo += (i.custo||0)*(i.qtd||1));
        html += `
            <tr>
                <td style="border:1px solid #ccc; padding:6px;">${new Date(v.dataVenda.toDate()).toLocaleDateString()}</td>
                <td style="border:1px solid #ccc; padding:6px;">${v.vendedor || '-'}</td>
                <td style="border:1px solid #ccc; padding:6px;">${v.clienteNome}</td>
                <td style="border:1px solid #ccc; padding:6px; text-align:right;">R$ ${v.total.toFixed(2)}</td>
                <td style="border:1px solid #ccc; padding:6px; text-align:right;">R$ ${(v.total - custo).toFixed(2)}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div style="margin-top:20px; text-align:right;">
                <h3>Faturamento Total: ${document.getElementById('total-faturamento').innerText}</h3>
                <h3>Lucro Líquido: ${document.getElementById('total-lucro').innerText}</h3>
            </div>
        </div>
    `;

    const opt = {
        margin: 10,
        filename: 'Relatorio_Financeiro.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(html).save();
}