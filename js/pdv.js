import { db, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, query, Timestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
            
            if (d.ecom_plataforma && d.ecom_plataforma !== 'nenhuma') {
                ecomConfig = { plataforma: d.ecom_plataforma, url: d.ecom_url, key: d.ecom_key, secret: d.ecom_secret };
            }
        }
    } catch(e) { console.error("Erro ao carregar configurações:", e); }

    carregarProdutosCache(empresaId); carregarClientesCache(empresaId);

    // ==========================================
    // LEITOR DE CÓDIGO DE BARRAS INTELIGENTE (Detecta Variações)
    // ==========================================
    document.getElementById('busca-produto').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const codigoLido = e.target.value.trim();
            if (codigoLido === '') return;

            let baseId = codigoLido;
            let varIndex = null;
            
            // Verifica se o código de barras contém o traço da variação (Ex: ID-0)
            if (codigoLido.includes('-')) {
                const parts = codigoLido.split('-');
                baseId = parts[0];
                varIndex = parseInt(parts[1]);
            }

            const produtoEncontrado = produtosCache.find(p => p.id === baseId || p.sku === baseId || p.codigo === baseId);

            if (produtoEncontrado) {
                adicionarAoCarrinho(produtoEncontrado, varIndex);
                e.target.value = ''; 
                document.getElementById('sugestoes-produtos').style.display = 'none';
                new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3').play().catch(()=>{}); 
            } else {
                Swal.fire('Não encontrado', 'Código não registado.', 'warning');
                e.target.value = '';
            }
        }
    });

    document.getElementById('busca-produto').addEventListener('input', (e) => filtrarProdutos(e.target.value));
    document.getElementById('busca-cliente').addEventListener('input', (e) => filtrarClientes(e.target.value));
    document.getElementById('btn-finalizar').addEventListener('click', () => finalizarVenda(empresaId));
    document.getElementById('valor-desconto').addEventListener('input', atualizarTotal);
    document.getElementById('qtd-parcelas').addEventListener('input', atualizarTotal);
    
    document.getElementById('forma-pagamento').addEventListener('change', (e) => {
        document.getElementById('area-parcelas').style.display = (e.target.value === 'Crediário') ? 'block' : 'none';
        atualizarTotal();
    });

    document.getElementById('btn-fechar-pdv').addEventListener('click', () => { 
        window.close(); 
        Swal.fire('Caixa Fechado', 'Você pode fechar esta aba no X do navegador.', 'info'); 
    });
});

async function carregarProdutosCache(empresaId) { const snap = await getDocs(query(collection(db, "empresas", empresaId, "produtos"))); produtosCache = []; snap.forEach(doc => produtosCache.push({ id: doc.id, ...doc.data() })); }
async function carregarClientesCache(empresaId) { const snap = await getDocs(query(collection(db, "empresas", empresaId, "clientes"))); clientesCache = []; snap.forEach(doc => clientesCache.push({ id: doc.id, ...doc.data() })); }

// Busca manual agora lista as variações separadamente
function filtrarProdutos(texto) { 
    const div = document.getElementById('sugestoes-produtos'); div.innerHTML = '';
    if(texto.length < 2){ div.style.display='none'; return; }
    
    let resultados = [];
    produtosCache.forEach(p => {
        if ((p.nome && p.nome.toLowerCase().includes(texto.toLowerCase())) || (p.id && p.id.includes(texto))) {
            if (p.grade && p.grade.length > 0) {
                p.grade.forEach((g, i) => {
                    resultados.push({ ...p, varIndex: i, nomeExibicao: `${p.nome} (${g.tamanho} / ${g.cor})` });
                });
            } else {
                resultados.push({ ...p, varIndex: null, nomeExibicao: p.nome });
            }
        }
    });
    
    resultados = resultados.slice(0, 8); // Mostra até 8 opções para não poluir
    
    resultados.forEach(p => {
        const d = document.createElement('div'); d.style.cssText="padding:10px; border-bottom:1px solid #333; cursor:pointer; color:white; font-size:13px;";
        d.innerHTML=`<b>${p.nomeExibicao}</b> <span style='float:right; color:#64D2FF'>R$ ${parseFloat(p.precoVenda).toFixed(2)}</span>`;
        d.onclick=()=>{ adicionarAoCarrinho(p, p.varIndex); document.getElementById('busca-produto').value=''; div.style.display='none'; };
        div.appendChild(d);
    });
    div.style.display = resultados.length ? 'block' : 'none';
}

function filtrarClientes(texto) { 
    const div = document.getElementById('sugestoes-clientes'); div.innerHTML = '';
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

// O Carrinho agora aceita e diferencia as variações do mesmo produto
function adicionarAoCarrinho(produto, varIndex = null) {
    let idCarrinho = produto.id;
    let nomeCarrinho = produto.nome;
    
    if (varIndex !== null && produto.grade && produto.grade[varIndex]) {
        idCarrinho = `${produto.id}-${varIndex}`;
        nomeCarrinho = `${produto.nome} (${produto.grade[varIndex].tamanho} / ${produto.grade[varIndex].cor})`;
    }

    const ex = carrinho.find(i => i.idCarrinho === idCarrinho);
    if(ex) {
        ex.qtd++; 
    } else { 
        carrinho.push({ 
            idCarrinho: idCarrinho, 
            id: produto.id, 
            codigo: produto.codigo || '', 
            nome: nomeCarrinho, 
            precoUnitario: parseFloat(produto.precoVenda), 
            qtd: 1, 
            custo: produto.precoCusto||0 
        });
    }
    renderizarCarrinho();
}

function renderizarCarrinho() {
    const div = document.getElementById('lista-carrinho'); div.innerHTML = '';
    carrinho.forEach((item, idx) => { div.innerHTML += `<div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between; color:white; font-size:13px;"><div><b>${item.nome}</b><br><small style="color:#94a3b8">${item.qtd}x R$ ${item.precoUnitario.toFixed(2)}</small></div><div><span style="color:#64D2FF; font-weight:bold; font-size:15px;">R$ ${(item.qtd*item.precoUnitario).toFixed(2)}</span> <button onclick="window.removeItem(${idx})" style="color:#FF453A; background:none; border:none; margin-left:10px; font-weight:bold; cursor:pointer;">X</button></div></div>`; });
    atualizarTotal();
}
window.removeItem = (idx) => { carrinho.splice(idx, 1); renderizarCarrinho(); };

function atualizarTotal() {
    let sub = carrinho.reduce((a, b) => a + (b.qtd * b.precoUnitario), 0);
    let desc = parseFloat(document.getElementById('valor-desconto').value) || 0;
    let total = Math.max(0, sub - desc);
    if (document.getElementById('forma-pagamento').value === 'Crediário' && jurosConfig > 0) { total = total * (1 + (jurosConfig / 100)); }
    document.getElementById('total-venda').innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return total;
}

async function sincronizarEstoqueOnline(itensVendidos) {
    if (!ecomConfig || ecomConfig.plataforma === 'nenhuma') return;
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
                    await fetch(`${ecomConfig.url}/wp-json/wc/v3/products/${wooId}`, { method: 'PUT', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ manage_stock: true, stock_quantity: Math.max(0, estoqueAtual - item.qtd) }) });
                }
            } else if (ecomConfig.plataforma === 'shopify') {
                const headers = { 'X-Shopify-Access-Token': ecomConfig.key, 'Content-Type': 'application/json' };
                const resSearch = await fetch(`${ecomConfig.url}/admin/api/2024-01/variants.json?sku=${termoBusca}`, { headers });
                const dadosShopify = await resSearch.json();
                if (dadosShopify.variants && dadosShopify.variants.length > 0) {
                    const inventoryItemId = dadosShopify.variants[0].inventory_item_id;
                    const novoEstoque = Math.max(0, (dadosShopify.variants[0].inventory_quantity || 0) - item.qtd);
                    const resLocations = await fetch(`${ecomConfig.url}/admin/api/2024-01/locations.json`, { headers });
                    const dadosLocations = await resLocations.json();
                    if (dadosLocations.locations && dadosLocations.locations.length > 0) {
                        await fetch(`${ecomConfig.url}/admin/api/2024-01/inventory_levels/set.json`, { method: 'POST', headers: headers, body: JSON.stringify({ location_id: dadosLocations.locations[0].id, inventory_item_id: inventoryItemId, available: novoEstoque }) });
                    }
                }
            } else if (ecomConfig.plataforma === 'nuvemshop') {
                const storeId = ecomConfig.key;
                const token = ecomConfig.secret;
                const headers = { 'Authentication': `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'VestioERP (suporte@vestio.com)' };
                const resSearch = await fetch(`https://api.nuvemshop.com.br/v1/${storeId}/variants?sku=${termoBusca}`, { headers });
                const variants = await resSearch.json();
                if (variants && variants.length > 0) {
                    const variantId = variants[0].id;
                    const productId = variants[0].product_id;
                    const novoEstoque = Math.max(0, (variants[0].stock || 0) - item.qtd);
                    await fetch(`https://api.nuvemshop.com.br/v1/${storeId}/products/${productId}/variants/${variantId}`, { method: 'PUT', headers: headers, body: JSON.stringify({ stock: novoEstoque }) });
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
            for(let i=1; i<=parcelas; i++){ const d = new Date(); d.setMonth(d.getMonth()+i); listaParcelas.push({ numero: i, valor: valorP, vencimento: Timestamp.fromDate(d), pago: false }); }
        }

        const venda = { dataVenda: Timestamp.now(), clienteId: clienteSelecionado ? clienteSelecionado.id : null, clienteNome: clienteSelecionado ? clienteSelecionado.nome : 'Consumidor', itens: carrinho, total: total, formaPagamento: pgto, statusPagamento: pgto === 'Crediário' ? 'Crediário' : 'Pago', parcelas: listaParcelas, vendedor: localStorage.getItem('VESTIO_USER_NAME') };
        const ref = await addDoc(collection(db, "empresas", empresaId, "vendas"), venda);
        
        if (pgto === 'Crediário') {
            for(const p of listaParcelas) { await addDoc(collection(db, "empresas", empresaId, "parcelas"), { vendaId: ref.id, clienteId: clienteSelecionado.id, numero: p.numero, valor: p.valor, vencimento: p.vencimento, status: 'Pendente', dataCompra: Timestamp.now() }); }
        }

        sincronizarEstoqueOnline(carrinho);

        Swal.fire('Sucesso', 'Venda realizada!', 'success');
        carrinho = []; clienteSelecionado = null; renderizarCarrinho();
        document.getElementById('busca-produto').value = '';
    } catch(e) { console.error(e); Swal.fire('Erro', 'Falha ao salvar', 'error'); }
    finally { btn.disabled = false; btn.innerText = "FINALIZAR VENDA"; }
}