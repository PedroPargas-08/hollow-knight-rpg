# Valdrim — RPG de mesa

Plataforma web para administrar e jogar campanhas de RPG de mesa, com identidade visual sombria e subterrânea. O nome **Valdrim** é provisório.

> **Status: Fase 2 — autenticação, banco de dados e segurança com Supabase.** Contas, campanhas, convites e fichas usam dados persistidos; as permissões são aplicadas pelo banco. Consulte [docs/FASE2-SETUP.md](docs/FASE2-SETUP.md) para configurar o ambiente e conhecer os limites dos testes. Missões, mapas, combate, rolagens e outras ferramentas do mestre continuam planejados e não são apresentados como funcionalidades prontas.

> Projeto independente, sem vínculo com *Hollow Knight* ou Team Cherry.

## Requisitos

- Node.js 20 ou superior
- Projeto Supabase configurado

## Configuração e execução

Crie o arquivo `.env.local` a partir de `.env.example` e preencha `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` com os valores públicos do seu projeto Supabase.

No Windows (PowerShell) ou macOS/Linux:

```sh
npm install
npm run dev
```

O servidor de desenvolvimento fica disponível em [http://localhost:5173](http://localhost:5173).

Para gerar a versão de produção:

```sh
npm run build
```

O build gera os arquivos em `dist/`.

## Testes

```sh
npm run typecheck
npm run test:unit
npm run test:e2e
npm test
```

Os testes E2E usam um cliente Supabase falso e validam fluxos da interface; eles não comprovam a segurança das políticas RLS nem substituem testes de integração com o Supabase real. Se o Chromium ainda não estiver instalado, execute:

```sh
npx playwright install chromium
```

A suíte SQL de segurança está em `supabase/tests/rls_security.test.sql`. Consulte [docs/FASE2-SETUP.md](docs/FASE2-SETUP.md) para o procedimento e suas limitações.

## Estrutura do projeto

- `public/`: documento HTML base e recursos públicos.
- `build.mjs`: build e servidor de desenvolvimento com esbuild.
- `src/app/`: autenticação, roteamento, preferências e estrutura da aplicação.
- `src/components/`: componentes reutilizáveis e layouts.
- `src/pages/`: páginas da aplicação.
- `src/data/`: identidade visual e conteúdo do compêndio de regras.
- `src/lib/`: integração com Supabase e lógica reutilizável.
- `src/styles/`: estilos.
- `supabase/migrations/`: migrações do banco; aplique conforme a documentação.
- `supabase/tests/`: testes de segurança SQL.
- `tests/unit/`: testes unitários.
- `tests/e2e/` e `tests/fakes/`: testes de interface com serviços simulados.
- `docs/`: instruções de configuração e limitações conhecidas.

## Decisões técnicas

- **React 19 e TypeScript**, empacotados com **esbuild**.
- **Roteamento por hash** (`#/rota`), compatível com hospedagem estática.
- Estilos sem dependência de fontes externas.
- Preferências visuais armazenadas localmente no navegador.
- A interface não é a fronteira de segurança: as regras de acesso devem ser aplicadas no banco por RLS, privilégios e gatilhos.

## Próximas etapas

A conclusão da Fase 2 depende da validação do fluxo real de autenticação com Supabase Auth, incluindo cadastro, confirmação de e-mail e recuperação de senha. O roteiro está em [docs/FASE2-SETUP.md](docs/FASE2-SETUP.md).
