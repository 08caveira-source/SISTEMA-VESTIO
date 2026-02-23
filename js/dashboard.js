import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getColRef, getDocRef, validarSenhaMaster } from './saas-utils.js'; 
import { getDocs, query, where, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let listaVendasHoje = [];
let paginaAtual = 1;
const itensPorPagina = 8;
let vendaParaPDF = null;
let NOME_LOJA = "MINHA LOJA", CNPJ_LOJA = "", TEL_LOJA = "", LOGO_LOJA = null;

document.addEventListener('DOMContentLoaded', async () => {
    const nomeSpan = document.getElementById('nome-utilizador');
    const userName = localStorage.getItem('VESTIO_USER_NAME');
    if (userName && nomeSpan) nomeSpan.innerText = `Olá, ${userName}`;
    
    await carregarConfigLoja();
    carregarMetricasDoDashboard();
    
    const btnVerDetalhes = document.querySelector('button[onclick*="relatorios.html"]');
    if(btnVerDetalhes) {
        btnVerDetalhes.onclick = (e) => {
            e.preventDefault();
            const hoje = new Date().toISOString().split('T')[0];
            localStorage.setItem('FILTRO_DATA_INICIO', hoje);
            localStorage.setItem('FILTRO_DATA_FIM', hoje);
            window.location.href = 'relatorios.html';
        };
    }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOut(auth); localStorage.clear(); window.location.href = "../index.html";
});

function formatarDataHora(dataFirebase) {
    if (!dataFirebase) return '-';
    try {
        if (typeof dataFirebase.toDate === 'function') return dataFirebase.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        return new Date(dataFirebase).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    } catch (e) { return '-'; }
}

function formatarDataDia(dataFirebase) {
    if (!dataFirebase) return '-';
    try {
        if (typeof dataFirebase.toDate === 'function') return dataFirebase.toDate().toLocaleDateString('pt-BR');
        return new Date(dataFirebase).toLocaleDateString('pt-BR');
    } catch (e) { return '-'; }
}

async function carregarConfigLoja() {
    try {
        const snap = await getDoc(getDocRef("configuracoes", "dados_loja"));
        if (snap.exists()) {
            const d = snap.data();
            NOME_LOJA = d.nome; CNPJ_LOJA = d.cnpj; TEL_LOJA = d.telefone; LOGO_LOJA = d.logo;
        }
    } catch(e){ console.log("Config padrão."); }
}

async function carregarMetricasDoDashboard() {
    try {
        const inicioDoDia = new Date(); inicioDoDia.setHours(0,0,0,0);
        
        // VENDAS
        const qVendas = query(getColRef("vendas"), where("dataVenda", ">=", inicioDoDia));
        const snapVendas = await getDocs(qVendas);
        let total = 0;
        let lista = [];
        snapVendas.forEach(d => { total += d.data().total; lista.push({id:d.id, ...d.data()}); });
        
        document.getElementById('card-vendas-hoje').innerText = total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        // Chame sua função de renderizar tabela aqui (lista)

        // ESTOQUE (CORREÇÃO DO TRAVAMENTO)
        const snapProd = await getDocs(getColRef("produtos"));
        let valEstoque = 0;
        let alertas = [];
        
        snapProd.forEach(d => {
            const p = d.data();
            valEstoque += (p.precoVenda || 0) * (p.estoqueTotal || 0);
            
            // VERIFICAÇÃO DE SEGURANÇA: Se grade existe e é array
            if (p.grade && Array.isArray(p.grade)) {
                p.grade.forEach(g => {
                    if (g.qtd <= 3) alertas.push({ nome: p.nome, var: `${g.tamanho}/${g.cor}`, qtd: g.qtd });
                });
            }
        });
        
        document.getElementById('card-valor-estoque').innerText = valEstoque.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        
        // Renderizar alertas
        const listaAlertas = document.getElementById('lista-alerta-estoque');
        listaAlertas.innerHTML = '';
        if(alertas.length === 0) listaAlertas.innerHTML = '<tr><td>Estoque OK</td></tr>';
        else alertas.forEach(a => listaAlertas.innerHTML += `<tr><td>${a.nome} (${a.var})</td><td style="color:red">${a.qtd}</td></tr>`);

    } catch (e) { console.error("Erro dashboard:", e); }
}

function renderizarTabelaVendas() {
    const tabela = document.getElementById('tabela-vendas-hoje');
    if(!tabela) return;
    tabela.innerHTML = '';

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const vendasPagina = listaVendasHoje.slice(inicio, fim);
    const totalPaginas = Math.ceil(listaVendasHoje.length / itensPorPagina) || 1;

    const infoPag = document.getElementById('info-paginacao');
    if(infoPag) infoPag.innerText = `Página ${paginaAtual} de ${totalPaginas}`;

    if (vendasPagina.length === 0) {
        tabela.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #95a5a6;">Nenhuma venda hoje.</td></tr>';
        return;
    }

    vendasPagina.forEach(venda => {
        const hora = formatarDataHora(venda.dataVenda);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px;">${hora}</td>
            <td style="padding: 10px;">${venda.clienteNome}</td>
            <td style="padding: 10px;">${venda.vendedor || '-'}</td>
            <td style="padding: 10px; font-weight: bold; color: #27ae60;">R$ ${venda.total.toFixed(2)}</td>
            <td style="padding: 10px;">${venda.formaPagamento}</td>
            <td style="padding: 10px;"><span class="badge ${venda.statusPagamento === 'Pago' ? 'bg-pago' : 'bg-pendente'}">${venda.statusPagamento || 'Pago'}</span></td>
            <td style="padding: 10px; display:flex; gap:5px;">
                <button class="btn-acao" onclick="window.verDetalhesVenda('${venda.id}')">Ver</button>
                <button class="btn-vermelho" style="width:auto; padding:5px 10px;" onclick="window.excluirVenda('${venda.id}')">🗑️</button>
            </td>
        `;
        tabela.appendChild(tr);
    });

    const btnAnt = document.getElementById('btn-ant');
    const btnProx = document.getElementById('btn-prox');
    if(btnAnt) {
        btnAnt.disabled = paginaAtual === 1;
        btnAnt.onclick = () => { if(paginaAtual > 1) { paginaAtual--; renderizarTabelaVendas(); }};
    }
    if(btnProx) {
        btnProx.disabled = paginaAtual === totalPaginas;
        btnProx.onclick = () => { if(paginaAtual < totalPaginas) { paginaAtual++; renderizarTabelaVendas(); }};
    }
}

window.verDetalhesVenda = function(id) {
    const venda = listaVendasHoje.find(v => v.id === id);
    if(!venda) return;
    vendaParaPDF = venda;
    
    document.getElementById('detalhe-vendedor').innerText = venda.vendedor || '-';
    document.getElementById('detalhe-cliente').innerText = venda.clienteNome || '-';
    const lista = document.getElementById('lista-itens-venda'); 
    lista.innerHTML = '';
    venda.itens.forEach(i => { lista.innerHTML += `<tr><td>${i.nome}</td><td style="text-align:right;">R$ ${i.precoUnitario.toFixed(2)}</td></tr>`; });
    document.getElementById('detalhe-total').innerText = venda.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    document.getElementById('modal-detalhes').style.display = 'flex';
};

window.excluirVenda = async function(id) {
    const { value: pass } = await Swal.fire({
        title: 'Excluir Venda?',
        text: 'Requer senha de Gerente ou Super Admin',
        input: 'password',
        background: '#1e293b', color: '#fff',
        showCancelButton: true
    });

    if(await validarSenhaMaster(pass)) {
        await deleteDoc(getDocRef("vendas", id));
        Swal.fire('Deletado', 'Venda removida.', 'success');
        carregarMetricasDoDashboard();
    } else if(pass) {
        Swal.fire('Erro', 'Senha incorreta', 'error');
    }
};

const btnPDF = document.getElementById('btn-segunda-via');
if(btnPDF) {
    btnPDF.addEventListener('click', () => {
        if(!vendaParaPDF) return;
        const v = vendaParaPDF;
        document.getElementById('cupom-nome-loja').innerText = NOME_LOJA;
        document.getElementById('cupom-info-loja').innerText = `CNPJ: ${CNPJ_LOJA} | ${TEL_LOJA}`;
        if(LOGO_LOJA) { const i = document.getElementById('cupom-logo'); i.src = LOGO_LOJA; i.style.display = 'block'; }
        document.getElementById('cupom-data').innerText = formatarDataDia(v.dataVenda);
        document.getElementById('cupom-cliente').innerText = v.clienteNome;
        const tb = document.getElementById('cupom-itens'); tb.innerHTML = '';
        v.itens.forEach(i => tb.innerHTML += `<tr><td>${i.nome}</td><td style="text-align:right;">${i.precoUnitario.toFixed(2)}</td></tr>`);
        document.getElementById('cupom-total').innerText = v.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
        const el = document.getElementById('cupom-fiscal');
        const opt = { margin: 0, filename: `2Via_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: [80, 200] } };
        html2pdf().set(opt).from(el).save();
    });
}