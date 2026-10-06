const supportStudentView = $('#studentSupport');
const supportAdminView = $('#adminSupport');

async function initSupport() {
    try {
        const { user } = await api('/api/me');
        if (!user) { location.href = '/pages/login.html'; return; }
        if (user.role === 'admin') {
            supportStudentView?.classList.add('hidden');
            supportAdminView?.classList.remove('hidden');
            await loadAdminTickets();
        } else {
            supportAdminView?.classList.add('hidden');
            supportStudentView?.classList.remove('hidden');
            await loadStudentTickets();
        }
    } catch (e) { toast(e.message); }
}

async function loadStudentTickets() {
    const box = $('#studentTickets');
    if (!box) return;
    try {
        const { tickets } = await api('/api/support');
        box.innerHTML = tickets.map(t => `
            <article class="card support-ticket">
                <div class="support-ticket-head"><div><span class="muted">Chamado #${t.id}</span><h3>${escapeHtml(t.subject)}</h3></div><span class="badge support-${t.status}">${supportStatusLabel(t.status)}</span></div>
                <p>${escapeHtml(t.message)}</p>
                ${t.response_text ? `<div class="support-response"><strong>Resposta do administrador</strong><p>${escapeHtml(t.response_text)}</p></div>` : `<p class="muted support-waiting">Aguardando resposta do administrador.</p>`}
            </article>
        `).join('') || '<p class="muted">Você ainda não abriu nenhum chamado.</p>';
    } catch (e) { box.innerHTML = `<p class="danger-text">${escapeHtml(e.message)}</p>`; }
}

async function loadAdminTickets() {
    const box = $('#adminTickets');
    if (!box) return;
    try {
        const { tickets } = await api('/api/admin/support');
        box.innerHTML = tickets.map(t => `
            <article class="card support-ticket admin-ticket">
                <div class="support-ticket-head"><div><span class="muted">Chamado #${t.id} · ${escapeHtml(t.user_name)}</span><h3>${escapeHtml(t.subject)}</h3><small class="muted">${escapeHtml(t.user_email)}${t.user_cgm ? ' · CGM ' + escapeHtml(t.user_cgm) : ''}${t.user_turma ? ' · ' + escapeHtml(t.user_turma) : ''}</small></div><span class="badge support-${t.status}">${supportStatusLabel(t.status)}</span></div>
                <div class="support-message"><strong>Mensagem</strong><p>${escapeHtml(t.message)}</p></div>
                ${t.status === 'closed' ? `<div class="support-response"><strong>Resposta enviada</strong><p>${escapeHtml(t.response_text)}</p></div>` : `<div class="field"><label for="response-${t.id}">Resposta</label><textarea id="response-${t.id}" class="support-response-input" placeholder="Escreva a resposta...">${escapeHtml(t.response_text || '')}</textarea></div><div class="actions"><button class="btn btn-primary" onclick="answerTicket(${t.id})">${t.response_text ? 'Atualizar resposta' : 'Responder'}</button><button class="btn btn-secondary" onclick="closeTicket(${t.id})" ${t.response_text ? '' : 'disabled'}>Concluir chamado</button></div><p class="muted support-close-hint">${t.response_text ? 'Depois da resposta, o chamado pode ser concluído.' : 'O chamado só pode ser concluído depois de uma resposta.'}</p>`}
            </article>
        `).join('') || '<p class="muted">Nenhum chamado de suporte.</p>';
    } catch (e) { box.innerHTML = `<p class="danger-text">${escapeHtml(e.message)}</p>`; }
}

async function answerTicket(id) {
    const response = $(`#response-${id}`)?.value.trim();
    if (!response) return toast('Escreva uma resposta antes de enviar.');
    try { await api(`/api/admin/support/${id}/answer`, { method:'PATCH', body:JSON.stringify({response}) }); toast('Resposta enviada.'); await loadAdminTickets(); }
    catch (e) { toast(e.message); }
}

async function closeTicket(id) {
    const response = $(`#response-${id}`)?.value.trim();
    if (!response) return toast('Responda o chamado antes de concluí-lo.');
    try {
        await api(`/api/admin/support/${id}/answer`, { method:'PATCH', body:JSON.stringify({response}) });
        await api(`/api/admin/support/${id}/close`, { method:'PATCH' });
        toast('Chamado respondido e concluído.');
        await loadAdminTickets();
    } catch (e) { toast(e.message); }
}

document.addEventListener('DOMContentLoaded', initSupport);
