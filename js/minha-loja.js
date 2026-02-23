import { db, auth } from './firebase-config.js';
import { getDocRef } from './saas-utils.js'; // SAAS IMPORT
import { getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOut(auth); localStorage.clear(); window.location.href = "../login.html";
});

// SAAS: Referência dinâmica
// Nota: getDocRef chama a função mas ela precisa ser chamada dentro de uma função async ou no momento do uso se o localStorage já estiver carregado.
// Como o script roda DEPOIS do login, o localStorage já tem o ID.
let configRef;
try {
    configRef = getDocRef("configuracoes", "dados_loja");
} catch (e) {
    // Se não tiver ID (ex: acessou direto), volta pro login
    window.location.href = "../login.html";
}

// ... (Variáveis de input iguais) ...

async function carregarDados() {
    try {
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
            // ... (Preenche campos igual) ...
        }
    } catch (error) { console.error("Erro:", error); }
}

document.getElementById('form-loja').addEventListener('submit', async (e) => {
    e.preventDefault();
    // ...
    try {
        await setDoc(configRef, {
            nome: nomeInput.value,
            cnpj: cnpjInput.value,
            telefone: telInput.value,
            logo: logoBase64,
            senhaGerente: senhaGerenteInput.value
        });
        alert("Salvo!");
    } catch (error) { console.error(error); }
    // ...
});