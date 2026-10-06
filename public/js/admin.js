let adminTicketsLoaded = false;

(async () => {
    try {
        const me = await api('/api/me');
        if (!me.user || me.user.role !== 'admin') { location.href = '/'; return; }
        const { stats, recent } = await api('/api/admin/stats');

        $('#stats').innerHTML = Object.entries(stats).map(([k,v]) => `
            <div class="card stat"><span class="muted">${statLabel(k)}</span><strong>${v}</strong></div>
        `).join('');

        $('#recent').innerHTML = recent.map(i => `
            <tr>
                <td>${i.id}</td><td>${i.type === 'lost' ? 'Perdido' : 'Encontrado'}</td>
                <td>${escapeHtml(i.title)}</td>
                <td><span class="badge status-badge ${statusClass(i.status)}">${statusLabel(i.status)}</span></td>
                <td><a class="btn btn-secondary table-btn" href="/pages/item.html?id=${i.id}">Ver detalhes</a></td>
            </tr>
        `).join('') || '<tr><td colspan="5">Nenhum registro.</td></tr>';
    } catch (e) {
        $('#admin')?.insertAdjacentHTML('afterbegin', `<p class="danger-text">${escapeHtml(e.message)}</p>`);
    }
})();

function statLabel(key) {
    return { users:'Usuários ativos', items:'Registros', lost:'Perdidos ativos', found:'Encontrados', open:'Abertos', resolved:'Arquivados / resolvidos' }[key] || key;
}
