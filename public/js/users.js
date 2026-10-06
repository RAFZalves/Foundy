let editingUserId = null;
let usersCache = new Map();

async function loadUsers() {
    try {
        const q = $('#userSearch')?.value || '';
        const { users } = await api('/api/admin/users?q=' + encodeURIComponent(q));
        usersCache = new Map(users.map(u => [u.id, u]));
        $('#users').innerHTML = users.map(u => `
            <tr class="${u.active ? '' : 'user-inactive'}">
                <td>${escapeHtml(u.name)}</td>
                <td>${escapeHtml(u.cgm || '—')}</td>
                <td>${escapeHtml(u.turma || '—')}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(roleLabel(u.role))}</td>
                <td>${u.active ? '<span class="badge status-open">Ativo</span>' : '<span class="badge status-archived">Bloqueado</span>'}</td>
                <td><button class="btn btn-secondary table-btn" onclick="editUser(${u.id})">Editar</button>${u.active && u.role === 'student' ? ` <button class="btn btn-danger table-btn" onclick="blockUser(${u.id})">Bloquear</button>` : ''}</td>
            </tr>
        `).join('') || '<tr><td colspan="7">Nenhum usuário encontrado.</td></tr>';
    } catch (e) { toast(e.message); }
}

function editUser(id) {
    const u = usersCache.get(id);
    if (!u) return;
    editingUserId = u.id;
    $('#userModalTitle').textContent = `Editar ${u.name}`;
    $('#editUserForm').elements.name.value = u.name || '';
    $('#editUserForm').elements.email.value = u.email || '';
    $('#editUserForm').elements.cgm.value = u.cgm || '';
    $('#editUserForm').elements.turma.value = u.turma || '';
    $('#editUserForm').elements.role.value = u.role || 'student';
    $('#editUserForm').elements.password.value = '';
    $('#userModal').classList.remove('hidden');
}

function closeUserModal() { $('#userModal')?.classList.add('hidden'); }

async function saveUser(e) {
    e.preventDefault();
    try {
        const data = Object.fromEntries(new FormData(e.target));
        await api(`/api/admin/users/${editingUserId}`, { method: 'PATCH', body: JSON.stringify(data) });
        toast('Dados do usuário atualizados.');
        closeUserModal();
        loadUsers();
    } catch (err) { toast(err.message); }
}

async function createUser(e) {
    e.preventDefault();
    try {
        const data = Object.fromEntries(new FormData(e.target));
        await api('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
        e.target.reset();
        toast('Usuário cadastrado.');
        loadUsers();
    } catch (err) { toast(err.message); }
}

async function blockUser(id) {
    if (!confirm('Bloquear este aluno? O histórico será preservado e o CGM ficará impedido de criar outra conta.')) return;
    try {
        await api('/api/admin/users/' + id, { method: 'DELETE' });
        toast('Aluno bloqueado.');
        loadUsers();
    } catch (e) { toast(e.message); }
}

document.addEventListener('DOMContentLoaded', async () => {
    const me = await api('/api/me').catch(() => ({user:null}));
    if (!me.user || me.user.role !== 'admin') { location.href = '/'; return; }
    loadUsers();
    $('#userSearch')?.addEventListener('input', loadUsers);
    $('#editUserForm')?.addEventListener('submit', saveUser);
    $('#createUserForm')?.addEventListener('submit', createUser);
    $('#closeUserModal')?.addEventListener('click', closeUserModal);
});
