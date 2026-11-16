# 5 — Qualidade e banco de dados

## Parte 1 — Os portões

### A regra que mais importa deste documento

**Nunca desligue o typecheck ou o lint no build.**

```js
// next.config.js — a bomba-relógio mais comum em projeto TypeScript
typescript: { ignoreBuildErrors: true },
eslint:     { ignoreDuringBuilds: true },
```

Quem liga isso normalmente liga "só até arrumar aquele erro". Seis meses depois são 300 erros, ninguém sabe quais são reais, e todo erro de tipo novo vai para produção sem fazer barulho. Você pagou por um compilador e depois pediu para ele ficar quieto.

Se hoje seu projeto está assim: não conserte tudo de uma vez. Ligue o portão, conte os erros, e vá reduzindo — a lista só pode encolher.

### TypeScript

```json
{ "compilerOptions": { "strict": true } }
```

`strict: true` desde o primeiro dia em projeto novo. Ele é a diferença entre o TypeScript pegar seu `null` e você descobrir em produção.

Em projeto legado com `strict: false`: ligue e trate os erros aos poucos, com `@ts-expect-error` marcando cada ponto. `@ts-expect-error` avisa quando deixa de ser necessário; `@ts-ignore` fica escondido para sempre.

### Lint

ESLint com a configuração recomendada do TypeScript já resolve a maior parte. Duas regras que valem a briga:

- `no-floating-promises` — pega `await` esquecido, que é uma das origens mais frustrantes de bug intermitente.
- `no-explicit-any` — como aviso, não como erro. `any` desliga o compilador na região inteira.

Formatação é assunto do Prettier, não seu. Configure uma vez e nunca mais discuta vírgula em review.

### CI — o mínimo que vale a pena

`.github/workflows/ci.yml`:

```yaml
name: CI
on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

Quatro comandos. Depois de estabilizar, marque como obrigatórios para o merge nas configurações do repositório — senão é decoração.

### Pre-commit (opcional, mas economiza tempo)

```bash
npm install -D husky lint-staged
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

```json
{ "lint-staged": { "*.{ts,tsx}": ["eslint --fix", "prettier --write"] } }
```

Rode só o lint no pre-commit. Rodar a suíte inteira a cada commit é o caminho mais curto para todo mundo usar `--no-verify`.

### Um gerenciador de pacote só

`package-lock.json` e `pnpm-lock.yaml` no mesmo repositório é fonte de "na minha máquina funciona". Escolha um, apague o outro, alinhe com o time.

## Parte 2 — Banco de dados

### A regra de ouro

| O que é | Onde vai |
|---|---|
| **Estrutura** — criar/alterar/remover tabela, coluna, índice, enum | **migration** |
| **Dado** — `INSERT`/`UPDATE`/`DELETE` sem mudança de estrutura junto | **seed** |
| **Backfill** — popular a coluna que a migration acabou de criar | **na própria migration** |

Depois de gerar uma migration, abra o SQL e leia. Se tem `INSERT` puro ali, mova para o seed.

### Por que dado não vai em migration

- **Rollback vira um problema.** Desfazer estrutura é mecânico; desfazer dado não é — a linha pode ter sido editada desde então.
- **Roda uma vez só, para sempre.** Quem clonar o repositório depois não recebe aquele dado; a base local dele nasce diferente da sua.
- **Não é reexecutável.** Rodou duas vezes, duplicou.

### O seed é idempotente

Rodar duas vezes tem que dar o mesmo resultado que rodar uma:

```ts
// ✅ idempotente
await prisma.category.upsert({
  where: { slug: "servicos" },
  update: {},
  create: { slug: "servicos", name: "Serviços" },
});

// ❌ roda duas vezes, duplica
await prisma.category.create({ data: { slug: "servicos", name: "Serviços" } });
```

Regra prática: **funcionalidade nova que precisa de dado de referência (categoria, status, permissão, plano) ganha um bloco no seed no mesmo PR.** Sem isso, o próximo dev clona o projeto e a tela nasce quebrada.

Separe também o que é **dado de referência** (precisa existir em produção) do que é **dado de exemplo** (só em desenvolvimento) — e proteja o segundo com uma verificação de ambiente.

### Nada de `db push` em banco compartilhado

`prisma db push` e equivalentes alteram o banco sem gerar migration. O histórico fica furado e o próximo deploy não sabe o que aconteceu. Use apenas no seu banco local, para explorar, e gere a migration antes de commitar.

### Antes de gerar migration, atualize sua branch

```bash
git checkout main && git pull
git checkout minha-branch && git rebase main
# só então gere a migration
```

Duas pessoas gerando migration em paralelo produzem duas migrations que não sabem uma da outra. Ordem por timestamp resolve o nome do arquivo, não a semântica — se as duas mexeram na mesma tabela, alguém vai ter dor de cabeça no merge.
