# Handoff — padrões de projeto (TypeScript / Node)

Um pacote pequeno de regras para começar um projeto e não virar bagunça no terceiro mês.

Não é framework, não instala nada, não te prende a lib nenhuma. São 5 documentos curtos, 1 exemplo que roda, e 2 workflows para usar com IA.

---

## Como usar em 5 minutos

**1. Rode o exemplo.** É a parte que mais ensina:

```bash
cd exemplo
npm install
npm test
```

Cinco testes passando. Abra os 4 arquivos na ordem `repository → service → test → action` e você entende a estrutura inteira sem ler mais nada.

**2. Copie as regras para a raiz do seu projeto:**

```bash
cp CLAUDE.md AGENTS.md /caminho/do/seu/projeto/
cp -r docs /caminho/do/seu/projeto/docs-padroes
```

`CLAUDE.md` é lido pelo Claude Code. `AGENTS.md` é lido por Codex, Cursor, Copilot e Zed. São **o mesmo conteúdo** — se editar um, edite o outro.

**3. Leia os docs quando bater a dúvida.** Não precisa ler tudo de uma vez.

---

## O que tem aqui

| Arquivo | Sobre o quê | Quando ler |
|---|---|---|
| `CLAUDE.md` / `AGENTS.md` | As regras condensadas em 1 página | Agora. É o resumo de tudo. |
| `docs/1-estrutura.md` | Pastas e as 3 camadas | Ao começar o projeto |
| `docs/2-fluxo.md` | Branch → teste → código → PR | Ao começar a trabalhar em equipe |
| `docs/3-testes.md` | O que testar e o que não testar | Na primeira vez que travar em "como testo isso?" |
| `docs/4-seguranca.md` | Os 4 pilares de toda operação que muda dados | Antes de expor qualquer coisa na internet |
| `docs/5-qualidade.md` | CI, lint, typecheck, migration vs seed | Ao configurar o repositório |
| `exemplo/` | Uma fatia vertical completa, com teste | Primeiro. Sempre. |
| `skills/` | 2 workflows para o Claude Code | Quando adotar IA no fluxo |

---

## As 4 ideias, resumidas

Se você só ler esta seção, já pegou 80% do valor:

**1. Três camadas, sempre na mesma direção.**
`entrada (rota/action) → service → repository`. A entrada não fala com o banco. O service não sabe o que é HTTP. O repository não sabe o que é usuário logado. Cada camada só conhece a de baixo.

**2. Toda função exposta é pública, mesmo a que parece interna.**
Se dá para chamar de fora do processo, alguém vai chamar com `curl`. Antes de mudar qualquer dado: quem é o usuário → a entrada é válida → esse usuário pode fazer isso *neste recurso*.

**3. Bug começa com um teste que falha.**
Escreveu o teste, viu falhar, aí conserta. Se você conserta primeiro, não sabe se o teste testa alguma coisa — e o bug volta em três meses.

**4. O que muda estrutura vai em migration; o que insere dado vai em seed.**
Migration com `INSERT` é dor de cabeça garantida na hora do rollback.

---

## O que este pacote **não** é

- **Não é obrigatório inteiro.** Projeto pessoal de fim de semana não precisa de CI com quality gate. Pegue o que serve.
- **Não é sincronizado.** Copiou, é seu. Edite à vontade, adapte ao seu domínio.
- **Não cobre frontend.** Componente, estado e CSS ficam de fora de propósito — é outra conversa e tem menos consenso.

---

## Créditos

Extraído de padrões usados em projetos reais de produção, generalizados para servir qualquer projeto TypeScript/Node.
