import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Páginas proibidas para Vendedor
const paginasProibidasVendedor = [
    'usuarios.html',
    'minha-loja.html', 
    'relatorios.html'
];

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "../index.html";
    } else {
        verificarPermissoes();
        configurarMenuMobile(); // <--- NOVIDADE
    }
});

function verificarPermissoes() {
    const role = localStorage.getItem('userRole'); 
    const paginaAtual = window.location.pathname.split("/").pop();

    // Bloqueio de Acesso
    if (role === 'vendedor' && paginasProibidasVendedor.includes(paginaAtual)) {
        alert("Acesso Negado: Apenas gerentes podem acessar esta tela.");
        window.location.href = 'dashboard.html';
        return;
    }

    // Esconder menus restritos
    if (role === 'vendedor') {
        const style = document.createElement('style');
        style.innerHTML = `
            a[href="usuarios.html"], a[href="minha-loja.html"], a[href="relatorios.html"] { display: none !important; }
            .admin-only { display: none !important; }
        `;
        document.head.appendChild(style);
    }
}

// ===============================================
// LÓGICA DO MENU MOBILE (INJETADO AUTOMATICAMENTE)
// ===============================================
function configurarMenuMobile() {
    // 1. Encontra o Header e o Menu Lateral
    const header = document.querySelector('header');
    const menuLateral = document.querySelector('.menu-lateral');

    if (header && menuLateral) {
        // 2. Cria o Botão Hambúrguer
        const btnMenu = document.createElement('button');
        btnMenu.innerHTML = "☰";
        btnMenu.style.cssText = `
            background: transparent; 
            border: none; 
            color: white; 
            font-size: 24px; 
            cursor: pointer; 
            margin-right: 15px;
            display: none; /* Escondido no Desktop */
        `;
        
        // Só mostra o botão se a tela for pequena (controle via JS ou CSS media query)
        // Vamos forçar via CSS no Globais, ou aqui:
        if (window.innerWidth <= 768) {
            btnMenu.style.display = 'block';
        }
        
        // Adiciona o botão no início do Header
        header.insertBefore(btnMenu, header.firstChild);

        // 3. Ação de Clique (Abrir/Fechar)
        btnMenu.addEventListener('click', () => {
            menuLateral.classList.toggle('menu-aberto');
        });

        // 4. Fechar menu ao clicar em um link (Melhor experiência)
        const links = menuLateral.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', () => {
                menuLateral.classList.remove('menu-aberto');
            });
        });
        
        // Listener para resize (caso vire a tela)
        window.addEventListener('resize', () => {
            btnMenu.style.display = window.innerWidth <= 768 ? 'block' : 'none';
            if (window.innerWidth > 768) menuLateral.classList.remove('menu-aberto');
        });
    }
}

import { onSnapshot, query, where, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from './firebase-config.js';

// Função para escutar pedidos online de forma global
function iniciarNotificacoesGlobais() {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) return;

    // Referência à coleção de vendas online da empresa atual
    const pedidosRef = collection(db, "empresas", empresaId, "vendas_online");
    const q = query(pedidosRef, where("status_integracao", "==", "pendente"));

    let isInitialLoad = true;

    onSnapshot(q, (snapshot) => {
        if (isInitialLoad) {
            isInitialLoad = false;
            return; // Evita que dispare alertas dos pedidos que já estavam pendentes ao fazer login
        }

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const pedido = change.doc.data();
                
                // Dispara a notificação visual e sonora em qualquer ecrã do sistema
                if (window.Swal) {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: `🛒 Nova venda online! Cliente: ${pedido.clienteNome}`,
                        text: 'Vá a "Pedidos Online" para separar o stock.',
                        showConfirmButton: true,
                        confirmButtonText: 'Ver Pedido',
                        timer: 10000,
                        timerProgressBar: true,
                        background: '#1e293b',
                        color: '#fff',
                        iconColor: '#27ae60'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            window.location.href = "online.html";
                        }
                    });
                }
                
                // Opcional: Tocar um pequeno som de notificação (Beep)
                try {
                    const audio = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'); 
                    // Nota: Substituir o base64 acima por um MP3 real de "ding" curto se desejar som.
                    // audio.play();
                } catch(e){}
            }
        });
    });
}

// Inicia as notificações assim que o auth-guard validar a sessão
setTimeout(iniciarNotificacoesGlobais, 2000);