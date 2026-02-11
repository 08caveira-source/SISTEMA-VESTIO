import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. DADOS DO USUÁRIO E LOGOUT (Já tínhamos)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const nomeSpan = document.getElementById('nome-utilizador');
    const userName = localStorage.getItem('userName');
    
    if (userName) {
        nomeSpan.innerText = `Olá, ${userName}`;
    } else {
        nomeSpan.innerText = "Olá, Vendedor";
    }

    // Chama a função para carregar os números mágicos assim que a página abre!
    carregarMetricasDoDashboard();
});

const btnLogout = document.getElementById('btn-logout');
btnLogout.addEventListener('click', async () => {
    try {
        await signOut(auth);
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        window.location.href = "../index.html";
    } catch (error) {
        console.error("Erro ao terminar sessão: ", error);
        alert("Erro ao tentar sair do sistema.");
    }
});

// ==========================================
// 2. BUSCAR E CALCULAR AS MÉTRICAS
// ==========================================
async function carregarMetricasDoDashboard() {
    const cardVendasHoje = document.getElementById('card-vendas-hoje');
    const cardCrediario = document.getElementById('card-crediario-pendente');
    const cardTotalPecas = document.getElementById('card-total-pecas');

    try {
        // --- MÉTRICA 1: Vendas de Hoje ---
        // Pega a data de hoje, zera as horas, minutos e segundos para comparar
        const inicioDoDia = new Date();
        inicioDoDia.setHours(0, 0, 0, 0);

        const qVendas = query(collection(db, "vendas"), where("dataVenda", ">=", inicioDoDia));
        const snapshotVendas = await getDocs(qVendas);
        
        let totalVendasHoje = 0;
        snapshotVendas.forEach(doc => {
            totalVendasHoje += doc.data().total;
        });

        cardVendasHoje.innerText = totalVendasHoje.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // --- MÉTRICA 2: Crediário Pendente (Total na Rua) ---
        // Busca todas as parcelas que estão com status 'Pendente'
        const qParcelas = query(collection(db, "parcelas"), where("status", "==", "Pendente"));
        const snapshotParcelas = await getDocs(qParcelas);
        
        let totalCrediario = 0;
        snapshotParcelas.forEach(doc => {
            totalCrediario += doc.data().valor;
        });

        cardCrediario.innerText = totalCrediario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // --- MÉTRICA 3: Total de Peças em Estoque ---
        // Varre os produtos e soma o "estoqueTotal"
        const snapshotProdutos = await getDocs(collection(db, "produtos"));
        
        let totalPecas = 0;
        snapshotProdutos.forEach(doc => {
            totalPecas += doc.data().estoqueTotal || 0;
        });

        cardTotalPecas.innerText = `${totalPecas} un.`;

    } catch (error) {
        console.error("Erro ao carregar as métricas:", error);
        cardVendasHoje.innerText = "Erro";
        cardCrediario.innerText = "Erro";
        cardTotalPecas.innerText = "Erro";
    }
}