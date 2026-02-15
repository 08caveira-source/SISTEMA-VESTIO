import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc, getDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.getElementById('btn-voltar').addEventListener('click', () => { window.location.href = 'dashboard.html'; });

// Globais
let estoqueCompleto = [], clientesBase = [], clienteSelecionado = null, carrinho = [];
let totalBruto = 0, totalLiquido = 0, descontoPorcentagem = 0;
let NOME_LOJA = "MINHA LOJA", CNPJ_LOJA = "", TEL_LOJA = "", LOGO_LOJA = null, SENHA_GERENTE = "1234";

// Elementos DOM
const inputBuscaProd = document.getElementById('input-busca');
const listaResultadosProd = document.getElementById('lista-resultados');
const inputBuscaCli = document.getElementById('input-busca-cliente');
const listaResultadosCli = document.getElementById('lista-clientes-busca');
const displayCli = document.getElementById('cliente-selecionado-display');
const nomeCliDisplay = document.getElementById('nome-cliente-selecionado');
const btnRemoverCli = document.getElementById('btn-remover-cliente');
const divItensCarrinho = document.getElementById('itens-carrinho');
const divTotalVenda = document.getElementById('total-venda');
const btnFinalizar = document.getElementById('btn-finalizar-venda');
const selectPagamento = document.getElementById('forma-pagamento');
const divParcelas = document.getElementById('div-parcelas');
const selectQtdParcelas = document.getElementById('qtd-parcelas');
const inputDesconto = document.getElementById('input-desconto');
const btnAplicarDesconto = document.getElementById('btn-aplicar-desconto');

// Controle Parcelas
selectPagamento.addEventListener('change', () => {
    divParcelas.style.display = (selectPagamento.value === 'Crediário') ? 'block' : 'none';
});

// 1. CARREGAR DADOS
async function carregarDadosPDV() {
    try {
        const configSnap = await getDoc(doc(db, "configuracoes", "dados_loja"));
        if (configSnap.exists()) {
            const d = configSnap.data();
            NOME_LOJA = d.nome || "MINHA LOJA";
            CNPJ_LOJA = d.cnpj || "";
            TEL_LOJA = d.telefone || "";
            LOGO_LOJA = d.logo || null;
            SENHA_GERENTE = d.senhaGerente || "admin";
        }
        
        const qEstoque = await getDocs(collection(db, "produtos"));
        estoqueCompleto = [];
        qEstoque.forEach(d => { 
            const p = d.data(); 
            p.id = d.id; 
            if(!p.nome) p.nome = "Produto sem nome"; 
            estoqueCompleto.push(p); 
        });
        
        const qClientes = await getDocs(collection(db, "clientes"));
        clientesBase = [];
        qClientes.forEach(d => { 
            const c = d.data(); 
            c.id = d.id; 
            if(!c.nome) c.nome = "Cliente sem nome";
            clientesBase.push(c); 
        });

    } catch (e) { console.error("Erro ao carregar dados:", e); }
}
document.addEventListener('DOMContentLoaded', carregarDadosPDV);

// 2. BUSCA CLIENTE
inputBuscaCli.addEventListener('input', (e) => {
    const t = e.target.value.toLowerCase();
    if (!t) { listaResultadosCli.style.display = 'none'; return; }
    
    const f = clientesBase.filter(c => c.nome.toLowerCase().includes(t) || (c.cpf && c.cpf.includes(t)));
    listaResultadosCli.innerHTML = ''; 
    listaResultadosCli.style.display = 'block'; 
    
    if(f.length === 0) {
        listaResultadosCli.innerHTML = '<div style="padding:10px; color:#777;">Nenhum cliente encontrado.</div>';
        return;
    }

    f.forEach(c => {
        const d = document.createElement('div');
        d.style.cssText = 'padding:10px; cursor:pointer; border-bottom:1px solid #eee;';
        d.innerHTML = `<strong>${c.nome}</strong><br><small>${c.cpf || 'Sem CPF'}</small>`;
        d.onclick = () => { clienteSelecionado = c; inputBuscaCli.style.display='none'; listaResultadosCli.style.display='none'; displayCli.style.display='block'; nomeCliDisplay.innerText=c.nome; };
        listaResultadosCli.appendChild(d);
    });
});
btnRemoverCli.addEventListener('click', () => { clienteSelecionado = null; displayCli.style.display='none'; inputBuscaCli.style.display='block'; inputBuscaCli.value = ''; inputBuscaCli.focus(); });

// 3. BUSCA PRODUTO
inputBuscaProd.addEventListener('input', (e) => {
    const t = e.target.value.toLowerCase();
    if (!t) { listaResultadosProd.style.display = 'none'; listaResultadosProd.innerHTML = ''; return; }
    
    const res = estoqueCompleto.filter(p => p.nome.toLowerCase().includes(t));
    listaResultadosProd.innerHTML = '';
    listaResultadosProd.style.display = 'block';

    if (res.length === 0) {
        listaResultadosProd.innerHTML = '<div style="padding:10px; color:#777;">Produto não encontrado.</div>';
        return;
    }

    res.forEach(p => {
        let opts = ''; 
        if(p.grade) { p.grade.forEach((v,i) => { if(v.qtd > 0) opts += `<option value="${i}">${v.tamanho}-${v.cor} (${v.qtd})</option>`; }); }
        if(!opts) opts='<option disabled>Sem estoque</option>';
        
        const d = document.createElement('div'); d.className='produto-item';
        d.innerHTML = `
            <div class="produto-info"><h4>${p.nome}</h4><p>R$ ${p.precoVenda.toFixed(2)}</p></div>
            <div style="display:flex; gap:5px; align-items:center;">
                <select id="s-${p.id}" style="max-width: 150px;">${opts}</select>
                <button onclick="addCar('${p.id}')" style="background:#3498db; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">+</button>
            </div>
        `;
        listaResultadosProd.appendChild(d);
    });
});

window.addCar = function(id) {
    const p = estoqueCompleto.find(x => x.id === id);
    const sel = document.getElementById(`s-${id}`);
    if(!sel || sel.disabled || sel.value === "") { alert("Produto sem estoque ou variação inválida."); return; }
    const idx = sel.value; const v = p.grade[idx];
    
    carrinho.push({ 
        produtoId: p.id, 
        nome: p.nome, 
        precoUnitario: p.precoVenda, 
        precoCusto: p.precoCusto || 0, // <--- CORREÇÃO: AGORA SALVA O CUSTO!
        tamanho: v.tamanho, 
        cor: v.cor, 
        indexGrade: idx 
    });
    
    atualizarCarrinho();
    inputBuscaProd.value = ''; listaResultadosProd.style.display = 'none'; inputBuscaProd.focus();
};

function atualizarCarrinho() {
    divItensCarrinho.innerHTML = ''; totalBruto = 0;
    carrinho.forEach((item, i) => {
        totalBruto += item.precoUnitario;
        const d = document.createElement('div'); d.className = 'item-carrinho';
        d.innerHTML = `<div style="flex:1;"><strong>${item.nome}</strong> <small>${item.tamanho}/${item.cor}</small></div><div>R$ ${item.precoUnitario.toFixed(2)}</div><button onclick="rmItem(${i})" style="margin-left:10px;">X</button>`;
        divItensCarrinho.appendChild(d);
    });
    calcularTotais();
}

window.rmItem = function(i) { carrinho.splice(i, 1); atualizarCarrinho(); };

// 4. DESCONTO
btnAplicarDesconto.addEventListener('click', () => {
    descontoPorcentagem = parseFloat(inputDesconto.value) || 0;
    if (descontoPorcentagem < 0) descontoPorcentagem = 0;
    if (descontoPorcentagem > 100) descontoPorcentagem = 100;
    calcularTotais();
});

function calcularTotais() {
    const valorDesconto = totalBruto * (descontoPorcentagem / 100);
    totalLiquido = totalBruto - valorDesconto;
    
    let textoTotal = `R$ ${totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (descontoPorcentagem > 0) {
        textoTotal += ` <small style="color:red; font-size:14px;">(-${descontoPorcentagem}%)</small>`;
    }
    divTotalVenda.innerHTML = textoTotal;
}

// 5. CUPOM PDF
function gerarCupomPDF(itens, total, pgto, cli, vendedor, descPorc) {
    document.getElementById('cupom-nome-loja').innerText = NOME_LOJA;
    document.getElementById('cupom-info-loja').innerText = `CNPJ: ${CNPJ_LOJA} | ${TEL_LOJA}`;
    if (LOGO_LOJA) { const img = document.getElementById('cupom-logo'); img.src = LOGO_LOJA; img.style.display = 'block'; }
    document.getElementById('cupom-data').innerText = new Date().toLocaleDateString('pt-BR');
    document.getElementById('cupom-cliente').innerText = cli;
    document.getElementById('cupom-vendedor').innerText = vendedor;

    const tbody = document.getElementById('cupom-itens'); tbody.innerHTML = '';
    itens.forEach(i => tbody.innerHTML += `<tr><td>${i.nome} (${i.tamanho})</td><td style="text-align:right;">${i.precoUnitario.toFixed(2)}</td></tr>`);
    
    document.getElementById('cupom-total').innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('cupom-desc-info').innerText = descPorc > 0 ? `Desconto: ${descPorc}%` : '';

    const el = document.getElementById('cupom-fiscal');
    const opt = { margin: 0, filename: `Cupom_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: [80, 200] } };
    html2pdf().set(opt).from(el).save();
}

// 6. FINALIZAR VENDA
btnFinalizar.addEventListener('click', async () => {
    if (carrinho.length === 0) return alert("Carrinho vazio.");

    if (descontoPorcentagem > 0) {
        const senhaDigitada = prompt(`Aplicado desconto de ${descontoPorcentagem}%.\n\n⚠️ AUTORIZAÇÃO NECESSÁRIA:\nDigite a Senha de Gerente:`);
        if (senhaDigitada !== SENHA_GERENTE) {
            alert("Senha Incorreta! Venda cancelada.");
            return;
        }
    }

    const pgto = selectPagamento.value;
    const vendedor = localStorage.getItem('userName') || "Desconhecido";
    const vendedorRole = localStorage.getItem('userRole') || "vendedor";

    // Validação Crediário
    if (pgto === 'Crediário') {
        if (!clienteSelecionado) { alert("Selecione um cliente."); return; }
        let divida = 0;
        const qV = query(collection(db, "vendas"), where("clienteId", "==", clienteSelecionado.id), where("statusPagamento", "==", "Pendente"));
        const sV = await getDocs(qV); sV.forEach(d => divida += d.data().total);
        const qP = query(collection(db, "parcelas"), where("clienteId", "==", clienteSelecionado.id), where("status", "==", "Pendente"));
        const sP = await getDocs(qP); sP.forEach(d => divida += d.data().valor);
        if (totalLiquido > (clienteSelecionado.limiteCredito - divida)) {
            alert(`Limite Insuficiente! Disp: R$ ${(clienteSelecionado.limiteCredito - divida).toFixed(2)}`);
            return;
        }
    }

    btnFinalizar.innerText = "Processando...";
    btnFinalizar.disabled = true;

    try {
        const valorDescontoReal = totalBruto * (descontoPorcentagem / 100); // Calcula o valor

        const vendaRef = await addDoc(collection(db, "vendas"), {
            itens: carrinho,
            totalBruto: totalBruto,
            descontoPorcentagem: descontoPorcentagem,
            valorDesconto: valorDescontoReal, // <--- CORREÇÃO: AGORA SALVA O VALOR DO DESCONTO!
            total: totalLiquido,
            formaPagamento: pgto,
            clienteId: clienteSelecionado?.id || null, 
            clienteNome: clienteSelecionado?.nome || "Consumidor",
            vendedor: vendedor, 
            vendedorRole: vendedorRole,
            dataVenda: serverTimestamp(), 
            statusPagamento: pgto === 'Crediário' ? 'Pendente' : 'Pago'
        });

        if (pgto === 'Crediário') {
            const qtd = parseInt(selectQtdParcelas.value);
            const valParc = totalLiquido / qtd;
            for (let i = 1; i <= qtd; i++) {
                const dv = new Date(); dv.setDate(dv.getDate() + (30 * i));
                await addDoc(collection(db, "parcelas"), {
                    vendaId: vendaRef.id, clienteId: clienteSelecionado.id, numeroParcela: i,
                    valor: valParc, vencimento: dv, dataCompra: serverTimestamp(), status: 'Pendente'
                });
            }
        }

        for (const item of carrinho) {
            const p = estoqueCompleto.find(x => x.id === item.produtoId);
            p.grade[item.indexGrade].qtd -= 1; p.estoqueTotal -= 1;
            await updateDoc(doc(db, "produtos", item.produtoId), { grade: p.grade, estoqueTotal: p.estoqueTotal });
        }

        if (confirm("Venda Finalizada! Baixar PDF do Cupom?")) {
            gerarCupomPDF(carrinho, totalLiquido, pgto, clienteSelecionado?.nome || "Consumidor", vendedor, descontoPorcentagem);
        }
        setTimeout(() => location.reload(), 2000);

    } catch (e) { console.error(e); alert("Erro ao vender."); btnFinalizar.disabled = false; }
});