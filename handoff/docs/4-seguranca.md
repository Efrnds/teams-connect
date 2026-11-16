# 4 — Segurança: os 4 pilares

## A verdade fundamental

> **Toda função exposta é um endpoint público — inclusive a que parece interna.**

Uma Server Action do Next tem uma URL. O framework gera um ID e publica na internet. O ID estar "escondido" não protege nada: ele está no bundle que o navegador baixa. Vale igual para rota Express, handler de fila e endpoint de webhook.

Se dá para chamar de fora do processo, **alguém vai chamar com `curl`** — sem passar pelo seu formulário, sem o campo desabilitado, sem o `if` que você fez no frontend.

Corolário: **validação no frontend é experiência do usuário, não segurança.** Ela existe para a pessoa não errar, e é apagável com F12.

## Os 4 pilares

Toda operação que **muda dados** aplica os quatro, nesta ordem. Faltar um é motivo para reprovar o PR.

### 1. Quem é? (autenticação)

```ts
const actorId = await getCurrentUserId();
if (!actorId) return { ok: false, error: "unauthorized" };
```

**Primeira operação da função.** Não depois de outro `await`, não dentro de um `if`, não no meio. Duas razões: se falhar, nada mais acontece; e quem lê o código vê a proteção na primeira linha, em vez de precisar procurar.

### 2. A entrada é válida?

```ts
export async function markInvoiceAsPaid(raw: unknown) {
  const parsed = markAsPaidInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
```

**O parâmetro é `unknown` de propósito.** Se você tipar como `{ invoiceId: string }`, o TypeScript te dá uma falsa sensação de segurança: tipo não existe em runtime, e em runtime chega o que o cliente mandar — número, objeto aninhado, `null`, um array de 10MB.

O schema (Zod, Valibot, o que preferir) é a única fronteira real entre o mundo e o seu código.

Valide também o que "não pode dar errado": limite de tamanho de string, faixa de números, formato de e-mail, valores de enum.

### 3. Pode fazer isso? (autorização)

**Mora no service, sobre o recurso carregado.**

```ts
const invoice = await repo.findById(input.invoiceId);
if (!invoice) throw new NotFoundError();
if (invoice.ownerId !== input.actorId) throw new ForbiddenError();
```

Este é o erro mais comum e mais caro do assunto inteiro. Duas perguntas diferentes:

| Pergunta | Responde | Suficiente? |
|---|---|---|
| "É admin?" / "tem a permissão X?" | o papel do usuário | **não** |
| "Esta fatura é dele?" | o vínculo com o recurso | **sim** |

Se você só verifica o papel, qualquer usuário logado troca o `invoiceId` no `curl` e opera sobre o dado de outra pessoa. Isso tem nome — *IDOR*, referência direta insegura a objeto — e é uma das falhas mais frequentes em aplicação web.

Por isso a autorização é no service: é lá que a fatura já está carregada e dá para comparar. Na entrada você ainda não tem o recurso em mãos.

**Detalhe fino:** distinguir "não existe" de "não é sua" conta a um estranho quais IDs existem. Se os IDs forem sequenciais (`/invoice/1`, `/invoice/2`), devolva "não encontrado" nos dois casos. Com IDs aleatórios (uuid, cuid) o vazamento é irrelevante.

### 4. Rate limit

Sem limite, uma operação cara vira negação de serviço e um endpoint de login vira força bruta.

Limite por **identidade + ação**, não só por IP — IP é compartilhado por escritório inteiro e trocável com um proxy.

Comece pelo que dói: login, recuperação de senha, envio de e-mail/SMS, qualquer coisa que gere custo por chamada. O resto pode esperar.

## Erros comuns fora dos 4 pilares

**Mensagem de erro interno vazando para o cliente.**

```ts
// ❌ entrega nome de tabela, coluna e às vezes trecho de query
catch (e) { return { error: e.message }; }

// ✅ código conhecido para o cliente, detalhe para o log
catch (e) {
  console.error("markInvoiceAsPaid falhou", e);
  return { ok: false, error: "internal" };
}
```

**Segredo no código do cliente.** Tudo que o navegador recebe é público. Em Next, `NEXT_PUBLIC_*` vai para o bundle — chave de API de terceiro **não** é `NEXT_PUBLIC`.

**Confiar em campo que veio do cliente para decidir permissão.** Se o corpo da requisição traz `{ userId, invoiceId }`, o `userId` é sugestão do cliente. Use o da sessão, sempre.

**Devolver o objeto do banco inteiro.** `return user` manda hash de senha, token de reset e e-mail interno junto. Devolva apenas os campos que a tela precisa.

**Log com dado sensível.** Senha, token, cartão e CPF não vão para o log. Log vaza — para ferramenta de observabilidade, para print em Slack, para quem tem acesso ao servidor.

## Checklist rápido de PR

- [ ] A identificação do usuário é a primeira operação?
- [ ] A entrada é `unknown` e passa por schema?
- [ ] A autorização compara com o **recurso carregado**, não só com o papel?
- [ ] Operação cara ou sensível tem limite de taxa?
- [ ] Erro inesperado vira código genérico, com detalhe só no log?
- [ ] A resposta devolve só os campos necessários?
