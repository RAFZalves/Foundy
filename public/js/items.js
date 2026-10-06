async function loadItems() {
    const params = new URLSearchParams();
    const q = $('#search')?.value;
    const type = $('#type')?.value;
    const status = $('#status')?.value;
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    if (status) params.set('status', status);

    const box = $('#items');
    if (!box) return;
    try {
        const { items } = await api('/api/items?' + params);
        box.innerHTML = items.map(i => `
            <article class="card item-card">
                ${i.image_filename
                    ? `<img class="item-thumb" src="/uploads/${encodeURIComponent(i.image_filename)}" alt="Foto de ${escapeHtml(i.title)}" loading="lazy">`
                    : `<div class="item-thumb item-thumb-empty"><span>Sem foto</span></div>`}
                <div class="item-card-content">
                    <span class="badge ${i.type === 'lost' ? 'accent' : ''}">${i.type === 'lost' ? 'PERDIDO' : 'ENCONTRADO'}</span>
                    <h3>${escapeHtml(i.title)}</h3>
                    <p class="muted">${escapeHtml(i.description)}</p>
                    <p><b>Local:</b> ${escapeHtml(i.location || 'Não informado')}${i.room ? ' · ' + escapeHtml(i.room) : ''}</p>
                    <span class="badge status-badge ${statusClass(i.status)}">${statusLabel(i.status)}</span>
                    <a class="btn btn-secondary item-detail-btn" href="/pages/item.html?id=${i.id}">Ver detalhes</a>
                </div>
            </article>
        `).join('') || '<p class="muted empty-state">Nenhum item disponível no catálogo.</p>';
    } catch (e) { toast(e.message); }
}

document.addEventListener('DOMContentLoaded', () => {
    loadItems();
    $('#search')?.addEventListener('input', loadItems);
    $('#type')?.addEventListener('change', loadItems);
    $('#status')?.addEventListener('change', loadItems);
});
