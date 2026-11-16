# Regras do projeto

Documento lido por agentes de IA e por humanos. O detalhe de cada tema está em `docs/`.

> Este arquivo é idêntico ao `AGENTS.md`. Editou um, edite o outro.

---

## Estrutura e camadas → `docs/1-estrutura.md`

O fluxo vai numa direção só:

```
entrada (rota HTTP / server action / CLI)  →  service  →  repository  →  banco
```

- **Entrada**: recebe, valida, chama o service, formata a resposta. Não tem regra de negócio, não fala com o banco.
- **Service**: regra de negócio e autorização. Não sabe o que é `Request`, `Response`, header ou cookie.
- **Repository**: só acesso a dados. Recebe parâmetro, devolve dado. Sem `if` de negócio, sem noção de usuário logado.

Uma camada só conhece a de baixo. Se precisou pular uma, o desenho está errado.

## Segurança → `docs/4-seguranca.md`

Toda função que **muda dados** e é alcançável de fora aplica os 4 pilares, nesta ordem:

1. **Quem é** — identificar o usuário é a primeira operação, antes de qualquer I/O.
2. **A entrada é válida** — trate como `unknown` e passe por um schema. Nunca confie no tipo declarado.
3. **Pode fazer isso** — autorização no service, sobre o **recurso carregado**, não só sobre o papel do usuário. "É admin" não responde "esta fatura é dele?".
4. **Rate limit** — por identidade e por ação, nas operações caras ou sensíveis.

Faltar um dos quatro é motivo para reprovar o PR.

## Testes → `docs/3-testes.md`

- **Bug sempre começa com teste que falha.** Escreva o teste, veja falhar, aí conserte.
- Teste **comportamento**, não implementação. O nome do teste descreve o que o sistema faz, não qual função é chamada.
- O service é o alvo principal — é onde mora a regra. Mocke o repository, não o banco.
- Não teste getter, não teste a biblioteca dos outros, não persiga 100% de cobertura.

## Banco → `docs/5-qualidade.md`

- **DDL** (criar/alterar/remover tabela ou coluna) vai em **migration**.
- **Dado** (`INSERT`/`UPDATE` sem DDL ao lado) vai em **seed**, e o seed é **idempotente** — rodar duas vezes dá o mesmo resultado.
- Exceção: backfill de coluna nova vai junto no arquivo da migration que criou a coluna.
- Nada de `db push` contra banco compartilhado.

## Fluxo de trabalho → `docs/2-fluxo.md`

1. Branch a partir da principal, nomeada `feat/`, `fix/` ou `chore/`.
2. Teste primeiro quando for bug; teste junto quando for feature.
3. Commit em Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`).
4. Antes de abrir o PR: `typecheck`, `lint` e `test` passando localmente.
5. PR pequeno. Se passou de ~400 linhas, provavelmente são dois PRs.

## Qualidade → `docs/5-qualidade.md`

- **Nunca desligue o typecheck ou o lint no build.** Erro que não quebra o build vai para produção calado.
- `strict: true` no TypeScript. Em projeto legado, ligue e vá reduzindo a lista de exceções.
- CI roda `typecheck + lint + test + build` em todo PR.

---

## Ao trabalhar neste projeto

- **Leia o código antes de propor mudança.** O padrão do arquivo ao lado vale mais que o padrão do livro.
- **Não invente dependência nova** sem dizer por que a que já existe não serve.
- **Mudou comportamento, mudou teste.** PR que muda lógica e não toca em teste é suspeito.
- **Não edite os arquivos gerados** (`.gitignore`d, lockfiles, snapshots) à mão sem entender por quê.
- Ao encontrar código que viola estas regras: **não refatore por conta própria** se não for o assunto do PR. Aponte e siga.
