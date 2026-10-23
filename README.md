# hollow-knight-rpg

**Valdrim** (nome provisório) — plataforma web para administrar e jogar campanhas de RPG de mesa, com identidade visual própria de atmosfera sombria e subterrânea.

> **Status: Fase 1 — interface e navegação demonstrativas.** Não há backend, autenticação, banco de dados nem persistência. Todos os dados são fictícios e identificados como tal.
> Projeto independente, sem vínculo com Hollow Knight ou Team Cherry.

## Executar

Requer Node 20+.

```bash
npm install
npm run dev      # servidor de desenvolvimento em http://localhost:5173
npm run build    # gera dist/ (index.html + assets/app.js + assets/app.css)
npm test         # testes unitários + build + testes de navegação (Playwright)
```

Os testes de navegação usam Chromium via Playwright; se necessário, rode `npx playwright install chromium` uma vez.

## Telas (Fase 1)

Página pública · login · cadastro · recuperação de acesso · painel do jogador · painel do mestre (10 seções) · ficha de personagem (6 abas) · campanhas · compêndio de regras (16 categorias, busca, artigos) · perfil e configurações · administração global (apenas estrutura planejada).

A barra **“Modo demonstração”** (no topo do app) alterna entre jogador e mestre e simula estados vazios. É só um recurso de demonstração, **não é um mecanismo de permissão**.

## O que funciona de verdade × o que é demonstrativo

| Funciona na interface | É apenas demonstrativo (planejado para fases futuras) |
| --- | --- |
| Navegação, menus, submenus, abas, modais | Autenticação e cadastro reais |
| Validação local de formulários | Banco de dados e salvamento de fichas |
| Busca e navegação no compêndio de regras | Cálculos de atributos, PV, ALMA, dano e rolagens |
| Preferências visuais (contraste, texto, efeitos) — só em memória | Permissões (RLS), convites, upload de imagens, tempo real |

> **Esconder botões não é segurança.** As permissões de visitante, jogador, mestre e administrador global precisam ser aplicadas no servidor e no banco de dados nas fases futuras.

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
tests/
  unit/               node:test
  e2e/                Playwright (desktop, tablet e celular)
```

## Decisões técnicas

- **React 19 + TypeScript**, empacotados com **esbuild** (poucas dependências, build rápido).
- **Roteamento por hash** (`#/rota`): funciona em hospedagem estática sem regras de reescrita.
- **Fontes do sistema** (sem dependência de rede): pilha serifada para títulos, sans-serif para texto.
- Acessibilidade: foco visível, rótulos, áreas de toque ≥ 44 px, navegação por teclado nas abas, `prefers-reduced-motion`.

## Próxima fase (sugestão, não iniciada)

Autenticação e banco de dados (Supabase) com políticas de acesso por papel, e publicação (Cloudflare) — somente após aprovação.
