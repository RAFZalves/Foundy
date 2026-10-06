# Foundy 2.0

Sistema de achados e perdidos.

## Perfis

- **Aluno:** registra perdas, consulta o catálogo, recebe notificações e usa o suporte.
- **Equipe:** registra itens encontrados e usa o suporte.
- **Administrador:** controla itens, usuários, histórico, devoluções e suporte.

## Fluxo dos itens

1. O aluno registra um item perdido.
2. A equipe pode registrar um item encontrado.
3. O administrador abre **Ver detalhes** e, quando confirmar que o item foi localizado, usa **Marcar como encontrado**.
4. O item passa para `Encontrado`, sai do catálogo e o aluno recebe uma notificação.
5. Quando o aluno retirar o item, o administrador registra **nome, turma e CGM**.
6. O item passa para `Arquivado` e permanece no **Histórico**, junto com os dados da retirada.

O registro nunca é apagado apenas porque foi resolvido.

## Usuários

O cadastro público possui duas opções: **Sou aluno** e **Sou da equipe**.

- Alunos precisam de CGM e turma.
- O cadastro da equipe exige o código configurado em `TEAM_SIGNUP_CODE`.
- O administrador pode cadastrar alunos, equipe e outros administradores.
- O administrador pode editar nome, email, perfil, CGM, turma e senha.
- Bloquear um aluno é um bloqueio lógico: o histórico permanece e o CGM continua reservado, impedindo a criação de outra conta com o mesmo CGM.

## Suporte

Alunos e equipe podem abrir chamados. Administradores respondem. Um chamado sem resposta não pode ser concluído.

## Instalação

No Windows:

```powershell
npm.cmd install
npm.cmd start
```

Abra `http://localhost:5000`.

Se o projeto já tiver um `data/foundy.db`, ele é migrado automaticamente ao iniciar. **Não rode o seed durante os testes de uma base que já contém seus dados**, a menos que queira inserir os dados de demonstração que ainda não existirem.

## Dados de demonstração do seed

```text
Aluno: aluno@foundy.local / aluno123
Equipe: limpeza@foundy.local / limpeza123
Administrador: admin@foundy.local / admin123
Código padrão de equipe: FOUNDY-EQUIPE
```

## O que foi fechado na versão Foundy Teste 4

- Home simplificada, sem blocos de apresentação desnecessários.
- Marca FOUNDY com elemento de lupa integrado ao nome.
- Botão de tema fixo no canto: sol no modo escuro e lua no modo claro.
- Acesso às funcionalidades exige conta; usuário não autenticado é enviado diretamente ao cadastro.
- Menus variam conforme o perfil.
- Aluno não acessa funções da equipe/admin e equipe não recebe menu de perda.
- Administrador possui Painel, Cadastrar, Usuários, Histórico e Suporte.
- Catálogo mostra somente registros ativos; `found`, `resolved` e `archived` ficam fora do catálogo.
- Em **Ver detalhes**, administrador pode marcar um item perdido como encontrado.
- Ao marcar como encontrado, o aluno recebe notificação e o item sai do catálogo.
- Retirada exige nome, turma e CGM; depois o item é arquivado e continua no histórico.
- Histórico possui pesquisa.
- Usuários possui pesquisa por nome, email, CGM e turma.
- Administrador pode cadastrar aluno, equipe e administrador.
- Administrador pode editar nome, email, perfil, CGM, turma e substituir a senha.
- A senha atual nunca é exibida em texto; a edição permite definir uma nova senha.
- Bloqueio de aluno é lógico: a conta fica inativa, o histórico é preservado e o CGM continua reservado.
- Suporte permite dúvidas da equipe e dos alunos; chamado só pode ser encerrado depois de uma resposta.
- Rodapé informa a autoria do projeto e a reserva dos direitos sobre a estrutura, identidade e funcionalidades.

## Checklist de teste para apresentação

1. Instale as dependências com `npm.cmd install` e inicie com `npm.cmd start`.
2. Abra `http://localhost:5000` e confira a home, a lupa do FOUNDY e o botão de tema.
3. Sem login, clique em **Procurar item**, **Registrar item perdido** e **Falar com suporte**. Todos devem levar ao cadastro.
4. Cadastre um aluno com CGM e turma e confirme que ele entra no sistema.
5. Como aluno, teste **Perdi algo**, catálogo, detalhes, notificações e suporte.
6. Como equipe, confirme que aparecem **Achados e perdidos**, **Registrar encontrado** e **Suporte**, sem menu de perda.
7. Como equipe, registre um item encontrado e confirme que ele aparece no catálogo.
8. Como administrador, confirme o painel, os contadores e os menus **Cadastrar**, **Usuários**, **Histórico** e **Suporte**.
9. No catálogo, abra **Ver detalhes** de um item perdido e use **Marcar como encontrado**.
10. Entre novamente como o aluno dono do item e confirme a notificação de item encontrado.
11. Volte ao catálogo e confirme que o item marcado como encontrado desapareceu.
12. Abra o detalhe do item encontrado e registre a retirada com nome, turma e CGM.
13. Confirme que o item foi arquivado e apareceu no Histórico com os dados da retirada.
14. Em **Usuários**, teste a pesquisa por nome, CGM, turma e email.
15. Clique no nome/ação de um aluno e teste a edição de dados e substituição de senha.
16. Bloqueie um aluno de teste e tente criar uma nova conta usando o mesmo CGM; o cadastro deve ser recusado.
17. Em **Cadastrar**, crie um aluno, um membro da equipe e outro administrador.
18. Em **Suporte**, envie uma dúvida como aluno/equipe, responda como administrador e confirme que não é possível encerrar o chamado antes da resposta.
19. Faça logout e confirme que as áreas protegidas voltam a exigir cadastro/login.
20. Teste o botão de tema em mais de uma página e confirme que a preferência permanece ao navegar.
## Guia de endpoints da API

A API do Foundy utiliza rotas HTTP para conectar o sistema ao banco de dados e controlar as funcionalidades da plataforma.

### Autenticação

* `GET /api/me` — verifica o usuário atualmente autenticado.
* `POST /api/auth/register` — realiza o cadastro de um aluno ou membro da equipe.
* `POST /api/auth/login` — realiza o login.
* `POST /api/auth/logout` — encerra a sessão.

### Itens e catálogo

* `GET /api/items` — lista os itens disponíveis no catálogo.
* `GET /api/items/:id` — mostra os detalhes de um item.
* `POST /api/items` — registra um item perdido ou encontrado.
* `PATCH /api/items/:id/status` — atualiza o status de um item.
* `PATCH /api/admin/items/:id/found` — marca um item como encontrado.
* `POST /api/admin/items/:id/withdraw` — registra a retirada de um item e o arquiva.

### Notificações

* `GET /api/notifications` — consulta as notificações do usuário.
* `PATCH /api/notifications/:id/read` — marca uma notificação como lida.

### Suporte

* `POST /api/support` — cria um chamado de suporte.
* `GET /api/support` — consulta os chamados do usuário.
* `GET /api/admin/support` — permite ao administrador visualizar os chamados.
* `PATCH /api/admin/support/:id/answer` — responde a um chamado.
* `PATCH /api/admin/support/:id/close` — encerra um chamado após uma resposta.

### Administração

* `GET /api/admin/stats` — apresenta estatísticas do sistema e itens recentes.
* `GET /api/admin/history` — consulta o histórico de itens resolvidos e arquivados.
* `GET /api/admin/users` — lista e pesquisa os usuários.
* `POST /api/admin/users` — cadastra um novo usuário.
* `PATCH /api/admin/users/:id` — edita os dados de um usuário.
* `DELETE /api/admin/users/:id` — bloqueia uma conta de aluno.

