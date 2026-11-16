# 1 — Estrutura e camadas

## A regra de ouro

O fluxo vai numa direção só:

```
entrada  →  service  →  repository  →  banco
```

| Camada | Responsabilidade | O que ela NÃO pode ter |
|---|---|---|
| **Entrada** (rota, action, handler de fila, comando de CLI) | Receber, validar, chamar o service, formatar a resposta | Regra de negócio, SQL, acesso ao banco |
| **Service** | Regra de negócio e autorização | `Request`, `Response`, header, cookie, status HTTP |
| **Repository** | Acesso a dados | Regra de negócio, noção de usuário logado |

**Uma camada só conhece a de baixo.** O repository não sabe que o service existe. O service não sabe se a chamada veio de HTTP, de um cron ou de um teste.

Se você precisou pular uma camada — uma rota chamando o banco direto, por exemplo — o desenho está errado ou a operação não precisava de camada nenhuma. Veja "Quando não usar isto" no fim.

## Por que separar

Não é preciosismo de arquiteto. São três ganhos concretos:

**1. O teste fica rápido e honesto.** Com o repository injetado, testar a regra de negócio não precisa de banco, de Docker, nem de `beforeEach` limpando tabela. O teste do exemplo roda em 5ms.

**2. A mesma regra serve vários pontos de entrada.** No dia em que "marcar fatura como paga" precisar acontecer também por webhook do gateway de pagamento e por um script de correção, a regra já está num lugar só. Sem isso, você copia — e as três cópias divergem.

**3. Trocar o ORM deixa de ser reescrita.** Prisma para Drizzle, `pg` para Postgres.js: muda o repository, o resto não sabe.

## Onde os arquivos ficam

Não existe uma estrutura certa. Existem duas que funcionam — escolha uma e seja consistente:

### Opção A — por camada (mais comum, boa até ~30 arquivos)

```
src/
├── routes/          # ou app/actions/ no Next
│   └── invoice.action.ts
├── services/
│   └── invoice.service.ts
├── repositories/
│   └── invoice.repository.ts
├── lib/             # utilitários sem dono: datas, formatação, erros
└── types/
```

### Opção B — por funcionalidade (escala melhor quando o projeto cresce)

```
src/
├── invoice/
│   ├── invoice.action.ts
│   ├── invoice.service.ts
│   ├── invoice.service.test.ts
│   └── invoice.repository.ts
├── delivery/
│   └── ...
└── shared/
```

**Recomendação:** comece na A. Migre para a B quando encontrar um `services/` com 20 arquivos e você não souber mais quais conversam entre si. A migração é mecânica.

## Nomes

- Arquivo: `<assunto>.<camada>.ts` → `invoice.service.ts`. Você sabe o que é sem abrir.
- Teste: ao lado do arquivo testado, com `.test.ts`. Achar o teste não deveria dar trabalho.
- Função de service: verbo do domínio (`markAsPaid`, `cancelDelivery`), não CRUD genérico (`updateInvoice`). O nome descreve a **intenção**, e intenção diferente costuma ter regra diferente.
- Nada de `utils.ts` e `helpers.ts` genéricos. São gavetas de bagunça: em seis meses tem 40 funções sem relação nenhuma ali dentro.

## Detalhes que evitam dor

**O service recebe quem é o ator, nunca vai buscar.**

```ts
// ✅ o service é chamável de qualquer lugar
service.markAsPaid({ invoiceId, actorId });

// ❌ agora o service só funciona dentro de uma requisição HTTP
service.markAsPaid({ invoiceId }); // e lá dentro chama getSession()
```

**O repository devolve dado, não decide.** `findById` devolve `Invoice | null`. Quem transforma `null` em erro 404 é o service (ou a entrada) — o repository não sabe se `null` é um problema.

**Erros de domínio são classes, não strings.** `throw new ForbiddenError()` permite que a entrada mapeie para 403 sem comparar mensagem de texto. Comparar mensagem quebra na primeira vez que alguém corrige uma vírgula.

## Quando NÃO usar isto

Três camadas para uma operação que só lê e devolve é burocracia. Se o service seria literalmente `return repo.findAll()`, deixe a entrada chamar o repository direto.

A camada existe quando há **regra** para proteger. Adicione o service quando aparecer a primeira regra — não antes, por precaução.
