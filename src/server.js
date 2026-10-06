const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'foundy-dev-secret';
const TEAM_SIGNUP_CODE = process.env.TEAM_SIGNUP_CODE || 'FOUNDY-EQUIPE';

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
    destination: uploadDir,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
        const allowed = /\.(png|jpe?g|webp|gif)$/i.test(file.originalname);
        cb(null, allowed);
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

function publicUser(u) {
    return u ? {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        cgm: u.cgm || '',
        turma: u.turma || '',
        active: Number(u.active ?? 1) === 1
    } : null;
}

function auth(req, res, next) {
    try {
        const token = req.cookies.foundy_token;
        if (!token) return res.status(401).json({ error: 'Não autenticado' });
        const payload = jwt.verify(token, SECRET);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
        if (!user || Number(user.active) !== 1) {
            return res.status(401).json({ error: 'Conta desativada' });
        }
        req.user = payload;
        req.currentUser = user;
        next();
    } catch {
        return res.status(401).json({ error: 'Sessão inválida' });
    }
}

function role(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        next();
    };
}

function notify(userId, title, message, link = '') {
    db.prepare(`
        INSERT INTO notifications(user_id, title, message, link)
        VALUES (?, ?, ?, ?)
    `).run(userId, title, message, link);
}

function normalizeCGM(cgm) {
    return String(cgm || '').trim().toUpperCase();
}

function cleanText(value) {
    return String(value || '').trim();
}

function itemCatalogWhere() {
    return `i.status NOT IN ('found', 'archived', 'resolved')`;
}

/* =========================
   PÁGINAS
   ========================= */

app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'pages', 'index.html'));
});

/* =========================
   AUTENTICAÇÃO
   ========================= */

app.get('/api/me', (req, res) => {
    try {
        const token = req.cookies.foundy_token || '';
        const payload = jwt.verify(token, SECRET);
        const user = db.prepare(`SELECT id,name,email,role,cgm,turma,active FROM users WHERE id = ?`).get(payload.id);
        if (!user || Number(user.active) !== 1) return res.json({ user: null });
        res.json({ user: publicUser(user) });
    } catch {
        res.json({ user: null });
    }
});

app.post('/api/auth/register', (req, res) => {
    const {
        accountType = 'student',
        name,
        email,
        password,
        cgm,
        turma,
        teamCode
    } = req.body;

    if (!name || !email || !password || password.length < 6) {
        return res.status(400).json({ error: 'Nome, email e senha de pelo menos 6 caracteres são obrigatórios.' });
    }

    const normalizedEmail = cleanText(email).toLowerCase();
    const normalizedCGM = normalizeCGM(cgm);

    if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) {
        return res.status(409).json({ error: 'Este email já está cadastrado.' });
    }

    if (accountType === 'student') {
        if (!normalizedCGM || !cleanText(turma)) {
            return res.status(400).json({ error: 'Aluno precisa informar CGM e turma.' });
        }
        if (db.prepare('SELECT id, active FROM users WHERE cgm = ?').get(normalizedCGM)) {
            return res.status(409).json({ error: 'Este CGM já está cadastrado ou está bloqueado.' });
        }
    } else if (accountType === 'team') {
        if (cleanText(teamCode) !== TEAM_SIGNUP_CODE) {
            return res.status(403).json({ error: 'Código de equipe inválido. Peça o código ao administrador.' });
        }
    } else {
        return res.status(400).json({ error: 'Tipo de cadastro inválido.' });
    }

    const roleName = accountType === 'team' ? 'cleaning' : 'student';
    const info = db.prepare(`
        INSERT INTO users(name,email,password_hash,role,cgm,turma)
        VALUES (?,?,?,?,?,?)
    `).run(
        cleanText(name),
        normalizedEmail,
        bcrypt.hashSync(password, 10),
        roleName,
        normalizedCGM || null,
        cleanText(turma) || null
    );

    const token = jwt.sign({ id: info.lastInsertRowid, role: roleName }, SECRET, { expiresIn: '7d' });
    res.cookie('foundy_token', token, { httpOnly: true, sameSite: 'lax' }).json({ message: 'Conta criada' });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanText(email).toLowerCase());

    if (!u || Number(u.active) !== 1 || !bcrypt.compareSync(password || '', u.password_hash)) {
        return res.status(401).json({ error: 'Email ou senha incorretos, ou conta desativada.' });
    }

    const token = jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '7d' });
    res.cookie('foundy_token', token, { httpOnly: true, sameSite: 'lax' }).json({ user: publicUser(u) });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('foundy_token').json({ message: 'Saiu' });
});

/* =========================
   ITENS / CATÁLOGO
   ========================= */

app.get('/api/items', (req, res) => {
    const { type, status, q, catalog = '1' } = req.query;
    let sql = `
        SELECT i.*, u.name AS reporter
        FROM items i
        JOIN users u ON u.id = i.user_id
        WHERE 1 = 1
    `;
    const p = [];

    if (catalog !== '0') sql += ` AND ${itemCatalogWhere()}`;
    if (type) { sql += ' AND i.type = ?'; p.push(type); }
    if (status) { sql += ' AND i.status = ?'; p.push(status); }
    if (q) {
        sql += ` AND (i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ? OR i.room LIKE ? OR i.color LIKE ?)`;
        const x = `%${q}%`;
        p.push(x, x, x, x, x);
    }
    sql += ' ORDER BY i.created_at DESC';
    res.json({ items: db.prepare(sql).all(...p) });
});

app.get('/api/items/:id', (req, res) => {
    const item = db.prepare(`
        SELECT i.*, u.name AS reporter, u.cgm AS reporter_cgm, u.turma AS reporter_turma
        FROM items i
        JOIN users u ON u.id = i.user_id
        WHERE i.id = ?
    `).get(req.params.id);

    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    const withdrawal = db.prepare(`
        SELECT w.*, r.name AS recorded_by_name
        FROM item_withdrawals w
        JOIN users r ON r.id = w.recorded_by
        WHERE w.item_id = ?
    `).get(item.id) || null;

    res.json({ item, withdrawal });
});

app.post('/api/items', auth, role('student', 'cleaning'), upload.single('image'), (req, res) => {
    const { type, title, description, color, location, room, details } = req.body;

    if (!['lost', 'found'].includes(type) || !cleanText(title) || !cleanText(description)) {
        return res.status(400).json({ error: 'Preencha tipo, título e descrição.' });
    }
    if (req.user.role === 'student' && type !== 'lost') {
        return res.status(403).json({ error: 'Alunos só podem registrar itens perdidos.' });
    }
    if (req.user.role === 'cleaning' && type !== 'found') {
        return res.status(403).json({ error: 'A equipe só pode registrar itens encontrados.' });
    }

    const filename = req.file ? req.file.filename : null;
    const info = db.prepare(`
        INSERT INTO items(user_id,type,title,description,color,location,room,details,image_filename)
        VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
        req.user.id,
        type,
        cleanText(title),
        cleanText(description),
        cleanText(color),
        cleanText(location),
        cleanText(room),
        cleanText(details),
        filename
    );

    res.status(201).json({ id: info.lastInsertRowid, image_filename: filename });
});

// Compatibilidade para o fluxo antigo: apenas admin/limpeza podem alterar status.
app.patch('/api/items/:id/status', auth, role('admin'), (req, res) => {
    const status = cleanText(req.body.status);
    if (!['open', 'matching', 'found', 'resolved', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    if (status === 'found') {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Somente administradores podem marcar o item como encontrado.' });
        return markItemFound(item, res);
    }

    db.prepare('UPDATE items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, item.id);
    notify(item.user_id, 'Atualização do item', `O status de "${item.title}" mudou para ${statusLabelServer(status)}.`, `/pages/item.html?id=${item.id}`);
    res.json({ message: 'Status atualizado' });
});

function statusLabelServer(status) {
    return { open: 'aberto', matching: 'em análise', found: 'encontrado', resolved: 'resolvido', archived: 'arquivado' }[status] || status;
}

function markItemFound(item, res) {
    if (item.status === 'found' || item.status === 'archived') {
        return res.status(400).json({ error: 'Este item já está fora do catálogo de disponíveis.' });
    }

    db.prepare(`UPDATE items SET status = 'found', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(item.id);

    // For a lost report, the notification goes to the student who reported the loss.
    // For an item registered by the cleaning team, the item is already an independent
    // found record, so there is no lost owner to notify.
    if (item.type === 'lost') {
        notify(
            item.user_id,
            'Seu item foi encontrado',
            `Encontramos "${item.title}". Procure a equipe responsável para combinar a retirada.`,
            `/pages/item.html?id=${item.id}`
        );
    }

    res.json({ message: 'Item marcado como encontrado e retirado do catálogo.' });
}

app.patch('/api/admin/items/:id/found', auth, role('admin'), (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });
    return markItemFound(item, res);
});

app.post('/api/admin/items/:id/withdraw', auth, role('admin'), (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });
    if (item.status !== 'found') return res.status(400).json({ error: 'Marque o item como encontrado antes de registrar a retirada.' });
    if (db.prepare('SELECT id FROM item_withdrawals WHERE item_id = ?').get(item.id)) {
        return res.status(409).json({ error: 'A retirada deste item já foi registrada.' });
    }

    const name = cleanText(req.body.name);
    const turma = cleanText(req.body.turma);
    const cgm = normalizeCGM(req.body.cgm);
    if (!name || !turma || !cgm) return res.status(400).json({ error: 'Nome, turma e CGM são obrigatórios.' });

    const owner = db.prepare('SELECT id FROM users WHERE cgm = ? AND active = 1').get(cgm);
    const insert = db.prepare(`
        INSERT INTO item_withdrawals(item_id,name,turma,cgm,recorded_by)
        VALUES (?,?,?,?,?)
    `);
    insert.run(item.id, name, turma, cgm, req.user.id);
    db.prepare(`UPDATE items SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(item.id);

    if (owner) {
        notify(owner.id, 'Retirada registrada', `A retirada de "${item.title}" foi registrada no Foundy.`, `/pages/history.html`);
    }

    res.status(201).json({ message: 'Retirada registrada e item arquivado.' });
});

/* =========================
   NOTIFICAÇÕES
   ========================= */

app.get('/api/notifications', auth, (req, res) => {
    res.json({ notifications: db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.id) });
});

app.patch('/api/notifications/:id/read', auth, (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ ok: true });
});

/* =========================
   SUPORTE
   ========================= */

app.post('/api/support', auth, role('student', 'cleaning'), (req, res) => {
    const subject = cleanText(req.body.subject);
    const message = cleanText(req.body.message);
    if (!subject || !message) return res.status(400).json({ error: 'Preencha assunto e mensagem.' });

    const info = db.prepare('INSERT INTO support_tickets(user_id,subject,message) VALUES (?,?,?)').run(req.user.id, subject, message);
    res.status(201).json({ message: 'Chamado enviado.', id: info.lastInsertRowid });
});

app.get('/api/support', auth, role('student', 'cleaning'), (req, res) => {
    const tickets = db.prepare(`SELECT id,subject,message,response_text,status,created_at,answered_at,closed_at FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.id);
    res.json({ tickets });
});

app.get('/api/admin/support', auth, role('admin'), (req, res) => {
    const tickets = db.prepare(`
        SELECT t.id,t.subject,t.message,t.response_text,t.status,t.created_at,t.answered_at,t.closed_at,
               u.id AS user_id,u.name AS user_name,u.email AS user_email,u.cgm AS user_cgm,u.turma AS user_turma
        FROM support_tickets t JOIN users u ON u.id=t.user_id
        ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'answered' THEN 1 ELSE 2 END, t.created_at DESC
    `).all();
    res.json({ tickets });
});

app.patch('/api/admin/support/:id/answer', auth, role('admin'), (req, res) => {
    const response = cleanText(req.body.response);
    if (!response) return res.status(400).json({ error: 'Escreva uma resposta antes de responder ou concluir o chamado.' });
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado.' });
    if (ticket.status === 'closed') return res.status(400).json({ error: 'Este chamado já foi encerrado.' });

    db.prepare(`UPDATE support_tickets SET response_text=?,status='answered',answered_at=CURRENT_TIMESTAMP,closed_at=NULL WHERE id=?`).run(response, ticket.id);
    notify(ticket.user_id, 'Resposta do suporte', `Seu chamado "${ticket.subject}" recebeu uma resposta.`, '/pages/support.html');
    res.json({ message: 'Resposta enviada.' });
});

app.patch('/api/admin/support/:id/close', auth, role('admin'), (req, res) => {
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado.' });
    if (!ticket.response_text?.trim()) return res.status(400).json({ error: 'Não é possível concluir um chamado sem enviar uma resposta.' });
    if (ticket.status === 'closed') return res.status(400).json({ error: 'Este chamado já está encerrado.' });

    db.prepare(`UPDATE support_tickets SET status='closed',closed_at=CURRENT_TIMESTAMP WHERE id=?`).run(ticket.id);
    notify(ticket.user_id, 'Chamado encerrado', `Seu chamado "${ticket.subject}" foi encerrado pelo suporte.`, '/pages/support.html');
    res.json({ message: 'Chamado encerrado.' });
});

/* =========================
   PAINEL / HISTÓRICO
   ========================= */

app.get('/api/admin/stats', auth, role('admin'), (req, res) => {
    const stats = {
        users: db.prepare('SELECT COUNT(*) c FROM users WHERE active=1').get().c,
        items: db.prepare('SELECT COUNT(*) c FROM items').get().c,
        lost: db.prepare("SELECT COUNT(*) c FROM items WHERE type='lost' AND status NOT IN ('found','archived','resolved')").get().c,
        found: db.prepare("SELECT COUNT(*) c FROM items WHERE type='found' OR status='found'").get().c,
        open: db.prepare("SELECT COUNT(*) c FROM items WHERE status='open'").get().c,
        resolved: db.prepare("SELECT COUNT(*) c FROM items WHERE status IN ('resolved','archived')").get().c
    };

    const recent = db.prepare(`
        SELECT i.id,i.type,i.title,i.status,i.created_at,u.name AS reporter
        FROM items i JOIN users u ON u.id=i.user_id
        ORDER BY i.created_at DESC LIMIT 30
    `).all();
    res.json({ stats, recent });
});

app.get('/api/admin/history', auth, role('admin'), (req, res) => {
    const q = cleanText(req.query.q);
    let sql = `
        SELECT i.id,i.title,i.type,i.status,i.created_at,i.updated_at,
               r.name AS reporter,
               w.name AS withdrawn_name,w.turma AS withdrawn_turma,w.cgm AS withdrawn_cgm,
               w.withdrawn_at,rec.name AS recorded_by_name
        FROM items i
        JOIN users r ON r.id=i.user_id
        LEFT JOIN item_withdrawals w ON w.item_id=i.id
        LEFT JOIN users rec ON rec.id=w.recorded_by
        WHERE i.status IN ('found','archived','resolved')
    `;
    const p = [];
    if (q) {
        sql += ` AND (i.title LIKE ? OR r.name LIKE ? OR COALESCE(w.name,'') LIKE ? OR COALESCE(w.cgm,'') LIKE ? OR COALESCE(w.turma,'') LIKE ?)`;
        const x = `%${q}%`; p.push(x,x,x,x,x);
    }
    sql += ' ORDER BY COALESCE(w.withdrawn_at,i.updated_at) DESC';
    res.json({ history: db.prepare(sql).all(...p) });
});

/* =========================
   USUÁRIOS — ADMIN
   ========================= */

app.get('/api/admin/users', auth, role('admin'), (req, res) => {
    const q = cleanText(req.query.q);
    let sql = `SELECT id,name,email,role,cgm,turma,active,created_at,deleted_at FROM users WHERE 1=1`;
    const p = [];
    if (q) {
        sql += ` AND (name LIKE ? OR email LIKE ? OR COALESCE(cgm,'') LIKE ? OR COALESCE(turma,'') LIKE ?)`;
        const x = `%${q}%`; p.push(x,x,x,x);
    }
    sql += ' ORDER BY active DESC, name COLLATE NOCASE ASC';
    res.json({ users: db.prepare(sql).all(...p) });
});

app.post('/api/admin/users', auth, role('admin'), (req, res) => {
    const name = cleanText(req.body.name);
    const email = cleanText(req.body.email).toLowerCase();
    const password = String(req.body.password || '');
    const userRole = cleanText(req.body.role);
    const cgm = normalizeCGM(req.body.cgm);
    const turma = cleanText(req.body.turma);

    if (!name || !email || password.length < 6 || !['student','cleaning','admin'].includes(userRole)) {
        return res.status(400).json({ error: 'Preencha nome, email, senha (mínimo 6) e perfil.' });
    }
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'Este email já está cadastrado.' });
    if (userRole === 'student' && (!cgm || !turma)) return res.status(400).json({ error: 'Aluno precisa de CGM e turma.' });
    if (cgm && db.prepare('SELECT id FROM users WHERE cgm=?').get(cgm)) return res.status(409).json({ error: 'Este CGM já está cadastrado ou bloqueado.' });

    const info = db.prepare(`INSERT INTO users(name,email,password_hash,role,cgm,turma) VALUES(?,?,?,?,?,?)`).run(name,email,bcrypt.hashSync(password,10),userRole,cgm||null,turma||null);
    res.status(201).json({ id: info.lastInsertRowid, message: 'Usuário cadastrado.' });
});

app.patch('/api/admin/users/:id', auth, role('admin'), (req, res) => {
    const id = Number(req.params.id);
    const target = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const name = cleanText(req.body.name);
    const email = cleanText(req.body.email).toLowerCase();
    const userRole = cleanText(req.body.role);
    const cgm = normalizeCGM(req.body.cgm);
    const turma = cleanText(req.body.turma);
    const password = String(req.body.password || '');

    if (!name || !email || !['student','cleaning','admin'].includes(userRole)) return res.status(400).json({ error: 'Dados inválidos.' });
    if (userRole === 'student' && (!cgm || !turma)) return res.status(400).json({ error: 'Aluno precisa de CGM e turma.' });
    const emailOwner = db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(email,id);
    if (emailOwner) return res.status(409).json({ error: 'Este email já pertence a outro usuário.' });
    const cgmOwner = cgm ? db.prepare('SELECT id FROM users WHERE cgm=? AND id<>?').get(cgm,id) : null;
    if (cgmOwner) return res.status(409).json({ error: 'Este CGM já pertence a outro usuário ou está bloqueado.' });

    const newHash = password ? bcrypt.hashSync(password,10) : target.password_hash;
    db.prepare(`UPDATE users SET name=?,email=?,password_hash=?,role=?,cgm=?,turma=? WHERE id=?`).run(name,email,newHash,userRole,cgm||null,turma||null,id);
    res.json({ message: 'Usuário atualizado.' });
});

app.delete('/api/admin/users/:id', auth, role('admin'), (req, res) => {
    const id = Number(req.params.id);
    const target = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (target.role !== 'student') return res.status(400).json({ error: 'Somente contas de alunos podem ser bloqueadas por este botão.' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Você não pode bloquear sua própria conta.' });

    // Soft delete: keeps the CGM occupied and preserves item/support history.
    db.prepare(`UPDATE users SET active=0,deleted_at=CURRENT_TIMESTAMP WHERE id=?`).run(id);
    res.json({ message: 'Aluno bloqueado. O CGM continua reservado e não poderá ser usado para uma nova conta.' });
});

/* =========================
   ERROS
   ========================= */

app.use((err, req, res, next) => {
    console.error(err);
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'A imagem ultrapassa o limite de 5 MB.' });
    }
    res.status(500).json({ error: err.message || 'Erro interno' });
});

app.listen(PORT, () => {
    console.log(`Foundy rodando em http://localhost:${PORT}`);
});
