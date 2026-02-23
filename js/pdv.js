import { db, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let carrinho = [], clienteSelecionado = null, produtosCache = [], clientesCache = [], jurosConfig = 0, ecomConfig = null;

document.addEventListener('DOMContentLoaded', async () => {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) return window.location.href="../index.html";
    document.getElementById('nome-utilizador').innerText = localStorage.getItem('VESTIO_USER_NAME') || 'Vendedor';

    try {
        const configSnap = await getDoc(doc(db, "empresas", empresaId, "configuracoes", "dados_loja"));
        if(configSnap.exists()) {
            const d = configSnap.data();
            jurosConfig = d.jurosCrediario || 0;
            document.getElementById('info-juros').innerText = `Juros: ${jurosConfig}%`;
            
            // CARREGAR AS CONFIGURAÇÕES DE E-COMMERCE NO CAIXA
            if (d.ecom_plataforma && d.ecom_plataforma !== 'nenhuma') {
                ecomConfig = {
                    plataforma: d.ecom_plataforma,
                    url: d.ecom_url,
                    key: d.ecom_key,
                    secret: d.ecom_secret
                };
            }
        }
    } catch(e) { console.error("Erro ao carregar configurações:", e); }

    carregarProdutosCache(empresaId); carregarClientesCache(empresaId);

    document.getElementById('busca-produto').addEventListener('input', (e) => filtrarProdutos(e.target.value));
    document.getElementById('busca-cliente').addEventListener('input', (e) => filtrarClientes(e.target.value));
    document.getElementById('btn-finalizar').addEventListener('click', () => finalizarVenda(empresaId));
    document.getElementById('valor-desconto').addEventListener('input', atualizarTotal);
    document.getElementById('qtd-parcelas').addEventListener('input', atualizarTotal);
    
    document.getElementById('forma-pagamento').addEventListener('change', (e) => {
        document.getElementById('area-parcelas').style.display = (e.target.value === 'Crediário') ? 'block' : 'none';
        atualizarTotal();
    });

    document.getElementById('btn-logout').addEventListener('click', async () => { await signOut(auth); window.location.href = "../index.html"; });
});

async function carregarProdutosCache(empresaId) {
    const snap = await getDocs(query(collection(db, "empresas", empresaId, "produtos")));
    produtosCache = []; snap.forEach(doc => produtosCache.push({ id: doc.id, ...doc.data() }));
}
async function carregarClientesCache(empresaId) {
    const snap = await getDocs(query(collection(db, "empresas", empresaId, "clientes")));
    clientesCache = []; snap.forEach(doc => clientesCache.push({ id: doc.id, ...doc.data() }));
}

// RESTAURADA A SUA FUNÇÃO ORIGINAL DE PESQUISA (com console.log para debug)
function filtrarProdutos(texto) { 
    console.log("Pesquisando produto...", texto, "| Produtos no sistema:", produtosCache.length);
    const div = document.getElementById('sugestoes-produtos'); 
    div.innerHTML = '';
    if(texto.length < 2){ div.style.display='none'; return; }
    
    const res = produtosCache.filter(p => (p.nome && p.nome.toLowerCase().includes(texto.toLowerCase())) || (p.codigo && p.codigo.includes(texto))).slice(0,5);
    
    res.forEach(p => {
        const d = document.createElement('div'); d.style.cssText="padding:10px; border-bottom:1px solid #333; cursor:pointer; color:white;";
        d.innerHTML=`<b>${p.nome}</b> <span style='float:right; color:#64D2FF'>R$ ${p.precoVenda}</span>`;
        d.onclick=()=>{ adicionarAoCarrinho(p); document.getElementById('busca-produto').value=''; div.style.display='none'; };
        div.appendChild(d);
    });
    div.style.display = res.length ? 'block' : 'none';
}

// RESTAURADA A SUA FUNÇÃO ORIGINAL DE PESQUISA
function filtrarClientes(texto) { 
    const div = document.getElementById('sugestoes-clientes'); 
    div.innerHTML = '';
    if(texto.length < 2){ div.style.display='none'; return; }
    
    const res = clientesCache.filter(c => (c.nome && c.nome.toLowerCase().includes(texto.toLowerCase())) || (c.cpf && c.cpf.includes(texto))).slice(0,5);
    
    res.forEach(c => {
        const d = document.createElement('div'); d.style.cssText="padding:10px; border-bottom:1px solid #333; cursor:pointer; color:white;";
        d.innerText = c.nome;
        d.onclick=()=>{ clienteSelecionado=c; document.getElementById('busca-cliente').value=c.nome; div.style.display='none'; };
        div.appendChild(d);
    });
    div.style.display = res.length ? 'block' : 'none';
}

function adicionarAoCarrinho(produto) {
    const ex = carrinho.find(i => i.id === produto.id);
    // Adicionado o 'codigo' para o E-commerce
    if(ex) ex.qtd++; else carrinho.push({ id: produto.id, codigo: produto.codigo || '', nome: produto.nome, precoUnitario: parseFloat(produto.precoVenda), qtd: 1, custo: produto.precoCusto||0 });
    renderizarCarrinho();
}

function renderizarCarrinho() {
    const div = document.getElementById('lista-carrinho'); div.innerHTML = '';
    carrinho.forEach((item, idx) => {
        div.innerHTML += `<div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between; color:white;">
            <div>${item.nome}<br><small style="color:#94a3b8">${item.qtd}x R$ ${item.precoUnitario}</small></div>
            <div><span style="color:#64D2FF; font-weight:bold;">R$ ${item.qtd*item.precoUnitario}</span> <button onclick="window.removeItem(${idx})" style="color:#FF453A; background:none; border:none; margin-left:10px;">X</button></div>
        </div>`;
    });
    atualizarTotal();
}
window.removeItem = (idx) => { carrinho.splice(idx, 1); renderizarCarrinho(); };

function atualizarTotal() {
    let sub = carrinho.reduce((a, b) => a + (b.qtd * b.precoUnitario), 0);
    let desc = parseFloat(document.getElementById('valor-desconto').value) || 0;
    let total = Math.max(0, sub - desc);
    
    if (document.getElementById('forma-pagamento').value === 'Crediário' && jurosConfig > 0) {
        total = total * (1 + (jurosConfig / 100));
    }
    document.getElementById('total-venda').innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return total;
}

// ============================================================================
// FUNÇÃO DE INTEGRAÇÃO COM A LOJA ONLINE (WOOCOMMERCE E SHOPIFY)
// ============================================================================
async function sincronizarEstoqueOnline(itensVendidos) {
    if (!ecomConfig || ecomConfig.plataforma === 'nenhuma') return;

    console.log("Iniciando sincronização com E-commerce...");

    for (const item of itensVendidos) {
        try {
            const termoBusca = item.codigo ? item.codigo : item.id;

            if (ecomConfig.plataforma === 'woocommerce') {
                const auth = btoa(ecomConfig.key + ':' + ecomConfig.secret);
                const searchUrl = `${ecomConfig.url}/wp-json/wc/v3/products?sku=${termoBusca}`;
                const resSearch = await fetch(searchUrl, { headers: { 'Authorization': `Basic ${auth}` } });
                const produtosWoo = await resSearch.json();
                
                if (produtosWoo && produtosWoo.length > 0) {
                    const wooId = produtosWoo[0].id;
                    const estoqueAtual = produtosWoo[0].stock_quantity || 0;
                    const novoEstoque = Math.max(0, estoqueAtual - item.qtd);
                    
                    await fetch(`${ecomConfig.url}/wp-json/wc/v3/products/${wooId}`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ manage_stock: true, stock_quantity: novoEstoque })
                    });
                    console.log(`✅ WooCommerce: Estoque atualizado para ${item.nome}`);
                }
            } 
            else if (ecomConfig.plataforma === 'shopify') {
                const headers = { 'X-Shopify-Access-Token': ecomConfig.key, 'Content-Type': 'application/json' };
                const resSearch = await fetch(`${ecomConfig.url}/admin/api/2024-01/variants.json?sku=${termoBusca}`, { headers });
                const dadosShopify = await resSearch.json();

                if (dadosShopify.variants && dadosShopify.variants.length > 0) {
                    const variant = dadosShopify.variants[0];
                    const inventoryItemId = variant.inventory_item_id;
                    const estoqueAtual = variant.inventory_quantity || 0;
                    const novoEstoque = Math.max(0, estoqueAtual - item.qtd);

                    const resLocations = await fetch(`${ecomConfig.url}/admin/api/2024-01/locations.json`, { headers });
                    const dadosLocations = await resLocations.json();
                    
                    if (dadosLocations.locations && dadosLocations.locations.length > 0) {
                        const locationId = dadosLocations.locations[0].id;
                        await fetch(`${ecomConfig.url}/admin/api/2024-01/inventory_levels/set.json`, {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify({ location_id: locationId, inventory_item_id: inventoryItemId, available: novoEstoque })
                        });
                        console.log(`✅ Shopify: Estoque atualizado para ${item.nome}`);
                    }
                }
            }
        } catch (erro) { console.error("Erro E-commerce:", erro); }
    }
}

async function finalizarVenda(empresaId) {
    if (carrinho.length === 0) return Swal.fire('Erro', 'Carrinho vazio', 'error');
    const pgto = document.getElementById('forma-pagamento').value;
    let parcelas = 1;

    if (pgto === 'Crediário') {
        if (!clienteSelecionado) return Swal.fire('Erro', 'Selecione um cliente!', 'error');
        parcelas = parseInt(document.getElementById('qtd-parcelas').value) || 1;
    }

    const total = atualizarTotal();
    const btn = document.getElementById('btn-finalizar');
    btn.disabled = true; btn.innerText = "Processando...";

    try {
        let listaParcelas = [];
        if (pgto === 'Crediário') {
            const valorP = total / parcelas;
            for(let i=1; i<=parcelas; i++){
                const d = new Date(); d.setMonth(d.getMonth()+i);
                listaParcelas.push({ numero: i, valor: valorP, vencimento: Timestamp.fromDate(d), pago: false });
            }
        }

        const venda = {
            dataVenda: Timestamp.now(),
            clienteId: clienteSelecionado ? clienteSelecionado.id : null,
            clienteNome: clienteSelecionado ? clienteSelecionado.nome : 'Consumidor',
            itens: carrinho,
            total: total,
            formaPagamento: pgto,
            statusPagamento: pgto === 'Crediário' ? 'Crediário' : 'Pago',
            parcelas: listaParcelas,
            vendedor: localStorage.getItem('VESTIO_USER_NAME')
        };

        const ref = await addDoc(collection(db, "empresas", empresaId, "vendas"), venda);
        
        if (pgto === 'Crediário') {
            for(const p of listaParcelas) {
                await addDoc(collection(db, "empresas", empresaId, "parcelas"), {
                    vendaId: ref.id, clienteId: clienteSelecionado.id, numero: p.numero, valor: p.valor, vencimento: p.vencimento, status: 'Pendente', dataCompra: Timestamp.now()
                });
            }
        }

        sincronizarEstoqueOnline(carrinho);

        Swal.fire('Sucesso', 'Venda realizada!', 'success');
        carrinho = []; clienteSelecionado = null; renderizarCarrinho();
        document.getElementById('busca-produto').value = '';
    } catch(e) { console.error(e); Swal.fire('Erro', 'Falha ao salvar', 'error'); }
    finally { btn.disabled = false; btn.innerText = "FINALIZAR VENDA"; }
}