import { db, auth } from './firebase-config.js';
import { getDocRef, validarSenhaMaster } from './saas-utils.js';
import { getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const configRef = getDocRef("configuracoes", "dados_loja");

async function carregarDados() {
    try {
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
            const d = docSnap.data();
            if(document.getElementById('loja-nome')) document.getElementById('loja-nome').value = d.nome || '';
            if(document.getElementById('loja-cnpj')) document.getElementById('loja-cnpj').value = d.cnpj || '';
            if(document.getElementById('loja-tel')) document.getElementById('loja-tel').value = d.telefone || '';
            if(document.getElementById('loja-end')) document.getElementById('loja-end').value = d.endereco || '';
            if(document.getElementById('senha-gerente')) document.getElementById('senha-gerente').value = d.senhaGerente || 'admin';
            
            document.getElementById('ecom-plataforma').value = d.ecom_plataforma || 'nenhuma';
            document.getElementById('ecom-url').value = d.ecom_url || '';
            document.getElementById('ecom-key').value = d.ecom_key || '';
            document.getElementById('ecom-secret').value = d.ecom_secret || '';
        }
    } catch (error) { console.error(error); }
}

const btnInstrucoes = document.getElementById('btn-instrucoes-ecom');

if (btnInstrucoes) {
    btnInstrucoes.addEventListener('click', (e) => {
        e.preventDefault(); // Evita que a página recarregue caso o botão aja como um submit
        
        const conteudo = `GUIA DE LIGAÇÃO VESTIO: LOJA FÍSICA -> ONLINE
--------------------------------------------------

1. CONFIGURAÇÃO NO WOOCOMMERCE (WordPress)
   - Acesse o painel do seu site WordPress.
   - Vá em: WooCommerce > Configurações > Avançado > API REST.
   - Clique em "Adicionar Chave".
   - Descrição: Sistema Vestio.
   - Usuário: Selecione um administrador.
   - Permissões: Ler/Escrever (Crucial para atualizar estoque).
   - Copie a 'Chave do Consumidor' (Key) e o 'Segredo do Consumidor' (Secret).
   - No Vestio: Cole a URL do site, a Key e o Secret.

2. CONFIGURAÇÃO NO SHOPIFY
   - Acesse o painel Admin da Shopify.
   - Vá em: Configurações > Apps e canais de vendas > Desenvolver apps.
   - Clique em "Criar um app" e dê o nome "Vestio".
   - Em "Configuração", selecione "Escopos da API do Admin".
   - Ative permissões de 'write_products' e 'read_products'.
   - Instale o app e copie o 'Token de acesso' (que será sua API Key).
   - Nota: O Shopify exige mapeamento de Location ID (Consulte o suporte técnico).

3. NO SISTEMA VESTIO
   - Escolha a plataforma correta no menu 'Minha Loja'.
   - Insira a URL completa (ex: https://sualoja.com.br).
   - Salve as alterações usando sua Senha Master.
   - O estoque será sincronizado automaticamente ao salvar produtos.

--------------------------------------------------
Suporte Vestio - Integração SaaS`;

        // Cria o arquivo de texto na memória do navegador
        const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        
        // Cria a URL para o download
        link.href = window.URL.createObjectURL(blob);
        link.download = 'Instrucoes_Ligacao_Vestio.txt';
        
        // Adiciona o link de forma invisível no HTML (obrigatório para alguns navegadores)
        document.body.appendChild(link);
        
        // Clica no link para baixar
        link.click();
        
        // Remove o link para não deixar lixo no HTML
        document.body.removeChild(link);
        
        // Libera a memória
        window.URL.revokeObjectURL(link.href);
    });
} else {
    console.error("Botão de instruções não encontrado no HTML.");
}
document.getElementById('btn-salvar-config').onclick = async () => {
    const pass = await Swal.fire({ title: 'Senha Master', input: 'password', background: '#1e293b', color: '#fff' });
    
    if (pass.isConfirmed && await validarSenhaMaster(pass.value)) {
        await setDoc(configRef, {
            nome: document.getElementById('loja-nome').value,
            cnpj: document.getElementById('loja-cnpj').value,
            telefone: document.getElementById('loja-tel').value,
            endereco: document.getElementById('loja-end').value,
            senhaGerente: document.getElementById('senha-gerente').value,
            ecom_plataforma: document.getElementById('ecom-plataforma').value,
            ecom_url: document.getElementById('ecom-url').value,
            ecom_key: document.getElementById('ecom-key').value,
            ecom_secret: document.getElementById('ecom-secret').value
        }, { merge: true });
        Swal.fire('Sucesso', 'Configurações de integração salvas!', 'success');
    }
};

carregarDados();