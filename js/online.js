import { db, auth } from './firebase-config.js';
import { getColRef, getDocRef } from './saas-utils.js';
import { getDocs, query, where, doc, getDoc, addDoc, updateDoc, Timestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) return window.location.href = "../index.html";
    
    document.getElementById('nome-utilizador').innerText = localStorage.getItem('VESTIO_USER_NAME') || 'Admin';
    if(document.getElementById('view-empresa-id')) {
        document.getElementById('view-empresa-id').innerText = empresaId;
    }

    carregarPedidosOnline();
    document.getElementById('btn-simular-pedido').addEventListener('click', () => simularPedido(empresaId));
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await signOut(auth); localStorage.clear(); window.location.href = "../index.html";
    });
});

// 1. CARREGAR E DISTRIBUIR PEDIDOS NO KANBAN
function carregarPedidosOnline() {
    const q = query(getColRef("vendas_online"));
    
    window.unsubscribePedidos = onSnapshot(q, (snap) => {
        const colNovos = document.getElementById('coluna-novos');
        const colPrep = document.getElementById('coluna-preparando');
        const colEnv = document.getElementById('coluna-enviados');
        
        if(!colNovos || !colPrep || !colEnv) return;

        colNovos.innerHTML = ''; colPrep.innerHTML = ''; colEnv.innerHTML = '';
        let contNovos = 0, contPrep = 0, contEnv = 0;

        let pedidos = [];
        snap.forEach(docSnap => pedidos.push({ id: docSnap.id, ...docSnap.data() }));
        pedidos.sort((a, b) => b.dataPedido.toDate() - a.dataPedido.toDate());

        pedidos.forEach(p => {
            if (p.status_integracao === 'rejeitado') return; 

            let resumoItens = '';
            if(p.itens) p.itens.forEach(i => resumoItens += `${i.qtd}x ${i.nome}<br>`);

            const card = document.createElement('div');
            card.className = 'kanban-card';
            
            let botoesHTML = '';

            // Agora passamos apenas o ID do pedido para a função imprimirEtiqueta
            if (p.status_integracao === 'pendente') {
                contNovos++;
                botoesHTML = `
                    <button onclick="window.aprovarPedido('${p.id}')" class="btn-acao btn-verde">💰 Faturar & Separar</button>
                    <button onclick="window.rejeitarPedido('${p.id}')" class="btn-acao btn-vermelho-outline">❌ Cancelar</button>
                `;
            } else if (p.status_integracao === 'preparando' || p.status_integracao === 'aprovado') {
                contPrep++;
                botoesHTML = `
                    <button onclick="window.imprimirEtiqueta('${p.id}')" class="btn-acao btn-azul">🖨️ Imprimir Etiqueta</button>
                    <button onclick="window.marcarEnviado('${p.id}')" class="btn-acao btn-amarelo">🚚 Marcar como Enviado</button>
                `;
            } else if (p.status_integracao === 'enviado') {
                contEnv++;
                botoesHTML = `
                    <button onclick="window.imprimirEtiqueta('${p.id}')" class="btn-acao btn-azul">🖨️ Re-imprimir Etiqueta</button>
                `;
            }

            card.innerHTML = `
                <div style="font-size: 14px; margin-bottom: 5px; display:flex; justify-content:space-between;">
                    <strong>${p.clienteNome}</strong>
                    <span style="font-size:10px; background:rgba(155, 89, 182, 0.2); color:#9b59b6; padding:2px 4px; border-radius:4px;">${p.origem || 'Site'}</span>
                </div>
                <div style="font-size: 11px; color:#94a3b8; margin-bottom: 5px;">CPF: ${p.clienteCpf || 'N/A'}</div>
                <div style="font-size: 11px; color:#94a3b8; margin-bottom: 10px;">${p.clienteEmail || ''} | ${new Date(p.dataPedido.toDate()).toLocaleString('pt-BR')}</div>
                <div style="font-size: 12px; color: #64D2FF; margin-bottom: 10px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;">${resumoItens}</div>
                <div style="font-size: 12px; color: #f39c12; margin-bottom: 15px;">📍 ${p.enderecoEntrega || 'Endereço não informado'}</div>
                <div style="font-weight: bold; margin-bottom: 15px;">R$ ${p.total.toFixed(2)}</div>
                <div>${botoesHTML}</div>
            `;

            if (p.status_integracao === 'pendente') colNovos.appendChild(card);
            else if (p.status_integracao === 'preparando' || p.status_integracao === 'aprovado') colPrep.appendChild(card);
            else if (p.status_integracao === 'enviado') colEnv.appendChild(card);
        });

        document.getElementById('count-novos').innerText = contNovos;
        document.getElementById('count-prep').innerText = contPrep;
        document.getElementById('count-env').innerText = contEnv;
    });
}

// 2. APROVAR PEDIDO (Com proteção de dados de clientes)
window.aprovarPedido = async function(pedidoId) {
    try {
        Swal.fire({ title: 'Verificando Cliente...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background:'#1e293b', color:'#fff' });

        const pedidoRef = getDocRef("vendas_online", pedidoId);
        const pedidoSnap = await getDoc(pedidoRef);
        const pedido = pedidoSnap.data();

        let idClienteVinculado = null;
        const cpfBusca = pedido.clienteCpf || '';
        const emailBusca = pedido.clienteEmail || '';
        const nomeBusca = pedido.clienteNome || '';

        if (cpfBusca) {
            const snapCpf = await getDocs(query(getColRef("clientes"), where("cpf", "==", cpfBusca)));
            if (!snapCpf.empty) idClienteVinculado = snapCpf.docs[0].id;
        }

        if (!idClienteVinculado && emailBusca) {
            const snapEmail = await getDocs(query(getColRef("clientes"), where("email", "==", emailBusca)));
            if (!snapEmail.empty) idClienteVinculado = snapEmail.docs[0].id;
        }

        if (!idClienteVinculado && nomeBusca) {
            const snapNome = await getDocs(query(getColRef("clientes"), where("nome", "==", nomeBusca)));
            if (!snapNome.empty) idClienteVinculado = snapNome.docs[0].id;
        }

        // PERGUNTA SE DESEJA SALVAR O CLIENTE NA BASE
        if (!idClienteVinculado) {
            Swal.close(); 
            
            const { isConfirmed, isDenied } = await Swal.fire({
                title: 'Novo Cliente Detectado!',
                html: `
                    <div style="text-align: left; font-size: 14px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border: 1px dashed #64D2FF; margin-bottom: 15px;">
                        <p style="margin: 5px 0;"><strong>Nome:</strong> ${nomeBusca}</p>
                        <p style="margin: 5px 0;"><strong>CPF:</strong> ${cpfBusca || 'Não informado'}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${emailBusca || 'Não informado'}</p>
                        <p style="margin: 5px 0;"><strong>Whats:</strong> ${pedido.clienteTelefone || 'Não informado'}</p>
                        <p style="margin: 5px 0;"><strong>Morada:</strong> ${pedido.enderecoEntrega || 'Não informado'}</p>
                    </div>
                    <p style="font-size: 14px; color: #94a3b8;">Deseja criar a ficha deste cliente na sua base de dados?</p>
                `,
                icon: 'info',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: '✅ Sim, Cadastrar',
                denyButtonText: '⏭️ Não, Apenas Faturar',
                cancelButtonText: '❌ Cancelar',
                background: '#1e293b', color: '#fff',
                confirmButtonColor: '#30D158', denyButtonColor: '#0A84FF', cancelButtonColor: '#FF453A',
                width: 500
            });

            if (isConfirmed) {
                Swal.fire({ title: 'Cadastrando e Faturando...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background:'#1e293b', color:'#fff' });
                const novoCliente = await addDoc(getColRef("clientes"), {
                    nome: nomeBusca, cpf: cpfBusca, email: emailBusca, telefone: pedido.clienteTelefone || '', endereco: pedido.enderecoEntrega || '', limiteCredito: 0, origem: 'E-commerce', dataCadastro: Timestamp.now()
                });
                idClienteVinculado = novoCliente.id;
            } else if (isDenied) {
                Swal.fire({ title: 'Faturando Pedido...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background:'#1e293b', color:'#fff' });
                idClienteVinculado = null;
            } else { return; }
        } else {
            Swal.fire({ title: 'Faturando Pedido...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background:'#1e293b', color:'#fff' });
        }

        await addDoc(getColRef("vendas"), {
            dataVenda: Timestamp.now(), clienteNome: pedido.clienteNome, clienteId: idClienteVinculado, itens: pedido.itens, subtotal: pedido.total, desconto: 0, total: pedido.total, formaPagamento: pedido.formaPagamento, statusPagamento: 'Pago', vendedor: 'Sistema (Integração Site)'
        });

        for (const item of pedido.itens) {
            const prodRef = getDocRef("produtos", item.id);
            const pSnap = await getDoc(prodRef);
            if(pSnap.exists()) {
                const estoqueAtual = pSnap.data().estoqueTotal || 0;
                await updateDoc(prodRef, { estoqueTotal: Math.max(0, estoqueAtual - item.qtd) });
            }
        }

        await updateDoc(pedidoRef, { status_integracao: 'preparando' });
        Swal.fire({title: 'Sucesso!', text: 'Pedido faturado e enviado para preparação.', icon: 'success', background:'#1e293b', color:'#fff'});
    } catch(e) { console.error(e); Swal.fire('Erro', 'Falha ao processar pedido.', 'error'); }
}

window.marcarEnviado = async function(pedidoId) {
    await updateDoc(getDocRef("vendas_online", pedidoId), { status_integracao: 'enviado' });
}

window.rejeitarPedido = async function(pedidoId) {
    if(confirm("Cancelar este pedido? O estoque físico não será alterado.")) {
        await updateDoc(getDocRef("vendas_online", pedidoId), { status_integracao: 'rejeitado' });
    }
}

// 3. ETIQUETA PADRÃO CORREIOS (10x15cm) BUSCANDO DADOS DA LOJA
window.imprimirEtiqueta = async function(pedidoId) {
    try {
        Swal.fire({ title: 'Gerando Etiqueta...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background:'#1e293b', color:'#fff' });
        
        const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
        
        // Puxar os dados específicos deste Pedido
        const pedidoSnap = await getDoc(getDocRef("vendas_online", pedidoId));
        if(!pedidoSnap.exists()) throw new Error("Pedido não encontrado");
        const pedido = pedidoSnap.data();

        // Puxar as configurações da Loja (Para preencher o Remetente e Logo)
        let nomeLoja = "Loja Remetente";
        let endLoja = "Endereço da loja não configurado.";
        let logoLoja = "";
        let docLoja = "";
        
        const configSnap = await getDoc(doc(db, "empresas", empresaId, "configuracoes", "dados_loja"));
        if(configSnap.exists()) {
            const config = configSnap.data();
            nomeLoja = config.nome || nomeLoja;
            endLoja = config.endereco || endLoja;
            logoLoja = config.logo || "";
            docLoja = config.cnpj ? `CNPJ: ${config.cnpj}` : "";
        }

        Swal.close();

        const tela = window.open('', '_blank', 'width=600,height=800');
        
        // Prepara o código HTML da imagem caso a loja tenha salvo uma logo
        const logoHtml = logoLoja ? `<img src="${logoLoja}" style="max-height: 50px; max-width: 150px; object-fit: contain; margin-bottom: 10px;">` : '';

        // Formato Exato 10x15 com regras CSS de impressão limpa
        tela.document.write(`
            <html>
            <head><title>Etiqueta de Envio - ${pedido.clienteNome}</title>
            <style>
                @page { size: 10cm 15cm; margin: 0; }
                body { font-family: Arial, sans-serif; padding: 0; margin: 0; display: flex; justify-content: center; background: #fff; color: #000; }
                .etiqueta { width: 10cm; height: 14.5cm; border: 2px solid #000; padding: 15px; box-sizing: border-box; position: relative; margin: 10px auto; page-break-after: always; }
                
                .destinatario { border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
                h2 { font-size: 14px; text-transform: uppercase; margin: 0 0 10px 0; color: #333; }
                .nome-dest { font-size: 20px; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase; }
                .end-dest { font-size: 16px; line-height: 1.4; margin: 0; }
                
                .remetente { padding-top: 5px; }
                .nome-remet { font-size: 14px; font-weight: bold; margin: 0 0 5px 0; }
                .end-remet { font-size: 12px; line-height: 1.3; margin: 0; color: #444; }
                
                .footer { position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 10px; color: #666; font-style: italic; }
            </style>
            </head>
            <body>
                <div class="etiqueta">
                    <div class="destinatario">
                        <h2>📦 DESTINATÁRIO</h2>
                        <p class="nome-dest">${pedido.clienteNome}</p>
                        <p class="end-dest">${pedido.enderecoEntrega || 'Endereço não informado'}</p>
                        <p style="margin-top: 10px; font-size: 12px;"><strong>Contato:</strong> ${pedido.clienteTelefone || pedido.clienteEmail || 'N/A'}</p>
                        <p style="margin-top: 5px; font-size: 12px;"><strong>Doc:</strong> ${pedido.clienteCpf || 'N/A'}</p>
                    </div>
                    
                    <div class="remetente">
                        <h2>REMETENTE</h2>
                        ${logoHtml}
                        <p class="nome-remet">${nomeLoja}</p>
                        <p class="end-remet">${endLoja}</p>
                        <p class="end-remet">${docLoja}</p>
                    </div>

                    <div class="footer">
                        Processado por Vestio ERP
                    </div>
                </div>
                <script>setTimeout(() => { window.print(); window.close(); }, 800);<\/script>
            </body>
            </html>
        `);
    } catch (error) {
        Swal.fire('Erro', 'Não foi possível gerar a etiqueta.', 'error');
        console.error(error);
    }
}

async function simularPedido(empresaId) {
    try {
        const snapProd = await getDocs(query(getColRef("produtos")));
        if(snapProd.empty) return Swal.fire({title: 'Ops!', text: 'Cadastre um produto no estoque físico primeiro!', icon: 'warning', background:'#1e293b', color:'#fff'});
        const prod = snapProd.docs[0].data();
        
        const numeroAleatorio = Math.floor(Math.random() * 900) + 100;
        
        await addDoc(getColRef("vendas_online"), {
            origem: 'Simulador Loja Virtual',
            status_integracao: 'pendente', 
            dataPedido: Timestamp.now(),
            clienteNome: "João da Silva " + numeroAleatorio,
            clienteCpf: `${numeroAleatorio}.456.789-00`,
            clienteEmail: `joao${numeroAleatorio}@teste.com`,
            clienteTelefone: "(51) 99999-9999",
            enderecoEntrega: "Rua das Flores, 123, Bairro Centro, CEP 90000-000",
            total: parseFloat(prod.precoVenda),
            formaPagamento: 'Cartão de Crédito',
            itens: [{ id: snapProd.docs[0].id, nome: prod.nome, precoUnitario: parseFloat(prod.precoVenda), qtd: 1 }]
        });
        
        Swal.fire({title: 'Pedido Simulado!', text: 'O pedido apareceu na coluna Novos.', icon: 'success', background:'#1e293b', color:'#fff', timer: 1500, showConfirmButton: false});
    } catch(e) { console.error(e); }
}