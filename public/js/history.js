async function loadHistory() {
    try {
        const q = $('#historySearch')?.value || '';
        const { history } = await api('/api/admin/history?q=' + encodeURIComponent(q));
        $('#history').innerHTML = history.map(h => `
            <tr>
                <td>${h.id}</td>
                <td><a href="/pages/item.html?id=${h.id}">${escapeHtml(h.title)}</a></td>
                <td>${escapeHtml(h.reporter)}</td>
                <td>${escapeHtml(h.withdrawn_name || '—')}</td>
                <td>${escapeHtml(h.withdrawn_turma || '—')}</td>
                <td>${escapeHtml(h.withdrawn_cgm || '—')}</td>
                <td><span class="badge status-badge ${statusClass(h.status)}">${statusLabel(h.status)}</span></td>
                <td>${escapeHtml(h.withdrawn_at || h.updated_at || '—')}</td>
            </tr>
        `).join('') || '<tr><td colspan="8">Nenhum histórico encontrado.</td></tr>';
    } catch (e) { toast(e.message); }
}

document.addEventListener('DOMContentLoaded', async () => {
    const me = await api('/api/me').catch(() => ({user:null}));
    if (!me.user || me.user.role !== 'admin') { location.href = '/'; return; }
    loadHistory();
    $('#historySearch')?.addEventListener('input', loadHistory);
});
