// Importa o auth do ficheiro de configuração que já criámos
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Verifica o estado da autenticação
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Se não houver utilizador (user é null), significa que não iniciou sessão.
        // Redirecionamos de volta para o ecrã de login (index.html).
        // Como este script vai rodar dentro da pasta 'pages', usamos '../' para voltar uma pasta.
        window.location.href = "../index.html";
    } else {
        // Se o utilizador existir, permitimos que a página carregue normalmente.
        // Aqui também podemos recuperar o nome do utilizador do localStorage para exibir no ecrã.
        const userName = localStorage.getItem('userName') || "Utilizador";
        const role = localStorage.getItem('userRole') || "vendedor";
        
        console.log(`Bem-vindo, ${userName}. Nível de acesso: ${role}`);
    }
});