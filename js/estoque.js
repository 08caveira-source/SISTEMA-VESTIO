import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, doc, deleteDoc, updateDoc, 
    query, orderBy, limit, getDoc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let gradeTemporaria = []; 
let editandoId = null; 

document.addEventListener('DOMContentLoaded', () => {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) { alert("Sessão inválida."); window.location.href = "../index.html"; return; }
    document.getElementById('nome-utilizador').innerText = localStorage.getItem('VESTIO_USER_NAME') || 'Admin';
    carregarProdutos(empresaId);

    document.getElementById('btn-add-grade').addEventListener('click', () => {
        const tamanho = document.getElementById('tamanho-grade').value;
        const cor = document.getElementById('cor-grade').value.toUpperCase();
        const qtd = parseInt(document.getElementById('qtd-grade').value);
        if (!cor || qtd <= 0) return Swal.fire('Atenção', 'Preencha a cor e quantidade.', 'warning');
        gradeTemporaria.push({ tamanho, cor, qtd });
        renderizarGradeVisual();
        document.getElementById('cor-grade').value = '';
        document.getElementById('qtd-grade').value = 1;
        document.getElementById('cor-grade').focus();
    });

    document.getElementById('btn-salvar-produto').addEventListener('click', async () => {
        const btn = document.getElementById('btn-salvar-produto');
        const nome = document.getElementById('nome-produto').value;
        const categoria = document.getElementById('categoria-produto').value;
        const marca = document.getElementById('marca-produto').value;
        const custo = parseFloat(document.getElementById('preco-custo').value) || 0;
        const venda = parseFloat(document.getElementById('preco-venda').value) || 0;

        if (!nome || !venda) return Swal.fire('Erro', 'Nome e Preço de Venda são obrigatórios.', 'error');

        const estoqueTotal = gradeTemporaria.length > 0 ? gradeTemporaria.reduce((acc, item) => acc + item.qtd, 0) : 1;
        btn.disabled = true; btn.innerText = "Salvando...";

        try {
            const produtoData = { nome, categoria, marca, precoCusto: custo, precoVenda: venda, grade: gradeTemporaria, estoqueTotal: estoqueTotal, dataAtualizacao: Timestamp.now() };
            if (editandoId) {
                await updateDoc(doc(db, "empresas", empresaId, "produtos", editandoId), produtoData);
                Swal.fire('Sucesso', 'Produto atualizado!', 'success');
            } else {
                produtoData.dataCriacao = Timestamp.now();
                await addDoc(collection(db, "empresas", empresaId, "produtos"), produtoData);
                Swal.fire('Sucesso', 'Produto cadastrado!', 'success');
            }
            limparFormulario(); carregarProdutos(empresaId);
        } catch (error) { console.error("Erro ao salvar:", error); Swal.fire('Erro', 'Erro ao salvar produto.', 'error'); } 
        finally { btn.disabled = false; btn.innerText = "Salvar Produto"; }
    });

    document.getElementById('btn-cancelar-edicao').addEventListener('click', limparFormulario);
    document.getElementById('btn-logout').addEventListener('click', async () => { await signOut(auth); localStorage.clear(); window.location.href = "../index.html"; });
});

function renderizarGradeVisual() {
    const lista = document.getElementById('lista-grade-visual');
    lista.innerHTML = '';
    gradeTemporaria.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.cssText = "background:rgba(255,255,255,0.05); padding:5px 10px; margin-bottom:5px; border-radius:6px; display:flex; justify-content:space-between; font-size:11px; color:white; align-items:center;";
        div.innerHTML = `<span><b>${item.tamanho}</b> - ${item.cor} (${item.qtd})</span> <button onclick="window.removerItemGrade(${index})" style="background:none; border:none; color:#FF453A; cursor:pointer;">✕</button>`;
        lista.appendChild(div);
    });
}

window.removerItemGrade = function(index) { gradeTemporaria.splice(index, 1); renderizarGradeVisual(); }

async function carregarProdutos(empresaId) {
    const tbody = document.getElementById('lista-produtos');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; font-size:12px;">Carregando...</td></tr>';
    try {
        const q = query(collection(db, "empresas", empresaId, "produtos"), orderBy("dataAtualizacao", "desc"), limit(20));
        const snapshot = await getDocs(q);
        tbody.innerHTML = '';
        if (snapshot.empty) return tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; font-size:12px;">Nenhum produto.</td></tr>';

        snapshot.forEach(docSnap => {
            const prod = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 8px;"><div style="font-weight:bold; font-size:13px; color:white;">${prod.nome}</div></td>
                <td style="padding: 8px; font-size:12px;">${prod.categoria}</td>
                <td style="padding: 8px; font-size:12px; color:#30D158;">R$ ${parseFloat(prod.precoVenda).toFixed(2)}</td>
                <td style="padding: 8px;"><span class="badge" style="background:rgba(10,132,255,0.1); color:#64D2FF; font-size:10px; padding:2px 6px;">${prod.estoqueTotal} un</span></td>
                <td style="padding: 8px; display:flex; gap:5px;">
                    <button onclick="window.previewEtiquetaProduto('${docSnap.id}')" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Imprimir Etiqueta da Peça">📠</button>
                    <button onclick="window.verGrade('${docSnap.id}')" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Ver Grade">🔍</button>
                    <button onclick="window.editarProduto('${docSnap.id}')" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Editar">✏️</button>
                    <button onclick="window.excluirProduto('${docSnap.id}')" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Excluir">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Erro ao carregar.</td></tr>'; }
}

// ==========================================
// PRÉ-VISUALIZAÇÃO E IMPRESSÃO DE ETIQUETA 5x9 CM DA ROUPA (CORRIGIDO PARA NÃO TRANSBORDAR)
// ==========================================
window.previewEtiquetaProduto = async function(idProduto) {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    Swal.fire({ title: 'Carregando...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background:'#1e293b', color:'#fff' });
    
    const snap = await getDoc(doc(db, "empresas", empresaId, "produtos", idProduto));
    if (!snap.exists()) return Swal.fire('Erro', 'Produto não encontrado.', 'error');
    const p = snap.data();

    let tamanhoSelecionado = "Tamanho Único";
    let indexEscolhido = null;

    if (p.grade && p.grade.length > 0) {
        Swal.close();
        let options = {};
        p.grade.forEach((g, i) => { options[i] = `Tam: ${g.tamanho} | Cor: ${g.cor}`; });
        
        const { value: index } = await Swal.fire({
            title: 'Qual Variação Imprimir?',
            text: 'Isto irá gerar um código de barras específico para esta cor e tamanho:',
            input: 'select',
            inputOptions: options,
            inputPlaceholder: 'Escolha uma opção...',
            showCancelButton: true,
            background: '#1e293b', color: '#fff'
        });
        
        if (!index) return; 
        indexEscolhido = index;
        tamanhoSelecionado = `${p.grade[index].tamanho} / ${p.grade[index].cor}`;
        Swal.fire({ title: 'Gerando...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background:'#1e293b', color:'#fff' });
    }

    const barcodeValue = indexEscolhido !== null ? `${idProduto}-${indexEscolhido}` : idProduto;

    let lojaLogo = "", lojaTel = "", lojaInsta = "";
    const confSnap = await getDoc(doc(db, "empresas", empresaId, "configuracoes", "dados_loja"));
    if (confSnap.exists()) {
        const c = confSnap.data();
        lojaLogo = c.logo || "";
        lojaTel = c.telefone || "Não informado";
        lojaInsta = c.instagram || "";
    }

    Swal.close();

    const tela = window.open('', '_blank', 'width=450,height=700');
    
    // Aumentado a altura máxima da logomarca de 25px para 40px
    const logoHtml = lojaLogo ? `<img src="${lojaLogo}" style="max-height: 40px; max-width: 90%; margin-bottom: 5px; object-fit: contain;">` : '<h2 style="margin: 0 0 5px 0; font-size: 14px;">Sua Loja</h2>';
    const precoFormatado = parseFloat(p.precoVenda).toFixed(2).replace('.', ',');

    tela.document.write(`
        <html>
        <head>
            <title>Preview Etiqueta 5x9</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"><\/script>
            <style>
                @page { size: 5cm 9cm; margin: 0; }
                body { background: #334155; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 20px; font-family: Arial, sans-serif; }
                
                .painel-controle { background: #1e293b; width: 100%; text-align: center; padding: 15px 0; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); position: fixed; top: 0; left: 0; z-index: 100; color: white; }
                .btn-imprimir { background: #FF453A; color: white; border: none; padding: 12px 25px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; text-transform: uppercase; }
                
                .etiqueta-wrapper { margin-top: 80px; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                
                .etiqueta { 
                    width: 5cm; height: 9cm; border: 1px dashed #ccc; 
                    box-sizing: border-box; text-align: center; position: relative; 
                    background: #fff; color: #000; padding: 8px 5px;
                    display: flex; flex-direction: column; justify-content: space-between;
                    overflow: hidden;
                }
                
                .nome-prod { font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 2px 0; line-height: 1.1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;}
                .tipo-prod { font-size: 9px; color: #444; margin: 2px 0; }
                .tam-prod { font-size: 11px; font-weight: 900; margin: 4px 0; border: 1px solid #000; display: inline-block; padding: 2px 6px; border-radius: 3px; }
                
                .contatos { font-size: 8px; margin: 2px 0; color: #333; }
                .aviso-troca { font-size: 7px; font-weight: bold; text-transform: uppercase; margin: 5px 2px; padding-bottom: 5px; border-bottom: 1px dashed #999; line-height: 1.1; }
                
                .preco-prod { font-size: 22px; font-weight: 900; margin-top: 2px; letter-spacing: -0.5px; }
                
                @media print {
                    body { background: white; padding: 0; margin: 0; align-items: flex-start; }
                    .painel-controle { display: none !important; }
                    .etiqueta-wrapper { margin: 0; padding: 0; box-shadow: none; border: none; }
                    .etiqueta { border: none; }
                }
            </style>
        </head>
        <body>
            <div class="painel-controle no-print">
                <p style="margin: 0 0 10px 0; font-size: 12px;">Pré-visualização da etiqueta de roupa (5x9cm).</p>
                <button class="btn-imprimir" onclick="window.print()">🖨️ CONFIRMAR E IMPRIMIR</button>
            </div>

            <div class="etiqueta-wrapper">
                <div class="etiqueta">
                    <div>
                        ${logoHtml}
                        <div class="nome-prod">${p.nome}</div>
                        <div class="tipo-prod">${p.categoria}</div>
                        <div class="tam-prod">${tamanhoSelecionado}</div>
                    </div>
                    
                    <div style="margin: 5px 0; width: 100%; display: flex; justify-content: center;">
                        <svg id="barcode" style="max-width: 95%; height: auto;"></svg>
                    </div>
                    
                    <div>
                        <div class="contatos">📞 ${lojaTel} &nbsp; 📷 ${lojaInsta}</div>
                        <div class="aviso-troca">⚠ Trocas somente com esta etiqueta fixada na peça.</div>
                        <div class="preco-prod">R$ ${precoFormatado}</div>
                    </div>
                </div>
            </div>

            <script>
                // width: 1 força o desenho mais fino para ajudar, o CSS max-width faz o resto do trabalho
                JsBarcode("#barcode", "${barcodeValue}", { 
                    format: "CODE128", 
                    width: 1, 
                    height: 30, 
                    displayValue: true, 
                    fontSize: 10,
                    margin: 0
                });
            <\/script>
        </body>
        </html>
    `);
}

window.verGrade = async function(id) {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    const snap = await getDoc(doc(db, "empresas", empresaId, "produtos", id));
    if (snap.exists()) {
        const p = snap.data(); let html = '<ul style="text-align:left; list-style:none; padding:0; margin:0;">';
        if (p.grade && p.grade.length > 0) {
            p.grade.forEach(g => { html += `<li style="padding:5px; border-bottom:1px solid #333; display:flex; justify-content:space-between; font-size:13px;"><span>Tam: <b>${g.tamanho}</b> | Cor: <b>${g.cor}</b></span><span>Qtd: <b>${g.qtd}</b></span></li>`; });
        } else { html += '<li>Sem grade definida.</li>'; }
        Swal.fire({ title: p.nome, html: html += '</ul>', background: '#1e293b', color: '#fff', confirmButtonText: 'Fechar' });
    }
}

window.editarProduto = async function(id) {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    const snap = await getDoc(doc(db, "empresas", empresaId, "produtos", id));
    if (snap.exists()) {
        const d = snap.data(); editandoId = id;
        document.getElementById('nome-produto').value = d.nome; document.getElementById('categoria-produto').value = d.categoria;
        document.getElementById('marca-produto').value = d.marca; document.getElementById('preco-custo').value = d.precoCusto;
        document.getElementById('preco-venda').value = d.precoVenda;
        gradeTemporaria = d.grade || []; renderizarGradeVisual();
        document.getElementById('btn-salvar-produto').innerText = "Atualizar"; document.getElementById('btn-cancelar-edicao').style.display = 'block';
        document.querySelector('.card-form').scrollIntoView({ behavior: 'smooth' });
    }
}

window.excluirProduto = async function(id) {
    const res = await Swal.fire({ title: 'Excluir?', text: "Essa ação não pode ser desfeita.", icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#d33', confirmButtonText: 'Sim, excluir' });
    if(res.isConfirmed) {
        const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
        await deleteDoc(doc(db, "empresas", empresaId, "produtos", id)); carregarProdutos(empresaId); Swal.fire({title: 'Excluído!', icon: 'success', background: '#1e293b', color: '#fff'});
    }
}

function limparFormulario() { editandoId = null; document.getElementById('nome-produto').value = ''; document.getElementById('marca-produto').value = ''; document.getElementById('preco-custo').value = ''; document.getElementById('preco-venda').value = ''; gradeTemporaria = []; renderizarGradeVisual(); document.getElementById('btn-salvar-produto').innerText = "Salvar Produto"; document.getElementById('btn-cancelar-edicao').style.display = 'none'; }