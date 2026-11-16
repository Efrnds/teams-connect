# Skills

Dois workflows para usar com IA. São markdown — funcionam como skill nativa no Claude Code e como documento referenciado em qualquer outro agente.

| Skill | Dispara quando | O que faz |
|---|---|---|
| `regression` | alguém descreve um bug | Força o teste a ser escrito e a **falhar** antes do conserto |
| `guardian-review` | antes de abrir o PR | Revisa o diff contra as regras do projeto e separa bloqueante de sugestão |

## Claude Code

```bash
mkdir -p /caminho/do/projeto/.claude/skills
cp -r regression guardian-review /caminho/do/projeto/.claude/skills/
```

Pronto. O Claude carrega sozinho quando a situação bate com a descrição da skill.

## Codex, Cursor, Copilot, Gemini

Não têm skill nativa, mas leem arquivo referenciado. Copie a pasta e adicione ao `AGENTS.md`:

```bash
cp -r ../skills /caminho/do/projeto/.agents-skills
```

```markdown
## Procedimentos

- Bug reportado → siga `.agents-skills/regression/SKILL.md`
- Antes de abrir PR → siga `.agents-skills/guardian-review/SKILL.md`
```

Funciona, só não é automático: você precisa pedir ("segue o regression aí").

## Por que só duas

São as duas que mudam resultado de verdade. `regression` porque o passo de ver o teste falhar é o que todo mundo pula e é o único que prova que o teste vale alguma coisa. `guardian-review` porque revisar o próprio código com uma régua escrita pega o que a leitura distraída não pega.

O resto — gerar componente, montar CRUD — o agente já faz bem sem instrução extra.
