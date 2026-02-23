import { db } from './firebase-config.js';
import { collection, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- SENHA GLOBAL DO SUPER ADMIN (A Chave Mestra) ---
const SENHA_SUPER_ADMIN = "@Mahara2017"; 

// Função para pegar coleções dentro da empresa
export function getColRef(nomeColecao) {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) {
        console.error("ERRO CRÍTICO: ID da empresa não encontrado.");
        window.location.href = "../index.html"; 
        throw new Error("Sessão inválida.");
    }
    return collection(db, "empresas", empresaId, nomeColecao);
}

// Função para pegar um documento específico
export function getDocRef(nomeColecao, docId) {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) throw new Error("Sessão inválida.");
    return doc(db, "empresas", empresaId, nomeColecao, docId);
}

/**
 * Função Central de Segurança
 * Verifica se a senha digitada é a do Gerente da Loja OU a do Super Admin.
 */
export async function validarSenhaMaster(senhaDigitada) {
    if (!senhaDigitada) return false;

    // 1. Nível Deus: Verifica se é o Super Admin
    if (senhaDigitada === SENHA_SUPER_ADMIN) {
        console.log("🔓 Acesso liberado por Super Admin");
        return true;
    }

    // 2. Nível Loja: Verifica a senha configurada pelo dono da loja
    try {
        const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
        const docRef = doc(db, "empresas", empresaId, "configuracoes", "dados_loja");
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const dados = snap.data();
            const senhaLoja = dados.senhaGerente || "admin";
            if (senhaDigitada === senhaLoja) return true;
        }
    } catch (error) {
        console.error("Erro ao validar senha:", error);
    }

    return false;
}