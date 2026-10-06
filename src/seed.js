const bcrypt = require('bcryptjs');
const db = require('./db');
const users = [
 ['Aluno Demo','aluno@foundy.local','aluno123','student'],
 ['Equipe de Limpeza','limpeza@foundy.local','limpeza123','cleaning'],
 ['Administrador','admin@foundy.local','admin123','admin']
];
for (const [name,email,password,role] of users) {
 const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email);
 if (!exists) db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run(name,email,bcrypt.hashSync(password,10),role);
}
const aluno = db.prepare('SELECT id FROM users WHERE email=?').get('aluno@foundy.local');
if (!db.prepare('SELECT id FROM items LIMIT 1').get()) {
 db.prepare(`INSERT INTO items(user_id,type,title,description,color,location,room,details) VALUES(?,?,?,?,?,?,?,?)`).run(aluno.id,'lost','Caderno preto','Caderno de capa preta perdido durante a aula.','Preto','Bloco A','Sala 12','Possui etiqueta com o nome do aluno.');
 db.prepare(`INSERT INTO items(user_id,type,title,description,color,location,room,details) VALUES(?,?,?,?,?,?,?,?)`).run(aluno.id,'found','Garrafa azul','Garrafa encontrada perto dos armários.','Azul','Bloco B','Corredor','Sem nome visível.');
}
console.log('Banco preparado.');
