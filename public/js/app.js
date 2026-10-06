const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

function toast(msg) {
    let x = $('.toast');
    if (!x) {
        x = document.createElement('div');
        x.className = 'toast';
        document.body.appendChild(x);
    }
    x.textContent = msg;
    x.classList.remove('hidden');
    clearTimeout(x._timer);
    x._timer = setTimeout(() => x.classList.add('hidden'), 3200);
}

function statusLabel(status) {
    return {
        open: 'Aberto',
        matching: 'Em análise',
        found: 'Encontrado',
        resolved: 'Resolvido',
        archived: 'Arquivado'
    }[status] || status;
}

function statusClass(status) {
    return {
        open: 'status-open',
        matching: 'status-matching',
        found: 'status-found',
        resolved: 'status-resolved',
        archived: 'status-archived'
    }[status] || '';
}

function roleLabel(role) {
    return { student: 'Aluno', cleaning: 'Equipe', admin: 'Administrador' }[role] || role;
}

function supportStatusLabel(status) {
    return { open: 'Aberto', answered: 'Respondido', closed: 'Concluído' }[status] || status;
}

async function api(url, opt = {}) {
    const r = await fetch(url, {
        ...opt,
        headers: {
            ...(opt.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...(opt.headers || {})
        }
    });
    let d = {};
    try { d = await r.json(); } catch {}
    if (!r.ok) throw new Error(d.error || 'Erro');
    return d;
}

function theme() {
    const saved = localStorage.getItem('foundy-theme') || 'dark';
    document.documentElement.dataset.theme = saved;
    updateThemeButton();
}

function updateThemeButton() {
    const button = $('#themeToggle');
    if (!button) return;
    const light = document.documentElement.dataset.theme === 'light';
    button.innerHTML = light
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.6 8.6 0 1 0 20.5 15.2Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    button.setAttribute('aria-label', light ? 'Mudar para modo escuro' : 'Mudar para modo claro');
    button.title = light ? 'Modo escuro' : 'Modo claro';
}

function createThemeButton() {
    if ($('#themeToggle')) return;
    const button = document.createElement('button');
    button.id = 'themeToggle';
    button.className = 'theme-toggle-corner';
    button.type = 'button';
    button.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('foundy-theme', next);
        updateThemeButton();
    });
    document.body.appendChild(button);
    updateThemeButton();
}

function linksForUser(user) {
    if (!user) {
        return [
            ['/pages/login.html', 'Entrar']
        ];
    }
    if (user.role === 'admin') {
        return [
            ['/pages/items.html', 'Achados e perdidos'],
            ['/pages/admin.html', 'Painel administrativo'],
            ['/pages/users.html#cadastro', 'Cadastrar'],
            ['/pages/users.html', 'Usuários'],
            ['/pages/history.html', 'Histórico'],
            ['/pages/support.html', 'Suporte']
        ];
    }
    if (user.role === 'cleaning') {
        return [
            ['/pages/items.html', 'Achados e perdidos'],
            ['/pages/report-found.html', 'Registrar encontrado'],
            ['/pages/support.html', 'Suporte']
        ];
    }
    return [
        ['/pages/items.html', 'Achados e perdidos'],
        ['/pages/report-lost.html', 'Perdi algo'],
        ['/pages/support.html', 'Suporte']
    ];
}

function ensureNavigation() {
    if ($('.nav')) return;
    const header = document.createElement('header');
    header.className = 'nav';
    header.innerHTML = `
        <div class="container nav-inner">
            <a class="logo" href="/">F<span>O</span>UNDY</a>
            <button class="menu" type="button" aria-label="Abrir menu">☰</button>
            <nav class="nav-links"></nav>
            <div id="authArea"></div>
        </div>
    `;
    document.body.prepend(header);
}

async function nav() {
    const area = $('#authArea');
    const links = $('.nav-links');
    if (!area || !links) return;

    let me;
    try { me = await api('/api/me'); } catch { me = { user: null }; }
    const user = me.user;

    links.innerHTML = linksForUser(user).map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
    if (!user) {
        links.querySelectorAll('a').forEach(link => {
            if (link.getAttribute('href') !== '/pages/login.html') {
                link.addEventListener('click', event => { event.preventDefault(); location.href = '/pages/register.html'; });
            }
        });
    }

    if (user) {
        area.innerHTML = `
            <span class="muted user-greeting">Olá, ${escapeHtml(user.name)}</span>
            <a class="btn btn-secondary nav-action" href="/pages/notifications.html">Notificações</a>
            <button class="btn btn-secondary nav-action" id="logout">Sair</button>
        `;
    } else {
        area.innerHTML = `
            <a class="btn btn-secondary nav-action" href="/pages/login.html">Entrar</a>
            <a class="btn btn-primary nav-action" href="/pages/register.html">Criar conta</a>
        `;
    }

    $('#logout')?.addEventListener('click', async () => {
        await api('/api/auth/logout', { method: 'POST' });
        location.href = '/';
    });
    $('.menu')?.addEventListener('click', () => $('.nav-links')?.classList.toggle('open'));
}

function enforcePageAccess(user) {
    const protectedPages = new Set([
        '/pages/items.html', '/pages/item.html', '/pages/report-lost.html',
        '/pages/report-found.html', '/pages/support.html', '/pages/notifications.html',
        '/pages/admin.html', '/pages/users.html', '/pages/history.html'
    ]);
    const path = location.pathname;
    if (!protectedPages.has(path)) return;
    if (!user) {
        location.href = '/pages/register.html';
    }
}

function protectUnauthenticatedActions(user) {
    if (user) return;
    $$('[data-auth-required]').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            location.href = '/pages/register.html';
        });
    });
}

function backButton() {
    if (location.pathname === '/' || location.pathname.endsWith('/index.html')) return;
    if ($('.back-button')) return;
    const main = $('main');
    if (!main) return;
    const container = document.createElement('div');
    container.className = 'container back-container';
    container.innerHTML = `<button class="back-button" type="button"><span class="back-arrow">←</span><span>Voltar</span></button>`;
    main.parentNode.insertBefore(container, main);
    $('.back-button', container).addEventListener('click', () => {
        if (document.referrer && document.referrer.startsWith(location.origin)) history.back();
        else location.href = '/';
    });
}

function escapeHtml(x = '') {
    return String(x).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

document.addEventListener('DOMContentLoaded', () => {
    theme();
    createThemeButton();
    ensureNavigation();
    backButton();
    nav().then(() => api('/api/me').then(({user}) => {
        enforcePageAccess(user);
        protectUnauthenticatedActions(user);
    }).catch(() => {
        enforcePageAccess(null);
        protectUnauthenticatedActions(null);
    }));
});
