const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Inicializa a ligação segura à sua base de dados Firebase
admin.initializeApp();

// Cria o URL recetor (Webhook)
exports.webhookPedido = functions.https.onRequest(async (req, res) => {
    // Apenas aceita o envio de dados (POST)
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    // Identifica qual é a loja física através do URL
    const empresaId = req.query.empresa;
    if (!empresaId) return res.status(400).send('ID da empresa ausente no link');

    const pedido = req.body; // Dados que a loja virtual enviou

    try {
        // Converte os dados do site para o padrão do Vestio (Compatível com Woo e Shopify)
        const novoPedido = {
            origem: 'Loja Online',
            status_integracao: 'pendente', // É esta palavra que faz o seu Caixa (PDV) apitar!
            dataPedido: admin.firestore.FieldValue.serverTimestamp(),
            
            // Dados do Cliente
            clienteNome: pedido.billing?.first_name ? `${pedido.billing.first_name} ${pedido.billing.last_name || ''}` : (pedido.customer?.first_name || 'Cliente do Site'),
            clienteEmail: pedido.billing?.email || pedido.email || '',
            clienteTelefone: pedido.billing?.phone || pedido.phone || '',
            enderecoEntrega: pedido.shipping?.address_1 ? `${pedido.shipping.address_1}, ${pedido.shipping.city || ''}` : (pedido.shipping_address?.address1 || ''),
            
            // Financeiro
            total: parseFloat(pedido.total || pedido.total_price || 0),
            formaPagamento: pedido.payment_method_title || pedido.gateway || 'Site',
            
            // Itens do Pedido
            itens: (pedido.line_items || []).map(item => ({
                id: item.sku || item.product_id || item.variant_id || 'sem-id',
                nome: item.name || item.title || 'Produto',
                precoUnitario: parseFloat(item.price || 0),
                qtd: item.quantity || 1,
                custo: 0
            }))
        };

        // Guarda o pedido na sua coleção, disparando o alerta no ecrã na mesma hora
        await admin.firestore()
            .collection("empresas")
            .doc(empresaId)
            .collection("vendas_online")
            .add(novoPedido);

        // Responde à loja virtual que tudo correu bem
        res.status(200).send('Pedido notificado ao Vestio com sucesso!');
    } catch (error) {
        console.error("Erro ao processar webhook:", error);
        res.status(500).send('Erro interno do servidor');
    }
});