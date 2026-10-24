# Fase 2 — Configuração, segurança e testes

## 1. Variáveis de ambiente
Crie `.env.local` (ignorado pelo Git) a partir de `.env.example`:

| Variável | Público? | Onde achar |
| --- | --- | --- |
| `SUPABASE_URL` | sim (vai para o navegador) | Supabase → Project Settings → API |
| `SUPABASE_PUBLISHABLE_KEY` | sim (vai para o navegador) | mesma tela (chave *publishable* `sb_publishable_…` ou *anon*) |
| `service_role` / senha do banco | **NUNCA** no frontend nem no Git | só em ambiente de servidor, se um dia for preciso |

A chave publishable é pública por desenho; **quem protege os dados é o RLS**. O `build.mjs` avisa se encontrar `SUPABASE_SERVICE_ROLE_KEY` e não a inclui no bundle.

## 2. Migrations (`supabase/migrations/`)
Aplique em ordem: `…0001_schema_and_helpers.sql`, `…0002_rls_policies_and_invites.sql`, `…0003_fix_campaigns_select_returning.sql`
(SQL Editor do Supabase, ou `supabase db push` com a CLI). A `0003` é uma correção encontrada pelos testes; não edite as anteriores.

## 3. Autenticação (configurar no painel do Supabase — não é possível por código)
- **Authentication → URL Configuration → Site URL:** a URL onde o app roda (ex.: `http://localhost:5173`).
- **Redirect URLs:** `http://localhost:5173/**` e a URL de produção com `/**`. O link de recuperação volta para `<URL>/#/redefinir-senha`.
- **Authentication → Providers → Email:** decida se exige **confirmação de e-mail** (recomendado). O app trata os dois casos.
- **E-mails:** o provedor padrão do Supabase tem limite baixo de envios e serve só para testes. Para uso real configure SMTP próprio (Authentication → SMTP Settings) e personalize os templates de confirmação e recuperação.
- O app usa o fluxo **PKCE** (`?code=` na URL de retorno), trocado automaticamente pelo `supabase-js`.

## 4. Papéis (como alguém vira mestre)
Toda conta nova é **jogador** (o gatilho ignora qualquer papel vindo de metadados). Promoção é um processo controlado, fora da API, no SQL Editor com a conta dona do projeto:

```sql
select private.admin_set_role('<uuid do usuário em auth.users>', 'mestre');
select private.admin_set_role('<uuid>', 'jogador');   -- rebaixar
```
`private.admin_set_role` não é exposta pelo PostgREST nem tem grant para `authenticated`/`anon`. Não existe conta administrativa fixa.

## 5. Convites
O mestre gera um código em Campanhas → Abrir detalhes → *Gerar convite* (mostrado **uma vez**; só o hash SHA-256 é guardado; vale 72 h; uso único). O jogador cola o código em *Entrar com convite*. Ninguém consegue se adicionar a uma campanha só conhecendo o id.

## 6. Testes
| Comando | O que valida | Limite |
| --- | --- | --- |
| `npm run test:unit` | validação, busca, ficha, mensagens de erro | lógica pura |
| `npm run test:e2e` | fluxos da interface (login, guardas, convites, fichas, erro de rede, celular) | usa um **cliente Supabase falso** (`tests/fakes`) — não prova segurança nem a integração real |
| `supabase/tests/rls_security.test.sql` | **segurança no banco**: 99 verificações com Mestre A/B, Jogador A/B e um estranho | simula papel + claim do JWT no Postgres; não passa por HTTP/GoTrue |

Como rodar a suíte SQL: cole o arquivo no SQL Editor. Ele roda numa transação que é **desfeita** e devolve o relatório como mensagem de erro `RESULTADO_DOS_TESTES passam=… falham=…` (proposital; não deixa dados). Rode **sempre que mudar uma política**.

### Teste real de ponta a ponta (a fazer por você, com rede)
1. `npm install && npm run build && npm run dev`.
2. Cadastre 3 contas (use e-mails seus ou `+alias`), confirme os e-mails.
3. Promova uma a mestre (seção 4). Crie uma campanha, gere 2 convites, entre com as outras duas.
4. Confira que a Jogadora A não abre a ficha da B colando a URL, e que um terceiro usuário não vê a campanha.
5. Teste "Esqueci a senha" de ponta a ponta com um e-mail real.

## 7. Limitações conhecidas
- Co-mestre existe no banco (testado), mas a interface ainda não mostra os controles de administração para ele.
- Um jogador só enxerga as **próprias** fichas (decisão conservadora); o mestre vê todas as da sua campanha.
- Habilidades e equipamento são guardados no JSON da ficha, mas ainda não têm editor.
- Excluir a conta de um mestre que possui campanhas é bloqueado de propósito (`ON DELETE RESTRICT`).
- Sem limitação de taxa própria além da do Supabase Auth.
