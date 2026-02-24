import { getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDocRef } from './saas-utils.js';

// ------------------------------------------------------------------
// FUNÇÃO 1: USADA NO ESTOQUE.JS (Define o stock absoluto)
// ------------------------------------------------------------------
export async function sincronizarStockEcom(nomeProduto, grade) {
    try {
        const configRef = getDocRef("configuracoes", "dados_loja");
        const snap = await getDoc(configRef);

        if (!snap.exists()) return;
        const config = snap.data();

        if (config.ecom_plataforma === 'woocommerce' && config.ecom_url) {
            const auth = btoa(`${config.ecom_key}:${config.ecom_secret}`);
            const estoqueTotal = grade.reduce((acc, item) => acc + item.qtd, 0);
            
            const urlBusca = `${config.ecom_url}/wp-json/wc/v3/products?search=${encodeURIComponent(nomeProduto)}`;
            const res = await fetch(urlBusca, { headers: { 'Authorization': `Basic ${auth}` } });
            const produtos = await res.json();

            if (produtos && produtos.length > 0) {
                const productId = produtos[0].id;
                await fetch(`${config.ecom_url}/wp-json/wc/v3/products/${productId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ manage_stock: true, stock_quantity: estoqueTotal })
                });
                console.log(`[WooCommerce] Stock de ${nomeProduto} sincronizado para ${estoqueTotal}.`);
            }
        }
    } catch (error) {
        console.error("Erro na sincronização e-commerce:", error);
    }
}

// ------------------------------------------------------------------
// FUNÇÃO 2: USADA NO PDV.JS (Subtrai os itens vendidos no momento da venda)
// ------------------------------------------------------------------
export async function abaterEstoqueEcom(itensVendidos) {
    try {
        const configRef = getDocRef("configuracoes", "dados_loja");
        const snap = await getDoc(configRef);

        if (!snap.exists()) return;
        const config = snap.data();

        if (!config.ecom_plataforma || config.ecom_plataforma === 'nenhuma') return;

        console.log("Iniciando baixa automática no E-commerce...");

        for (const item of itensVendidos) {
            const termoBusca = item.codigo ? item.codigo : item.id;

            if (config.ecom_plataforma === 'woocommerce') {
                const auth = btoa(`${config.ecom_key}:${config.ecom_secret}`);
                const searchUrl = `${config.ecom_url}/wp-json/wc/v3/products?sku=${termoBusca}`;
                const resSearch = await fetch(searchUrl, { headers: { 'Authorization': `Basic ${auth}` } });
                const produtosWoo = await resSearch.json();
                
                if (produtosWoo && produtosWoo.length > 0) {
                    const wooId = produtosWoo[0].id;
                    const estoqueAtual = produtosWoo[0].stock_quantity || 0;
                    const novoEstoque = Math.max(0, estoqueAtual - item.qtd);
                    
                    await fetch(`${config.ecom_url}/wp-json/wc/v3/products/${wooId}`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ manage_stock: true, stock_quantity: novoEstoque })
                    });
                    console.log(`✅ WooCommerce: Stock abatido para ${item.nome}`);
                }
            } 
            else if (config.ecom_plataforma === 'shopify') {
                const headers = { 'X-Shopify-Access-Token': config.ecom_key, 'Content-Type': 'application/json' };
                const resSearch = await fetch(`${config.ecom_url}/admin/api/2024-01/variants.json?sku=${termoBusca}`, { headers });
                const dadosShopify = await resSearch.json();

                if (dadosShopify.variants && dadosShopify.variants.length > 0) {
                    const variant = dadosShopify.variants[0];
                    const inventoryItemId = variant.inventory_item_id;
                    const estoqueAtual = variant.inventory_quantity || 0;
                    const novoEstoque = Math.max(0, estoqueAtual - item.qtd);

                    const resLocations = await fetch(`${config.ecom_url}/admin/api/2024-01/locations.json`, { headers });
                    const dadosLocations = await resLocations.json();
                    
                    if (dadosLocations.locations && dadosLocations.locations.length > 0) {
                        const locationId = dadosLocations.locations[0].id;
                        await fetch(`${config.ecom_url}/admin/api/2024-01/inventory_levels/set.json`, {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify({ location_id: locationId, inventory_item_id: inventoryItemId, available: novoEstoque })
                        });
                        console.log(`✅ Shopify: Stock abatido para ${item.nome}`);
                    }
                }
            }
        }
    } catch (erro) { console.error("Erro E-commerce (Baixa PDV):", erro); }
}