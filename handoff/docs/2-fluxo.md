# 2 — Fluxo de trabalho

## O ciclo

```
branch  →  teste  →  código  →  verde  →  commit  →  PR  →  review  →  merge
```

### 1. Branch

Sempre a partir da branch principal atualizada:

```bash
git checkout main && git pull
git checkout -b feat/pagamento-de-fatura
```

Prefixos: `feat/` (funcionalidade), `fix/` (bug), `chore/` (build, dep, config), `refactor/` (muda estrutura, não muda comportamento).

### 2. Teste primeiro — obrigatório em bug, recomendado em feature

**Bug:** escreva o teste que reproduz o problema e **veja ele falhar** antes de consertar. Isto não é ritual:

- Se o teste passa antes do fix, ele não testa o bug. Você ia consertar outra coisa.
- Se você conserta primeiro, nunca vai saber se o teste pegaria a regressão.
- O bug volta em três meses. O teste é a única coisa que impede.

**Feature:** teste junto, no mesmo PR. Antes ou depois do código é preferência sua; sem teste, não.

### 3. Código

Enquanto escreve:

- Leia o arquivo ao lado antes de inventar padrão novo. Consistência vale mais que estar certo sozinho.
- Não conserte coisas fora do assunto do PR. Anotou, abre issue, segue. PR que "aproveitou para arrumar" é PR que ninguém revisa direito.

### 4. Verde antes de commitar

```bash
npm run typecheck && npm run lint && npm test
```

Se dá para automatizar isso no `pre-commit`, melhor (veja `5-qualidade.md`). Mas o hábito vem antes da ferramenta.

### 5. Commit

Conventional Commits — o formato existe para o histórico ser legível e para gerar changelog automático:

```
feat: permite marcar fatura como paga
fix: impede pagar fatura em rascunho
test: cobre idempotência do pagamento
refactor: extrai invoiceService de invoice.action
chore: sobe vitest para 3.0
docs: explica as 3 camadas
```

Regras práticas: presente do indicativo ("permite", não "permitiu"), primeira linha até ~72 caracteres, sem ponto final. Se precisa explicar **por quê**, use o corpo da mensagem — é lá que o "por quê" sobrevive, não no Slack.

### 6. PR

**Pequeno.** Passou de ~400 linhas de diff, provavelmente são dois PRs. Revisor cansado aprova qualquer coisa, e essa é a origem de metade dos bugs em produção.

Na descrição, três coisas:

```markdown
## O que muda
Uma frase.

## Por quê
O problema que isso resolve. Se for bug: como reproduzia.

## Como testei
Comando que roda + o que você conferiu na mão.
```

Antes de marcar alguém, releia seu próprio diff **inteiro**. Metade dos comentários de review você mesmo faria — `console.log` esquecido, arquivo que não devia estar ali, nome ruim.

### 7. Review

**Para quem revisa:**
- Comportamento antes de estilo. Estilo é trabalho do linter, não seu.
- Distinga **bloqueante** ("isso quebra quando X") de **sugestão** ("eu faria diferente"). Diga qual é qual — o autor não adivinha.
- Pergunte em vez de acusar: "o que acontece se `invoice` for null aqui?" resolve o mesmo e não gera briga.

**Para quem recebe:**
- Review é sobre o código, não sobre você.
- Discordar é legítimo. Responda com argumento técnico, não com "ok" e depois não muda.

### 8. Merge

Squash na maioria dos casos: uma linha por PR na branch principal. Delete a branch.

## Definition of Done

Um PR está pronto quando:

- [ ] `typecheck`, `lint` e `test` passam
- [ ] Se muda comportamento, tem teste que falharia sem a mudança
- [ ] Se muda o banco, tem migration (e o dado foi para o seed — veja `5-qualidade.md`)
- [ ] Se muda como se usa o projeto, o README acompanhou
- [ ] O autor releu o próprio diff

## Quando trabalhar com IA no fluxo

O agente entra no ciclo como qualquer outro dev — e as regras não afrouxam:

- **Não aceite código que você não entende.** Se não sabe explicar, não sabe revisar; e o dono do bug em produção é você.
- **O teste é seu, não dele.** Teste escrito pelo mesmo agente que escreveu o código tende a testar o que o código faz, não o que deveria fazer. Leia o teste com atenção redobrada.
- **Diff grande do agente é mais perigoso, não menos.** Ele escreve 600 linhas em 20 segundos e você revisa em 20 minutos. O limite de tamanho de PR continua valendo.

As duas skills em `skills/` cobrem isto: `regression` para bug (TDD forçado) e `guardian-review` para revisar antes de abrir o PR.
