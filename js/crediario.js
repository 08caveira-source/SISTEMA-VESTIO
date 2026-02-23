import { db } from './firebase-config.js';
import { getColRef, getDocRef, validarSenhaMaster } from './saas-utils.js';
import { getDocs, query, where, updateDoc, getDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const clienteId = params.get('id');

let NOME_LOJA = "MINHA LOJA", CNPJ_LOJA = "", TEL_LOJA = "", LOGO_LOJA = null;
let vendaAtualParaPDF = null;

if (!clienteId) {
    alert("Cliente não especificado.");
    window.location.href = 'clientes.html';
}

document.getElementById('btn-voltar').addEventListener('click', () => window.location.href = 'clientes.html');

document.addEventListener('DOMContentLoaded', async () => {
    await carregarConfigLoja();
    carregarDadosCliente();
});

// FUNÇÕES AUXILIARES DE DATA
function formatarData(data) {
    if (!data) return '-';
    try {
        if (typeof data.toDate === 'function') return data.toDate().toLocaleDateString('pt-BR');
        return new Date(data).toLocaleDateString('pt-BR');
    } catch (e) { return '-'; }
}

function formatarDataHora(data) {
    if (!data) return '-';
    try {
        if (typeof data.toDate === 'function') return data.toDate().toLocaleString('pt-BR');
        return new Date(data).toLocaleString('pt-BR');
    } catch (e) { return '-'; }
}

async function carregarConfigLoja() {
    try {
        const snap = await getDoc(getDocRef("configuracoes", "dados_loja"));
        if (snap.exists()) {
            const d = snap.data();
            NOME_LOJA = d.nome; CNPJ_LOJA = d.cnpj; TEL_LOJA = d.telefone; LOGO_LOJA = d.logo;
        }
    } catch (e) { console.error(e); }
}

async function carregarDadosCliente() {
    try {
        const docSnap = await getDoc(getDocRef("clientes", clienteId));
        if (docSnap.exists()) {
            const c = docSnap.data();
            document.getElementById('info-cliente-container').style.display = 'flex';
            document.getElementById('nome-cliente-display').innerHTML = `${c.nome} <span style="font-size:14px; background:rgba(0,0,0,0.2); padding:2px 8px; border-radius:10px;">⭐ Score: ${c.score || 100}</span>`;
            document.getElementById('cpf-cliente-display').innerText = c.cpf || '-';
            document.getElementById('telefone-cliente-display').innerText = c.telefone || '-';
            
            const limite = parseFloat(c.limiteCredito) || 0;
            document.getElementById('limite-cliente-display').innerText = limite.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            calcularDivida(limite);
        }
    } catch (error) { console.error(error); }
}

async function calcularDivida(limite) {
    let divida = 0;
    const q = query(getColRef("parcelas"), where("clienteId", "==", clienteId), where("status", "==", "Pendente"));
    const snap = await getDocs(q);
    snap.forEach(d => divida += d.data().valor);
    
    const disponivel = limite - divida;
    document.getElementById('limite-disponivel-display').innerText = disponivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    carregarTabelas();
}

async function carregarTabelas() {
    // 1. HISTÓRICO DE COMPRAS
    const tbVendas = document.getElementById('tabela-historico-compras');
    tbVendas.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando...</td></tr>';
    
    // Pegando todas as vendas e ordenando no JS para evitar erro de índice
    const qVendas = query(getColRef("vendas"), where("clienteId", "==", clienteId));
    const snapVendas = await getDocs(qVendas);
    
    tbVendas.innerHTML = '';
    if(snapVendas.empty) {
        tbVendas.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhuma compra.</td></tr>';
    } else {
        let vendasLista = [];
        snapVendas.forEach(docSnap => vendasLista.push({ id: docSnap.id, ...docSnap.data() }));
        
        // Ordena por data (mais recente primeiro)
        vendasLista.sort((a, b) => b.dataVenda.toDate() - a.dataVenda.toDate());

        vendasLista.forEach(v => {
            let statusBadge = v.statusPagamento === 'Quitado' ? 
                '<span class="badge bg-pago">Quitado</span>' : 
                '<span class="badge bg-pendente">Aberto</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatarData(v.dataVenda)}</td>
                <td>R$ ${v.total.toFixed(2)}</td>
                <td>${v.formaPagamento}</td>
                <td>${statusBadge}</td>
                <td>
                    <button onclick="window.verDetalhes('${v.id}')" class="btn-pequeno btn-gerar">Ver</button>
                </td>
            `;
            tbVendas.appendChild(tr);
        });
    }

    // 2. PARCELAS EM ABERTO (A Receber)
    const tbParcelas = document.getElementById('tabela-parcelas');
    tbParcelas.innerHTML = '<tr><td colspan="3" style="text-align:center">Carregando...</td></tr>';

    const qParcelas = query(getColRef("parcelas"), where("clienteId", "==", clienteId), where("status", "==", "Pendente"));
    const snapParcelas = await getDocs(qParcelas);

    tbParcelas.innerHTML = '';
    if(snapParcelas.empty) {
        tbParcelas.innerHTML = '<tr><td colspan="3" style="text-align:center">Nada a receber.</td></tr>';
    } else {
        let parcelasAbertas = [];
        snapParcelas.forEach(docSnap => parcelasAbertas.push({ id: docSnap.id, ...docSnap.data() }));
        
        // Ordena vencimento mais próximo
        parcelasAbertas.sort((a, b) => a.vencimento.toDate() - b.vencimento.toDate());

        parcelasAbertas.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatarData(p.vencimento)}</td>
                <td style="color:#FF453A; font-weight:bold;">R$ ${p.valor.toFixed(2)}</td>
                <td><button onclick="window.pagarParcela('${p.id}', ${p.valor}, '${p.vendaId}')" class="btn-pequeno btn-baixa">Receber</button></td>
            `;
            tbParcelas.appendChild(tr);
        });
    }

    // 3. ÚLTIMOS PAGAMENTOS (Pagas)
    const tbPagos = document.getElementById('tabela-pagos');
    if (tbPagos) {
        tbPagos.innerHTML = '<tr><td colspan="3" style="text-align:center">Carregando...</td></tr>';
        
        // CORREÇÃO DO ERRO: Busca simples, ordenação feita no JS
        const qPagos = query(getColRef("parcelas"), where("clienteId", "==", clienteId), where("status", "==", "Pago"));
        
        try {
            const snapPagos = await getDocs(qPagos);
            tbPagos.innerHTML = '';
            
            if(snapPagos.empty) {
                tbPagos.innerHTML = '<tr><td colspan="3" style="text-align:center">Nenhum pagamento recente.</td></tr>';
            } else {
                let parcelasPagas = [];
                snapPagos.forEach(docSnap => parcelasPagas.push(docSnap.data()));
                
                // Ordena no JS (mais recentes primeiro)
                parcelasPagas.sort((a, b) => b.dataPagamento.toDate() - a.dataPagamento.toDate());
                
                // Mostra as 10 últimas pagas
                parcelasPagas.slice(0, 10).forEach(p => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${formatarDataHora(p.dataPagamento)}</td>
                        <td style="color:#30D158; font-weight:bold;">R$ ${p.valor.toFixed(2)}</td>
                        <td><span class="badge bg-pago">Pago</span></td>
                    `;
                    tbPagos.appendChild(tr);
                });
            }
        } catch (e) {
            console.error("Erro ao carregar pagos:", e);
            tbPagos.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#FF453A;">Erro ao carregar.</td></tr>';
        }
    }
}

// JANELA DE PAGAMENTO
window.pagarParcela = function(id, valor, vendaId) {
    document.getElementById('modal-valor-parcela').innerText = valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    document.getElementById('modal-pagamento').style.display = 'flex';
    
    const btnConfirmar = document.getElementById('btn-confirmar-pgto');
    const novoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(novoBtn, btnConfirmar);
    
    novoBtn.addEventListener('click', async () => {
        novoBtn.innerText = "Processando...";
        novoBtn.disabled = true;
        
        try {
            await updateDoc(getDocRef("parcelas", id), { 
                status: "Pago", 
                dataPagamento: serverTimestamp() 
            });
            
            const qRestantes = query(getColRef("parcelas"), where("vendaId", "==", vendaId), where("status", "==", "Pendente"));
            const snapRestantes = await getDocs(qRestantes);
            const pendentesReais = snapRestantes.docs.filter(d => d.id !== id);

            if(pendentesReais.length === 0) {
                await updateDoc(getDocRef("vendas", vendaId), { statusPagamento: "Quitado" });
                Swal.fire('Quitado!', 'Esta foi a última parcela.', 'success');
            } else {
                Swal.fire('Sucesso', 'Pagamento registrado.', 'success');
            }
            
            document.getElementById('modal-pagamento').style.display = 'none';
            location.reload(); 

        } catch(e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao baixar parcela.', 'error');
        } finally {
            novoBtn.innerText = "Confirmar";
            novoBtn.disabled = false;
        }
    });
}

// VER DETALHES
window.verDetalhes = async function(id) {
    const snap = await getDoc(getDocRef("vendas", id));
    if(snap.exists()) {
        const v = snap.data();
        vendaAtualParaPDF = v;
        
        document.getElementById('detalhe-vendedor').innerText = v.vendedor || '-';
        const lista = document.getElementById('lista-itens-venda'); 
        lista.innerHTML = '';
        
        if (v.itens) {
            v.itens.forEach(i => lista.innerHTML += `<tr><td>${i.nome}</td><td style="text-align:right;">R$ ${i.precoUnitario.toFixed(2)}</td></tr>`);
        }
        
        document.getElementById('detalhe-total').innerText = v.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
        document.getElementById('modal-detalhes').style.display = 'flex';
    }
}

// PDF 2ª VIA
document.getElementById('btn-segunda-via').addEventListener('click', () => {
    if(!vendaAtualParaPDF) return;
    const v = vendaAtualParaPDF;
    
    document.getElementById('cupom-nome-loja').innerText = NOME_LOJA;
    document.getElementById('cupom-info-loja').innerText = `CNPJ: ${CNPJ_LOJA} | ${TEL_LOJA}`;
    if(LOGO_LOJA) { 
        const i = document.getElementById('cupom-logo'); 
        i.src = LOGO_LOJA; 
        i.style.display = 'block'; 
    }
    
    document.getElementById('cupom-data').innerText = formatarData(v.dataVenda);
    document.getElementById('cupom-cliente').innerText = v.clienteNome;
    
    const tb = document.getElementById('cupom-itens'); 
    tb.innerHTML = '';
    if (v.itens) {
        v.itens.forEach(i => tb.innerHTML += `<tr><td>${i.nome}</td><td style="text-align:right;">${i.precoUnitario.toFixed(2)}</td></tr>`);
    }
    
    document.getElementById('cupom-total').innerText = v.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    
    const el = document.getElementById('cupom-fiscal');
    const opt = { 
        margin: 0, 
        filename: `Recibo_${Date.now()}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2 }, 
        jsPDF: { unit: 'mm', format: [80, 200] } 
    };
    html2pdf().set(opt).from(el).save();
});