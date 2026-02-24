// Exemplo de lógica para o serviço
export async function sincronizarStock(config) {
    if (config.ecom_plataforma === 'woocommerce') {
        // Chamada fetch para config.ecom_url + '/wp-json/wc/v3/products/...'
    } else if (config.ecom_plataforma === 'shopify') {
        // Lógica para Shopify Admin API
    }
}