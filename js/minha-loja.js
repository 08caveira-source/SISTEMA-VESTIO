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
const nomeInput = document.getElementById('loja-nome');
const cnpjInput = document.getElementById('loja-cnpj');
const telInput = document.getElementById('loja-tel');
const senhaGerenteInput = document.getElementById('senha-gerente');
let logoBase64 = ""; // Supondo que você captura isso no seu front-end

async function carregarDados() {
    try {
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
            const d = docSnap.data();
            if(nomeInput) nomeInput.value = d.nome || '';
            if(cnpjInput) cnpjInput.value = d.cnpj || '';
            if(telInput) telInput.value = d.telefone || '';
            if(senhaGerenteInput) senhaGerenteInput.value = d.senhaGerente || 'admin';
            
            // Carrega os campos da integração, caso existam no HTML
            if(document.getElementById('ecom-plataforma')) {
                document.getElementById('ecom-plataforma').value = d.ecom_plataforma || 'nenhuma';
                document.getElementById('ecom-url').value = d.ecom_url || '';
                document.getElementById('ecom-key').value = d.ecom_key || '';
                document.getElementById('ecom-secret').value = d.ecom_secret || '';
            }
        }
    } catch (error) { console.error("Erro ao carregar dados:", error); }
}

document.getElementById('form-loja')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await setDoc(configRef, {
            nome: nomeInput ? nomeInput.value : '',
            cnpj: cnpjInput ? cnpjInput.value : '',
            telefone: telInput ? telInput.value : '',
            logo: logoBase64,
            senhaGerente: senhaGerenteInput ? senhaGerenteInput.value : '',
            
            // Salva as integrações
            ecom_plataforma: document.getElementById('ecom-plataforma') ? document.getElementById('ecom-plataforma').value : 'nenhuma',
            ecom_url: document.getElementById('ecom-url') ? document.getElementById('ecom-url').value : '',
            ecom_key: document.getElementById('ecom-key') ? document.getElementById('ecom-key').value : '',
            ecom_secret: document.getElementById('ecom-secret') ? document.getElementById('ecom-secret').value : ''
        }, { merge: true });
        
        alert("Salvo com sucesso!");
    } catch (error) { console.error("Erro ao salvar dados:", error); }
});

// Inicializa a carga de dados
carregarDados();