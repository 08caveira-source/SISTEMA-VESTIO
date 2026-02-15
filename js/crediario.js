import { db } from './firebase-config.js';
import { collection, getDocs, query, where, doc, updateDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const clienteId = params.get('id');

// Dados da Loja para o Recibo
let NOME_LOJA = "MINHA LOJA", CNPJ_LOJA = "", TEL_LOJA = "", LOGO_LOJA = null;
let vendaAtualParaPDF = null; // Guarda a venda aberta no modal

document.getElementById('btn-voltar').addEventListener('click', () => window.location.href = 'clientes.html');

if (!clienteId) {
    alert("Cliente não especificado.");
    window.location.href = 'clientes.html';
}

function formatarDataSegura(data) {
    if (!data) return '-';
    if (typeof data.toDate === 'function') return data.toDate().toLocaleDateString('pt-BR');
    try { return new Date(data).toLocaleDateString('pt-BR'); } catch (e) { return '-'; }
}

// 0. CARREGAR DADOS DA LOJA
async function carregarDadosLoja() {
    try {
        const configSnap = await getDoc(doc(db, "configuracoes", "dados_loja"));
        if (configSnap.exists()) {
            const d = configSnap.data();
            NOME_LOJA = d.nome || "MINHA LOJA";
            CNPJ_LOJA = d.cnpj || "";
            TEL_LOJA = d.telefone || "";
            LOGO_LOJA = d.logo || null;
        }
    } catch (e) { console.error("Erro config loja:", e); }
}

// 1. CARREGAR DADOS E SCORE
async function carregarDadosCliente() {
    await carregarDadosLoja(); // Garante que temos a logo
    try {
        const docSnap = await getDoc(doc(db, "clientes", clienteId));
        if (docSnap.exists()) {
            const cliente = docSnap.data();
            document.getElementById('info-cliente-container').style.display = 'flex';
            document.getElementById('nome-cliente-display').innerHTML = `${cliente.nome} <span id="score-display" style="font-size: 14px; background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 10px; margin-left: 10px;">⭐ Score: ${cliente.score || 100}</span>`;
            
            document.getElementById('cpf-cliente-display').innerText = cliente.cpf || '---';
            document.getElementById('telefone-cliente-display').innerText = cliente.telefone || '---';
            document.getElementById('endereco-cliente-display').innerText = cliente.endereco || '---';
            
            const limiteTotal = parseFloat(cliente.limiteCredito) || 0;
            document.getElementById('limite-cliente-display').innerText = limiteTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            calcularDividaReal(limiteTotal);
        }
    } catch (error) { console.error(error); }
}

// 2. CARREGAR TABELAS
async function carregarVendasEParcelas(limiteTotal) {
    const tabelaHistorico = document.getElementById('tabela-historico-compras');
    const tabelaParcelas = document.getElementById('tabela-parcelas');
    
    tabelaHistorico.innerHTML = '<tr><td colspan="5">Buscando...</td></tr>';
    tabelaParcelas.innerHTML = '<tr><td colspan="4">Buscando...</td></tr>';

    try {
        // --- TABELA DE VENDAS ---
        const qVendas = query(collection(db, "vendas"), where("clienteId", "==", clienteId));
        const snapVendas = await getDocs(qVendas);
        tabelaHistorico.innerHTML = ''; 

        if (snapVendas.empty) tabelaHistorico.innerHTML = '<tr><td colspan="5" style="text-align:center;">Sem histórico.</td></tr>';

        let vendas = [];
        snapVendas.forEach(d => vendas.push({ id: d.id, ...d.data() }));
        vendas.sort((a, b) => b.dataVenda - a.dataVenda);

        vendas.forEach(venda => {
            const dataVenda = formatarDataSegura(venda.dataVenda);
            let statusTexto = venda.statusPagamento || 'Pago';
            let statusClass = 'bg-pago'; 

            if (statusTexto === 'Pendente' || statusTexto === 'Parcelado') {
                statusClass = 'bg-pendente'; statusTexto = 'Parcelado'; 
            } else if (statusTexto === 'Quitado') {
                statusClass = 'bg-pago'; statusTexto = 'Quitado';
            }

            const tr = document.createElement('tr');
            // GUARDAMOS O ID DA VENDA NO BOTÃO PARA ABRIR OS DETALHES
            tr.innerHTML = `
                <td>${dataVenda}</td>
                <td>R$ ${venda.total.toFixed(2).replace('.', ',')}</td>
                <td>${venda.formaPagamento}</td>
                <td><span class="badge ${statusClass}">${statusTexto}</span></td>
                <td>
                    <button onclick="verDetalhesVenda('${venda.id}')" class="btn-pequeno btn-gerar" style="cursor: pointer;">Ver Itens</button>
                </td>
            `;
            tabelaHistorico.appendChild(tr);
        });

        // --- TABELA DE PARCELAS ---
        const qParcelas = query(collection(db, "parcelas"), where("clienteId", "==", clienteId), where("status", "==", "Pendente"));
        const snapParcelas = await getDocs(qParcelas);
        tabelaParcelas.innerHTML = '';

        if (snapParcelas.empty) tabelaParcelas.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #7f8c8d;">Nenhuma parcela em aberto.</td></tr>';

        snapParcelas.forEach(docParcela => {
            const parcela = docParcela.data();
            const idParcela = docParcela.id;
            const dataCompra = formatarDataSegura(parcela.dataCompra);
            const dataVenc = formatarDataSegura(parcela.vencimento);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>Compra em ${dataCompra}</td>
                <td>${dataVenc}</td>
                <td style="font-weight: bold; color: #c0392b;">R$ ${parcela.valor.toFixed(2).replace('.', ',')}</td>
                <td><button onclick="abrirModalPagamento('${idParcela}', ${parcela.valor}, '${parcela.vendaId}')" class="btn-pequeno btn-baixa">Receber</button></td>
            `;
            tabelaParcelas.appendChild(tr);
        });

    } catch (error) { console.error(error); }
}

async function calcularDividaReal(limiteTotal) {
    let divida = 0;
    const qP = query(collection(db, "parcelas"), where("clienteId", "==", clienteId), where("status", "==", "Pendente"));
    const sP = await getDocs(qP);
    sP.forEach(d => divida += d.data().valor);
    
    const disponivel = limiteTotal - divida;
    const elDisponivel = document.getElementById('limite-disponivel-display');
    elDisponivel.innerText = disponivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    elDisponivel.style.color = disponivel < 0 ? "red" : "#27ae60";

    carregarVendasEParcelas(limiteTotal);
}

// 3. VER DETALHES (ABRIR MODAL)
window.verDetalhesVenda = async function(idVenda) {
    try {
        const docRef = doc(db, "vendas", idVenda);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const venda = docSnap.data();
            vendaAtualParaPDF = venda; // Salva para usar no PDF

            // Preenche Cabeçalho do Modal
            document.getElementById('detalhe-vendedor').innerText = venda.vendedor || 'Desconhecido';
            document.getElementById('detalhe-data').innerText = formatarDataSegura(venda.dataVenda);
            
            // Preenche Itens
            const lista = document.getElementById('lista-itens-venda');
            lista.innerHTML = '';
            
            if (venda.itens) {
                venda.itens.forEach(item => {
                    lista.innerHTML += `
                        <tr>
                            <td>${item.nome} (${item.tamanho})</td>
                            <td style="text-align: right;">R$ ${item.precoUnitario.toFixed(2)}</td>
                        </tr>
                    `;
                });
            }

            // Preenche Totais
            // Se tiver desconto novo
            if (venda.descontoPorcentagem > 0) {
                document.getElementById('detalhe-subtotal').innerText = (venda.totalBruto || venda.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                document.getElementById('detalhe-desconto-linha').innerText = `Desconto: -${venda.descontoPorcentagem}% (R$ ${(venda.valorDesconto||0).toFixed(2)})`;
            } else {
                document.getElementById('detalhe-subtotal').innerText = venda.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                document.getElementById('detalhe-desconto-linha').innerText = "";
            }

            document.getElementById('detalhe-total').innerText = venda.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            // Abre Modal
            document.getElementById('modal-detalhes').style.display = 'flex';
        }
    } catch (e) { console.error(e); alert("Erro ao carregar detalhes."); }
};

// 4. EMITIR SEGUNDA VIA (PDF)
document.getElementById('btn-segunda-via').addEventListener('click', () => {
    if (!vendaAtualParaPDF) return;
    const v = vendaAtualParaPDF;

    // Preenche o Modelo Invisível
    document.getElementById('cupom-nome-loja').innerText = NOME_LOJA;
    document.getElementById('cupom-info-loja').innerText = `CNPJ: ${CNPJ_LOJA} | ${TEL_LOJA}`;
    if (LOGO_LOJA) { const img = document.getElementById('cupom-logo'); img.src = LOGO_LOJA; img.style.display = 'block'; }
    
    document.getElementById('cupom-data').innerText = formatarDataSegura(v.dataVenda);
    document.getElementById('cupom-cliente').innerText = v.clienteNome || "Cliente";
    document.getElementById('cupom-vendedor').innerText = v.vendedor || "-";

    const tbody = document.getElementById('cupom-itens'); tbody.innerHTML = '';
    v.itens.forEach(i => tbody.innerHTML += `<tr><td>${i.nome} (${i.tamanho})</td><td style="text-align:right;">${i.precoUnitario.toFixed(2)}</td></tr>`);
    
    document.getElementById('cupom-total').innerText = v.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('cupom-desc-info').innerText = (v.descontoPorcentagem > 0) ? `Desconto Aplicado: ${v.descontoPorcentagem}%` : '';

    // Gera PDF
    const el = document.getElementById('cupom-fiscal');
    const opt = { margin: 0, filename: `SegundaVia_${v.dataVenda.seconds}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: [80, 200] } };
    html2pdf().set(opt).from(el).save();
});

// 5. PAGAMENTO PARCELA
let parcelaParaPagarId = null, vendaAssociadaId = null;

window.abrirModalPagamento = function(id, valor, vendaId) {
    parcelaParaPagarId = id; vendaAssociadaId = vendaId;
    document.getElementById('modal-valor-parcela').innerText = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('modal-pagamento').style.display = 'flex';
};

document.getElementById('btn-confirmar-pgto').addEventListener('click', async () => {
    if (!parcelaParaPagarId) return;
    const btn = document.getElementById('btn-confirmar-pgto');
    btn.innerText = "Processando..."; btn.disabled = true;

    try {
        await updateDoc(doc(db, "parcelas", parcelaParaPagarId), { status: "Pago", dataPagamento: serverTimestamp() });

        if (vendaAssociadaId) {
            const qRestantes = query(collection(db, "parcelas"), where("vendaId", "==", vendaAssociadaId), where("status", "==", "Pendente"));
            const snapRestantes = await getDocs(qRestantes);
            const pendentes = snapRestantes.docs.filter(d => d.id !== parcelaParaPagarId);

            if (pendentes.length === 0) {
                await updateDoc(doc(db, "vendas", vendaAssociadaId), { statusPagamento: "Quitado" });
                alert("Pagamento confirmado! Venda quitada.");
            } else { alert("Pagamento confirmado!"); }
        } else { alert("Pagamento confirmado!"); }

        document.getElementById('modal-pagamento').style.display = 'none';
        location.reload();
    } catch (error) { console.error("Erro pgto:", error); alert("Erro ao processar."); } 
    finally { btn.innerText = "Confirmar"; btn.disabled = false; }
});

document.addEventListener('DOMContentLoaded', carregarDadosCliente);