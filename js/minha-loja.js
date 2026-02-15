import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOut(auth); localStorage.clear(); window.location.href = "../index.html";
});

// Referência do documento único
const configRef = doc(db, "configuracoes", "dados_loja");

// Elementos
const nomeInput = document.getElementById('nome-loja');
const cnpjInput = document.getElementById('cnpj-loja');
const telInput = document.getElementById('tel-loja');
const senhaGerenteInput = document.getElementById('senha-gerente'); // CAMPO NOVO
const inputLogo = document.getElementById('input-logo');
const imgPreview = document.getElementById('img-preview');
const textPreview = document.getElementById('text-preview');
let logoBase64 = null;

// 1. CARREGAR DADOS
async function carregarDados() {
    try {
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
            const dados = docSnap.data();
            nomeInput.value = dados.nome || '';
            cnpjInput.value = dados.cnpj || '';
            telInput.value = dados.telefone || '';
            senhaGerenteInput.value = dados.senhaGerente || ''; // CARREGA A SENHA
            
            if (dados.logo) {
                logoBase64 = dados.logo;
                imgPreview.src = dados.logo;
                imgPreview.style.display = 'block';
                textPreview.style.display = 'none';
            }
        }
    } catch (error) {
        console.error("Erro ao carregar:", error);
    }
}

// 2. CONVERTER IMAGEM
inputLogo.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 500000) { 
            alert("A imagem é muito grande! Escolha um arquivo menor que 500kb.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            logoBase64 = reader.result;
            imgPreview.src = logoBase64;
            imgPreview.style.display = 'block';
            textPreview.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
});

// 3. SALVAR
document.getElementById('form-loja').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar');
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        await setDoc(configRef, {
            nome: nomeInput.value,
            cnpj: cnpjInput.value,
            telefone: telInput.value,
            logo: logoBase64,
            senhaGerente: senhaGerenteInput.value // SALVA A SENHA
        });
        alert("Configurações salvas com sucesso!");
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar.");
    } finally {
        btn.innerText = "Salvar Configurações";
        btn.disabled = false;
    }
});

document.addEventListener('DOMContentLoaded', carregarDados);