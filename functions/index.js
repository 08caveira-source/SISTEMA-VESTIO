const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.webhookPedido = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    const empresaId = req.query.empresa;
    if (!empresaId) return res.status(400).send('ID da empresa ausente no link');

    let pedido = req.body; 

    try {
        if (pedido.store_id && pedido.event && pedido.id && !pedido.line_items) {
            const configSnap = await admin.firestore().collection("empresas").doc(empresaId).collection("configuracoes").doc("dados_loja").get();
            
            if (configSnap.exists) {
                const config = configSnap.data();
                if (config.ecom_plataforma === 'nuvemshop' && config.ecom_secret) {
                    const storeId = config.ecom_key;
                    const token = config.ecom_secret;
                    
                    const nuvemRes = await fetch(`https://api.nuvemshop.com.br/v1/${storeId}/orders/${pedido.id}`, {
                        headers: {
                            'Authentication': `bearer ${token}`,
                            'User-Agent': 'VestioERP (suporte@vestio.com)'
                        }
                    });
                    
                    if (nuvemRes.ok) pedido = await nuvemRes.json();
                }
            }
        }

        // ==========================================
        // TRAVA DE SEGURANÇA: BLOQUEIO DE CREDIÁRIO ONLINE
        // ==========================================
        let nomePagamento = pedido.payment_method_title || pedido.gateway || pedido.payment_details?.method || 'Site';
        
        // Se a loja online enviar qualquer coisa com a palavra "crediário" ou "fiado", o sistema força a mudança do nome
        if (nomePagamento.toLowerCase().includes('crediario') || 
            nomePagamento.toLowerCase().includes('crediário') || 
            nomePagamento.toLowerCase().includes('fiado')) {
            nomePagamento = 'Pagamento E-commerce (Revisar)';
        }

        const novoPedido = {
            origem: 'Loja Online',
            status_integracao: 'pendente', 
            dataPedido: admin.firestore.FieldValue.serverTimestamp(),
            
            clienteNome: pedido.billing?.first_name ? `${pedido.billing.first_name} ${pedido.billing.last_name || ''}` : 
                         (pedido.customer?.first_name ? `${pedido.customer.first_name} ${pedido.customer.last_name || ''}` : 
                         (pedido.customer?.name || 'Cliente do Site')),
                         
            clienteEmail: pedido.billing?.email || pedido.email || pedido.customer?.email || '',
            clienteTelefone: pedido.billing?.phone || pedido.phone || pedido.customer?.phone || '',
            
            clienteCpf: pedido.billing?.cpf || 
                        (pedido.meta_data && pedido.meta_data.find(m => m.key === '_billing_cpf')?.value) || 
                        pedido.customer?.identification || '',
            
            enderecoEntrega: pedido.shipping?.address_1 ? `${pedido.shipping.address_1}, ${pedido.shipping.city || ''}` : 
                             (pedido.shipping_address?.address1 ? `${pedido.shipping_address.address1}, ${pedido.shipping_address.city || ''}` : 
                             (pedido.shipping_address?.address ? `${pedido.shipping_address.address} ${pedido.shipping_address.number || ''}, ${pedido.shipping_address.city || ''}` : '')),
            
            total: parseFloat(pedido.total || pedido.total_price || 0),
            
            // Aplica o nome do pagamento com a trava de segurança
            formaPagamento: nomePagamento,
            
            itens: (pedido.line_items || pedido.products || []).map(item => ({
                id: item.sku || item.product_id || item.variant_id || 'sem-id',
                nome: item.name || item.title || item.name || 'Produto',
                precoUnitario: parseFloat(item.price || 0),
                qtd: item.quantity || 1,
                custo: 0
            }))
        };

        await admin.firestore().collection("empresas").doc(empresaId).collection("vendas_online").add(novoPedido);

        res.status(200).send('Pedido notificado ao Vestio com sucesso!');
    } catch (error) {
        console.error("Erro ao processar webhook:", error);
        res.status(500).send('Erro interno do servidor');
    }
});