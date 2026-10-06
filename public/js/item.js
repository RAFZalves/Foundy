let currentUser = null;
let currentItem = null;
let currentWithdrawal = null;

(async () => {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return;
    try {
        const [{ item, withdrawal }, { user }] = await Promise.all([
            api('/api/items/' + id),
            api('/api/me')
        ]);
        currentItem = item;
        currentWithdrawal = withdrawal;
        currentUser = user;
        renderItem();
    } catch (e) {
        $('#detail').innerHTML = `<div class="card form"><p>Item não encontrado.</p></div>`;
    }
})();

function renderItem() {
    const item = currentItem;
    const admin = currentUser?.role === 'admin';
    const canMarkFound = admin && !['found','archived','resolved'].includes(item.status);
    const canWithdraw = admin && item.status === 'found' && !currentWithdrawal;

    $('#detail').innerHTML = `
        <div class="card form item-detail-card">
            <div class="item-detail-top">
                <div>
                    <span class="badge ${item.type === 'lost' ? 'accent' : ''}">${item.type === 'lost' ? 'PERDIDO' : 'ENCONTRADO'}</span>
                    <span class="badge status-badge ${statusClass(item.status)}">${statusLabel(item.status)}</span>
                </div>
                ${admin ? '<span class="admin-tag">VISÃO ADMINISTRATIVA</span>' : ''}
            </div>
            <h1>${escapeHtml(item.title)}</h1>
            ${item.image_filename ? `<img class="item-image" src="/uploads/${encodeURIComponent(item.image_filename)}" alt="Foto de ${escapeHtml(item.title)}">` : ''}
            <p>${escapeHtml(item.description)}</p>
            <div class="detail-grid">
                <p><b>Cor:</b><br>${escapeHtml(item.color || '—')}</p>
                <p><b>Local:</b><br>${escapeHtml(item.location || '—')}</p>
                <p><b>Sala:</b><br>${escapeHtml(item.room || '—')}</p>
                <p><b>Detalhes:</b><br>${escapeHtml(item.details || '—')}</p>
            </div>
            <p><b>Registrado por:</b> ${escapeHtml(item.reporter)}</p>

            ${canMarkFound ? `
                <div class="admin-action-box">
                    <h2>O item foi localizado?</h2>
                    <p class="muted">Ao marcar como encontrado, ele sai imediatamente do catálogo e o aluno que registrou a perda recebe uma notificação.</p>
                    <button class="btn btn-primary" onclick="markFound()">Marcar como encontrado</button>
                </div>
            ` : ''}

            ${canWithdraw ? `
                <div class="admin-action-box">
                    <h2>Registrar retirada</h2>
                    <p class="muted">Registre quem recebeu o item. Depois disso ele será arquivado e ficará apenas no histórico.</p>
                    <form id="withdrawForm">
                        <div class="grid grid-2">
                            <div class="field"><label>Nome de quem retirou</label><input name="name" required></div>
                            <div class="field"><label>Turma</label><input name="turma" required></div>
                        </div>
                        <div class="field"><label>CGM</label><input name="cgm" required></div>
                        <button class="btn btn-primary">Registrar retirada e arquivar</button>
                    </form>
                </div>
            ` : ''}

            ${currentWithdrawal ? `
                <div class="withdrawal-record">
                    <h2>Retirada registrada</h2>
                    <p><b>Nome:</b> ${escapeHtml(currentWithdrawal.name)}</p>
                    <p><b>Turma:</b> ${escapeHtml(currentWithdrawal.turma)}</p>
                    <p><b>CGM:</b> ${escapeHtml(currentWithdrawal.cgm)}</p>
                    <p><b>Registrado por:</b> ${escapeHtml(currentWithdrawal.recorded_by_name)}</p>
                    <p><b>Data:</b> ${escapeHtml(currentWithdrawal.withdrawn_at)}</p>
                </div>
            ` : ''}
        </div>
    `;

    $('#withdrawForm')?.addEventListener('submit', registerWithdrawal);
}

async function markFound() {
    if (!confirm('Marcar este item como encontrado? Ele sairá do catálogo e o aluno será notificado.')) return;
    try {
        await api(`/api/admin/items/${currentItem.id}/found`, { method: 'PATCH' });
        toast('Item marcado como encontrado.');
        setTimeout(() => location.reload(), 500);
    } catch (e) { toast(e.message); }
}

async function registerWithdrawal(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
        await api(`/api/admin/items/${currentItem.id}/withdraw`, { method: 'POST', body: JSON.stringify(data) });
        toast('Retirada registrada e item arquivado.');
        setTimeout(() => location.reload(), 500);
    } catch (err) { toast(err.message); }
}
