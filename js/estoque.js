import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, doc, deleteDoc, updateDoc, 
    query, orderBy, limit, getDoc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Variáveis de Controle
let gradeTemporaria = []; 
let editandoId = null; 

document.addEventListener('DOMContentLoaded', () => {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    if (!empresaId) {
        alert("Sessão inválida.");
        window.location.href = "../index.html";
        return;
    }
    
    document.getElementById('nome-utilizador').innerText = localStorage.getItem('VESTIO_USER_NAME') || 'Admin';

    carregarProdutos(empresaId);

    // Botão Adicionar à Grade
    document.getElementById('btn-add-grade').addEventListener('click', () => {
        const tamanho = document.getElementById('tamanho-grade').value;
        const cor = document.getElementById('cor-grade').value.toUpperCase();
        const qtd = parseInt(document.getElementById('qtd-grade').value);

        if (!cor || qtd <= 0) {
            Swal.fire('Atenção', 'Preencha a cor e quantidade.', 'warning');
            return;
        }

        gradeTemporaria.push({ tamanho, cor, qtd });
        renderizarGradeVisual();
        
        document.getElementById('cor-grade').value = '';
        document.getElementById('qtd-grade').value = 1;
        document.getElementById('cor-grade').focus();
    });

    // Botão Salvar Produto
    document.getElementById('btn-salvar-produto').addEventListener('click', async () => {
        const btn = document.getElementById('btn-salvar-produto');
        const nome = document.getElementById('nome-produto').value;
        const categoria = document.getElementById('categoria-produto').value;
        const marca = document.getElementById('marca-produto').value;
        const custo = parseFloat(document.getElementById('preco-custo').value) || 0;
        const venda = parseFloat(document.getElementById('preco-venda').value) || 0;

        if (!nome || !venda) {
            Swal.fire('Erro', 'Nome e Preço de Venda são obrigatórios.', 'error');
            return;
        }

        if (gradeTemporaria.length === 0) {
            Swal.fire('Atenção', 'Adicione pelo menos um item à grade.', 'warning');
            return;
        }

        const estoqueTotal = gradeTemporaria.reduce((acc, item) => acc + item.qtd, 0);

        btn.disabled = true;
        btn.innerText = "Salvando...";

        try {
            const produtoData = {
                nome, 
                categoria, 
                marca, 
                precoCusto: custo, 
                precoVenda: venda,
                grade: gradeTemporaria,
                estoqueTotal: estoqueTotal,
                dataAtualizacao: Timestamp.now()
            };

            if (editandoId) {
                await updateDoc(doc(db, "empresas", empresaId, "produtos", editandoId), produtoData);
                Swal.fire('Sucesso', 'Produto atualizado!', 'success');
            } else {
                produtoData.dataCriacao = Timestamp.now();
                await addDoc(collection(db, "empresas", empresaId, "produtos"), produtoData);
                Swal.fire('Sucesso', 'Produto cadastrado!', 'success');
            }

            limparFormulario();
            carregarProdutos(empresaId);

        } catch (error) {
            console.error("Erro ao salvar:", error);
            Swal.fire('Erro', 'Erro ao salvar produto.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerText = "Salvar Produto";
        }
    });

    document.getElementById('btn-cancelar-edicao').addEventListener('click', limparFormulario);

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await signOut(auth);
        localStorage.clear();
        window.location.href = "../index.html";
    });
});

function renderizarGradeVisual() {
    const lista = document.getElementById('lista-grade-visual');
    lista.innerHTML = '';

    gradeTemporaria.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.cssText = "background:rgba(255,255,255,0.05); padding:5px 10px; margin-bottom:5px; border-radius:6px; display:flex; justify-content:space-between; font-size:11px; color:white; align-items:center;";
        div.innerHTML = `
            <span><b>${item.tamanho}</b> - ${item.cor} (${item.qtd})</span>
            <button onclick="window.removerItemGrade(${index})" style="background:none; border:none; color:#FF453A; cursor:pointer;">✕</button>
        `;
        lista.appendChild(div);
    });
}

window.removerItemGrade = function(index) {
    gradeTemporaria.splice(index, 1);
    renderizarGradeVisual();
}

async function carregarProdutos(empresaId) {
    const tbody = document.getElementById('lista-produtos');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; font-size:12px;">Carregando...</td></tr>';

    try {
        // LIMITADO A 6 PARA NÃO POLUIR
        const q = query(
            collection(db, "empresas", empresaId, "produtos"),
            orderBy("dataAtualizacao", "desc"),
            limit(6) 
        );

        const snapshot = await getDocs(q);
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; font-size:12px;">Nenhum produto.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const prod = docSnap.data();
            const tr = document.createElement('tr');
            // Estilo mais compacto na tabela
            tr.innerHTML = `
                <td style="padding: 8px;">
                    <div style="font-weight:bold; font-size:13px; color:white;">${prod.nome}</div>
                </td>
                <td style="padding: 8px; font-size:12px;">${prod.categoria}</td>
                <td style="padding: 8px; font-size:12px; color:#30D158;">R$ ${parseFloat(prod.precoVenda).toFixed(2)}</td>
                <td style="padding: 8px;"><span class="badge" style="background:rgba(10,132,255,0.1); color:#64D2FF; font-size:10px; padding:2px 6px;">${prod.estoqueTotal} un</span></td>
                <td style="padding: 8px; display:flex; gap:5px;">
                    <button onclick="window.verGrade('${docSnap.id}')" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Ver Grade">🔍</button>
                    <button onclick="window.editarProduto('${docSnap.id}')" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Editar">✏️</button>
                    <button onclick="window.excluirProduto('${docSnap.id}')" style="background:none; border:none; cursor:pointer; font-size:14px;" title="Excluir">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Erro ao carregar.</td></tr>';
    }
}

// Visualizar Grade (Modal)
window.verGrade = async function(id) {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    const docRef = doc(db, "empresas", empresaId, "produtos", id);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
        const p = snap.data();
        let html = '<ul style="text-align:left; list-style:none; padding:0; margin:0;">';
        if (p.grade && p.grade.length > 0) {
            p.grade.forEach(g => {
                html += `<li style="padding:5px; border-bottom:1px solid #333; display:flex; justify-content:space-between; font-size:13px;">
                    <span>Tam: <b>${g.tamanho}</b> | Cor: <b>${g.cor}</b></span>
                    <span>Qtd: <b>${g.qtd}</b></span>
                </li>`;
            });
        } else {
            html += '<li>Sem grade definida.</li>';
        }
        html += '</ul>';
        
        Swal.fire({
            title: p.nome,
            html: html,
            background: '#1e293b',
            color: '#fff',
            confirmButtonText: 'Fechar'
        });
    }
}

window.editarProduto = async function(id) {
    const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
    const docRef = doc(db, "empresas", empresaId, "produtos", id);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
        const d = snap.data();
        editandoId = id;

        document.getElementById('nome-produto').value = d.nome;
        document.getElementById('categoria-produto').value = d.categoria;
        document.getElementById('marca-produto').value = d.marca;
        document.getElementById('preco-custo').value = d.precoCusto;
        document.getElementById('preco-venda').value = d.precoVenda;

        gradeTemporaria = d.grade || [];
        renderizarGradeVisual();

        document.getElementById('btn-salvar-produto').innerText = "Atualizar";
        document.getElementById('btn-cancelar-edicao').style.display = 'block';
        
        // Rolar suavemente para o topo do form
        document.querySelector('.card-form').scrollIntoView({ behavior: 'smooth' });
    }
}

window.excluirProduto = async function(id) {
    const res = await Swal.fire({
        title: 'Excluir?',
        text: "Essa ação não pode ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        background: '#1e293b', color: '#fff',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, excluir'
    });

    if(res.isConfirmed) {
        const empresaId = localStorage.getItem('VESTIO_EMPRESA_ID');
        await deleteDoc(doc(db, "empresas", empresaId, "produtos", id));
        carregarProdutos(empresaId);
        Swal.fire({title: 'Excluído!', icon: 'success', background: '#1e293b', color: '#fff'});
    }
}

function limparFormulario() {
    editandoId = null;
    document.getElementById('nome-produto').value = '';
    document.getElementById('marca-produto').value = '';
    document.getElementById('preco-custo').value = '';
    document.getElementById('preco-venda').value = '';
    
    gradeTemporaria = [];
    renderizarGradeVisual();
    
    document.getElementById('btn-salvar-produto').innerText = "Salvar Produto";
    document.getElementById('btn-cancelar-edicao').style.display = 'none';
}