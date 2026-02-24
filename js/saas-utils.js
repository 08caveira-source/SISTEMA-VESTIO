import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const SENHA_SUPER_ADMIN = "@Mahara2017"; 

export function getColRef(nomeColecao) {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) throw new Error("Sessão inválida.");
    return collection(db, "empresas", empresaId, nomeColecao);
}

export function getDocRef(nomeColecao, docId) {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) throw new Error("Sessão inválida.");
    return doc(db, "empresas", empresaId, nomeColecao, docId);
}

export async function validarSenhaMaster(senhaDigitada) {
    if (!senhaDigitada) return false;
    
    // Nível 1: Chave Mestra do Dono do SaaS
    if (senhaDigitada === SENHA_SUPER_ADMIN) return true;

    // Nível 2: Verifica se a senha pertence a um funcionário com cargo de 'Gerente'
    try {
        const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
        const usuariosRef = collection(db, "empresas", empresaId, "usuarios");
        
        // Procura por utilizadores que sejam gerentes e tenham a senha digitada
        const q = query(usuariosRef, where("cargo", "==", "Gerente"), where("senha", "==", senhaDigitada));
        const snap = await getDocs(q);

        if (!snap.empty) {
            console.log("🔓 Acesso liberado: Gerente autenticado.");
            return true;
        }
    } catch (error) {
        console.error("Erro ao validar senha do gerente:", error);
    }

    return false;
}