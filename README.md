# hollow-knight-rpg

**Valdrim** (nome provisório) — plataforma web para administrar e jogar campanhas de RPG de mesa, com identidade visual própria de atmosfera sombria e subterrânea.

> \*\*Status: Fase 2 — autenticação, banco de dados e RLS (Supabase).\*\* Contas, campanhas, convites e fichas são reais e persistentes; as permissões são aplicadas pelo banco. Veja \[`docs/FASE2-SETUP.md`](docs/FASE2-SETUP.md) para configurar e para os limites dos testes. Missões, mapas, combate, rolagens e demais ferramentas do mestre continuam planejados (sem dados inventados).
> Projeto independente, sem vínculo com Hollow Knight ou Team Cherry.

## Executar

Requer Node 20+.

```bash
cp .env.example .env.local   # preencha SUPABASE\_URL e SUPABASE\_PUBLISHABLE\_KEY (públicas)
npm install
npm run dev      # servidor de desenvolvimento em http://localhost:5173
npm run build    # gera dist/ (index.html + assets/app.js + assets/app.css)
npm test         # testes unitários + build + testes de navegação (Playwright)
```

Os testes de navegação usam Chromium via Playwright; se necessário, rode `npx playwright install chromium` uma vez.

## Telas (Fase 1)

Página pública · login · cadastro · recuperação de acesso · painel do jogador · painel do mestre (10 seções) · ficha de personagem (6 abas) · campanhas · compêndio de regras (16 categorias, busca, artigos) · perfil e configurações · administração global (apenas estrutura planejada).

A barra **“Modo demonstração”** (no topo do app) alterna entre jogador e mestre e simula estados vazios. É só um recurso de demonstração, **não é um mecanismo de permissão**.

> \*\*Esconder botões não é segurança.\*\* Cada regra de acesso vive no banco (RLS, privilégios por coluna e gatilhos) e é testada em `supabase/tests/rls\_security.test.sql`.

## Estrutura

```
public/index.html     página base
build.mjs             build/dev server (esbuild)
src/
  app/                roteador por hash, rotas, navegação, estado da demonstração
  components/         UI reutilizável, layouts, ícones, elementos visuais
  pages/              uma tela por arquivo
  data/               dados fictícios e conteúdo provisório das regras (separados dos componentes)
  lib/                lógica pura (roteamento, validação, busca) com testes unitários
  styles/             tokens, base, componentes, layout e páginas
supabase/
  migrations/         esquema, RLS, convites (aplicar em ordem)
  tests/              suíte de segurança SQL (99 verificações)
docs/                 configuração e limites dos testes
tests/
  unit/               node:test
  e2e/ + fakes/       Playwright contra um cliente Supabase falso (só UI)
```

## Decisões técnicas

* **React 19 + TypeScript**, empacotados com **esbuild** (poucas dependências, build rápido).
* **Roteamento por hash** (`#/rota`): funciona em hospedagem estática sem regras de reescrita.
* **Fontes do sistema** (sem dependência de rede): pilha serifada para títulos, sans-serif para texto.
* Acessibilidade: foco visível, rótulos, áreas de toque ≥ 44 px, navegação por teclado nas abas, `prefers-reduced-motion`.

## Próxima fase

Não iniciada. Depende de aprovação.

