import { db, auth } from './firebase-config.js';
import { getColRef, getDocRef } from './saas-utils.js';
import { getDocs, query, where, doc, getDoc, addDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) return window.location.href = "../index.html";
    
    document.getElementById('nome-utilizador').innerText = localStorage.getItem('VESTIO_USER_NAME') || 'Admin';

    carregarPedidosOnline();

    // Botão Simulador
    document.getElementById('btn-simular-pedido').addEventListener('click', () => simularPedido(empresaId));

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await signOut(auth); localStorage.clear(); window.location.href = "../index.html";
    });
});

// 1. CARREGAR PEDIDOS PENDENTES DA NUVEM (CORREÇÃO DE ÍNDICE APLICADA)
async function carregarPedidosOnline() {
    const tbody = document.getElementById('lista-pedidos-online');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Buscando pedidos...</td></tr>';

    try {
        // Tira o orderBy da consulta para evitar erro no Firebase
        const q = query(getColRef("vendas_online"), where("status_integracao", "==", "pendente"));
        const snap = await getDocs(q);

        tbody.innerHTML = '';
        if(snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#27ae60;">🎉 Nenhum pedido pendente! Tudo atualizado.</td></tr>';
            return;
        }

        // Armazena os resultados para ordenar localmente
        let pedidos = [];
        snap.forEach(docSnap => {
            pedidos.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Ordena no JavaScript (do mais antigo para o mais novo)
        pedidos.sort((a, b) => a.dataPedido.toDate() - b.dataPedido.toDate());

        pedidos.forEach(p => {
            // Monta resumo dos itens
            let resumoItens = '';
            if(p.itens) p.itens.forEach(i => resumoItens += `${i.qtd}x ${i.nome}<br>`);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(p.dataPedido.toDate()).toLocaleString('pt-BR')}</td>
                <td><strong style="color:white">${p.clienteNome}</strong></td>
                <td style="font-size: 12px; color: #94a3b8;">${resumoItens}</td>
                <td style="color:#64D2FF; font-weight:bold;">R$ ${p.total.toFixed(2)}</td>
                <td><span class="badge" style="background:rgba(155, 89, 182, 0.2); color:#9b59b6;">Site (Pago)</span></td>
                <td style="display:flex; gap:10px;">
                    <button onclick="window.aprovarPedido('${p.id}')" style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">Aprovar & Faturar</button>
                    <button onclick="window.rejeitarPedido('${p.id}')" style="background:none; border:1px solid #FF453A; color:#FF453A; padding:8px 15px; border-radius:6px; cursor:pointer;">Cancelar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#FF453A;">Erro ao carregar pedidos. Verifique o console.</td></tr>';
    }
}

// 2. SIMULADOR DE PEDIDO DO SITE (MOCK)
async function simularPedido(empresaId) {
    Swal.fire({ title: 'Simulando...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background:'#1e293b', color:'#fff' });
    
    try {
        // Pega um produto real do estoque para simular a compra
        const snapProd = await getDocs(query(getColRef("produtos")));
        if(snapProd.empty) return Swal.fire({title: 'Atenção', text: 'Cadastre um produto no estoque físico primeiro!', icon: 'warning', background:'#1e293b', color:'#fff'});
        
        const prod = snapProd.docs[0].data();
        const prodId = snapProd.docs[0].id;

        // Cria o pedido na "caixa de entrada"
        await addDoc(getColRef("vendas_online"), {
            origem: 'Simulador Loja Virtual',
            status_integracao: 'pendente', // Gatilho principal
            dataPedido: Timestamp.now(),
            clienteNome: "Cliente do Site " + Math.floor(Math.random() * 1000),
            total: parseFloat(prod.precoVenda),
            formaPagamento: 'Cartão de Crédito (Site)',
            itens: [{
                id: prodId,
                nome: prod.nome,
                precoUnitario: parseFloat(prod.precoVenda),
                qtd: 1,
                custo: prod.precoCusto || 0
            }]
        });

        Swal.fire({title: 'Novo Pedido!', text: 'Alguém acabou de "comprar" no seu site. Veja a lista.', icon: 'success', background:'#1e293b', color:'#fff'});
        carregarPedidosOnline();
    } catch(e) {
        console.error(e);
        Swal.fire({title: 'Erro', text: 'Falha ao simular.', icon: 'error', background:'#1e293b', color:'#fff'});
    }
}

// 3. APROVAR PEDIDO (Gera venda financeira e abaixa estoque físico)
window.aprovarPedido = async function(pedidoId) {
    const { isConfirmed } = await Swal.fire({
        title: 'Aprovar Pedido?',
        text: "Isso vai debitar o estoque e gerar uma Venda no sistema.",
        icon: 'question',
        showCancelButton: true,
        background: '#1e293b', color: '#fff',
        confirmButtonText: 'Sim, faturar'
    });

    if(!isConfirmed) return;

    try {
        Swal.fire({ title: 'Faturando...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background:'#1e293b', color:'#fff' });

        const pedidoRef = getDocRef("vendas_online", pedidoId);
        const pedidoSnap = await getDoc(pedidoRef);
        const pedido = pedidoSnap.data();

        // 3.1 Registra a Venda no fluxo normal da loja física
        await addDoc(getColRef("vendas"), {
            dataVenda: Timestamp.now(),
            clienteNome: pedido.clienteNome,
            clienteId: null, // Pode ser vinculado futuramente se criar conta pro cliente
            itens: pedido.itens,
            subtotal: pedido.total,
            desconto: 0,
            total: pedido.total,
            formaPagamento: pedido.formaPagamento,
            statusPagamento: 'Pago',
            vendedor: 'Sistema (Integração Site)'
        });

        // 3.2 Abate o Estoque
        for (const item of pedido.itens) {
            const prodRef = getDocRef("produtos", item.id);
            const pSnap = await getDoc(prodRef);
            if(pSnap.exists()) {
                const estoqueAtual = pSnap.data().estoqueTotal || 0;
                await updateDoc(prodRef, { estoqueTotal: Math.max(0, estoqueAtual - item.qtd) });
            }
        }

        // 3.3 Marca o pedido como Concluído para sumir da fila
        await updateDoc(pedidoRef, { status_integracao: 'aprovado' });

        Swal.fire({title: 'Sucesso!', text: 'Estoque baixado e venda registrada nos relatórios.', icon: 'success', background:'#1e293b', color:'#fff'});
        carregarPedidosOnline();

    } catch(e) {
        console.error(e);
        Swal.fire({title: 'Erro', text: 'Falha ao faturar.', icon: 'error', background:'#1e293b', color:'#fff'});
    }
}

// 4. REJEITAR PEDIDO
window.rejeitarPedido = async function(pedidoId) {
    const { isConfirmed } = await Swal.fire({
        title: 'Cancelar Pedido?',
        text: "O estoque não será alterado e a venda será ignorada.",
        icon: 'warning',
        showCancelButton: true,
        background: '#1e293b', color: '#fff',
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sim, cancelar'
    });

    if(isConfirmed) {
        await updateDoc(getDocRef("vendas_online", pedidoId), { status_integracao: 'rejeitado' });
        carregarPedidosOnline();
    }
}