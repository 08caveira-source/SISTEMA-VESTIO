import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.getElementById('btn-voltar').addEventListener('click', () => { window.location.href = 'clientes.html'; });

// Pega o ID do cliente que foi passado na URL
const urlParams = new URLSearchParams(window.location.search);
const clienteId = urlParams.get('id');

if (!clienteId) {
    alert("Cliente não encontrado. Voltando para a tela anterior.");
    window.location.href = 'clientes.html';
}

// Elementos da Tela
const tabelaVendas = document.getElementById('tabela-vendas-pendentes');
const tabelaParcelas = document.getElementById('tabela-parcelas');

// ==========================================
// 1. CARREGAR DADOS DO CLIENTE
// ==========================================
async function carregarPerfilCliente() {
    try {
        const docRef = doc(db, "clientes", clienteId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const cliente = docSnap.data();
            document.getElementById('nome-cliente-display').innerText = cliente.nome;
            document.getElementById('cpf-cliente-display').innerText = cliente.cpf;
            document.getElementById('telefone-cliente-display').innerText = cliente.telefone;
            document.getElementById('endereco-cliente-display').innerText = cliente.endereco || "Não informado";
            document.getElementById('limite-cliente-display').innerText = cliente.limiteCredito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    } catch (error) {
        console.error("Erro ao carregar cliente:", error);
    }
}

// ==========================================
// 2. CARREGAR VENDAS, PARCELAS E CALCULAR SCORE
// ==========================================
async function carregarVendasEParcelas() {
    tabelaVendas.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    tabelaParcelas.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

    try {
        // --- BUSCA VENDAS PENDENTES ---
        const qVendas = query(collection(db, "vendas"), where("clienteId", "==", clienteId), where("formaPagamento", "==", "Crediário"));
        const snapshotVendas = await getDocs(qVendas);
        
        tabelaVendas.innerHTML = '';
        if (snapshotVendas.empty) {
            tabelaVendas.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #7f8c8d;">Nenhuma compra pendente.</td></tr>';
        }

        snapshotVendas.forEach((documento) => {
            const venda = documento.data();
            const id = documento.id;
            
            if (venda.statusPagamento === 'Pendente') {
                const dataFormatada = venda.dataVenda ? venda.dataVenda.toDate().toLocaleDateString('pt-BR') : 'Data Indisponível';
                const totalF = venda.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${dataFormatada}</td>
                    <td><strong>${totalF}</strong></td>
                    <td><span class="badge bg-pendente">Pendente</span></td>
                    <td><button class="btn-pequeno btn-gerar" onclick="gerarParcelas('${id}', ${venda.total})">Gerar Carnê</button></td>
                `;
                tabelaVendas.appendChild(tr);
            }
        });

        // --- BUSCA PARCELAS E GERA ANÁLISE ---
        const qParcelas = query(collection(db, "parcelas"), where("clienteId", "==", clienteId));
        const snapshotParcelas = await getDocs(qParcelas);
        
        tabelaParcelas.innerHTML = '';
        let listaParcelas = [];
        
        // Variáveis para o Score do Cliente
        let pagasNoPrazo = 0;
        let pagasComAtraso = 0;

        snapshotParcelas.forEach((docParc) => {
            let p = docParc.data();
            p.id = docParc.id;
            listaParcelas.push(p);
        });

        listaParcelas.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));

        if (listaParcelas.length === 0) {
            tabelaParcelas.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #7f8c8d;">Nenhuma parcela gerada.</td></tr>';
        } else {
            listaParcelas.forEach(parcela => {
                const valorF = parcela.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const [ano, mes, dia] = parcela.vencimento.split('-');
                const dataVencBr = `${dia}/${mes}/${ano}`;

                let badge = '';
                let infoPagamento = '';
                let botao = '';

                // Verifica o status da parcela para formatar a tabela e contar pro Score
                if (parcela.status === 'Pago') {
                    // Formata a data em que foi pago
                    const dataPgtoBr = parcela.dataPagamento ? new Date(parcela.dataPagamento).toLocaleDateString('pt-BR') : 'Data Indisponível';
                    
                    if (parcela.diasAtraso > 0) {
                        badge = `<span class="badge" style="background-color: #c0392b;">Pago (Atraso: ${parcela.diasAtraso}d)</span>`;
                        infoPagamento = `<br><small style="color: #c0392b; font-weight: bold;">Pago em: ${dataPgtoBr}</small>`;
                        pagasComAtraso++;
                    } else {
                        badge = `<span class="badge bg-pago">Pago no Prazo</span>`;
                        infoPagamento = `<br><small style="color: #27ae60;">Pago em: ${dataPgtoBr}</small>`;
                        pagasNoPrazo++;
                    }
                    botao = '-';
                } else {
                    botao = `<button class="btn-pequeno btn-baixa" onclick="darBaixaParcela('${parcela.id}', '${parcela.vencimento}')">Receber R$</button>`;
                    
                    // Verifica se a parcela atual que ainda não foi paga já está vencida
                    const dataHoje = new Date();
                    dataHoje.setHours(0,0,0,0);
                    const dataVenc = new Date(parcela.vencimento + 'T00:00:00');
                    
                    if (dataHoje > dataVenc) {
                        badge = '<span class="badge" style="background-color: #e74c3c;">Vencida!</span>';
                    } else {
                        badge = '<span class="badge bg-pendente">A Receber</span>';
                    }
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${dataVencBr} ${infoPagamento} <br><small style="color:#7f8c8d">${parcela.numeroReferencia}</small></td>
                    <td><strong>${valorF}</strong></td>
                    <td>${badge}</td>
                    <td>${botao}</td>
                `;
                tabelaParcelas.appendChild(tr);
            });
        }

        // Chama a função para exibir a nota do cliente
        calcularScoreCliente(pagasNoPrazo, pagasComAtraso);

    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
    }
}

// Função que calcula a nota do cliente
function calcularScoreCliente(noPrazo, comAtraso) {
    const scoreElement = document.getElementById('score-cliente');
    const statsElement = document.getElementById('estatisticas-cliente');
    const totalPagas = noPrazo + comAtraso;
    
    if (totalPagas === 0) {
        scoreElement.innerText = "Sem Histórico";
        scoreElement.style.color = "#bdc3c7";
        statsElement.innerText = "Nenhuma parcela paga ainda.";
        return;
    }

    const taxaAcerto = (noPrazo / totalPagas) * 100;
    statsElement.innerText = `${totalPagas} parcelas pagas (${noPrazo} em dia, ${comAtraso} atrasadas)`;

    if (taxaAcerto === 100) {
        scoreElement.innerText = "Excelente (A+)";
        scoreElement.style.color = "#2ecc71"; 
    } else if (taxaAcerto >= 80) {
        scoreElement.innerText = "Bom Pagador (B)";
        scoreElement.style.color = "#f1c40f"; 
    } else if (taxaAcerto >= 50) {
        scoreElement.innerText = "Atenção (C)";
        scoreElement.style.color = "#e67e22"; 
    } else {
        scoreElement.innerText = "Alto Risco (D)";
        scoreElement.style.color = "#e74c3c"; 
    }
}

// ==========================================
// 3. GERAR PARCELAS (DIVIDIR A VENDA)
// ==========================================
window.gerarParcelas = async function(vendaId, valorTotal) {
    const qtdParcelasStr = prompt(`Dividir a compra de R$ ${valorTotal.toFixed(2)} em quantas vezes? (Máximo 12)`);
    const qtdParcelas = parseInt(qtdParcelasStr);

    if (isNaN(qtdParcelas) || qtdParcelas <= 0 || qtdParcelas > 12) {
        alert("Número de parcelas inválido. Operação cancelada.");
        return;
    }

    const valorParcela = valorTotal / qtdParcelas;
    const dataHoje = new Date();

    try {
        // Cria cada parcela no banco de dados
        for (let i = 1; i <= qtdParcelas; i++) {
            // Adiciona 1 mês para cada parcela a partir de hoje
            let vencimento = new Date(dataHoje.getFullYear(), dataHoje.getMonth() + i, dataHoje.getDate());
            let dataString = vencimento.toISOString().split('T')[0]; // Formato YYYY-MM-DD para o banco

            await addDoc(collection(db, "parcelas"), {
                clienteId: clienteId,
                vendaId: vendaId,
                numeroReferencia: `Parc. ${i}/${qtdParcelas}`,
                valor: valorParcela,
                vencimento: dataString,
                status: 'Pendente',
                dataGeracao: serverTimestamp()
            });
        }

        // Atualiza a venda para "Parcelado" para ela sumir da lista da esquerda
        await updateDoc(doc(db, "vendas", vendaId), {
            statusPagamento: 'Parcelado'
        });

        alert("Carnê gerado com sucesso!");
        carregarVendasEParcelas(); // Recarrega a tela

    } catch (error) {
        console.error("Erro ao gerar parcelas:", error);
        alert("Erro ao gerar parcelas.");
    }
};

// ==========================================
// 4. DAR BAIXA NA PARCELA (PAGAMENTO INTELIGENTE)
// ==========================================
window.darBaixaParcela = async function(parcelaId, vencimentoString) {
    const confirmar = confirm("Confirmar o recebimento desta parcela? O sistema registrará a data de hoje para a análise do cliente.");
    
    if (confirmar) {
        try {
            // Verifica as datas para descobrir se houve atraso
            const dataHoje = new Date();
            // Pega a data de vencimento e ajusta pro final do dia para não dar falso positivo de atraso
            const dataVencimento = new Date(vencimentoString + 'T23:59:59'); 
            
            let diasAtraso = 0;

            if (dataHoje > dataVencimento) {
                // Calcula a diferença em dias
                const diferencaTempo = Math.abs(dataHoje - dataVencimento);
                diasAtraso = Math.ceil(diferencaTempo / (1000 * 60 * 60 * 24));
            }

            await updateDoc(doc(db, "parcelas", parcelaId), {
                status: 'Pago',
                dataPagamento: dataHoje.toISOString(), // Salva a data exata da baixa
                recebidoPor: localStorage.getItem('userName') || "Desconhecido",
                diasAtraso: diasAtraso // Salva os dias de atraso no banco
            });
            
            alert(diasAtraso > 0 ? `Pagamento registrado com ${diasAtraso} dia(s) de atraso!` : "Pagamento recebido no prazo!");
            carregarVendasEParcelas(); // Recarrega para atualizar a tabela e o Score
            
        } catch (error) {
            console.error("Erro ao dar baixa:", error);
            alert("Erro ao processar o pagamento.");
        }
    }
};

// Inicia as chamadas ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    carregarPerfilCliente();
    carregarVendasEParcelas();
});