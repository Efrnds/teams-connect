# 3 — Testes unitários

## O que testar

A pergunta certa não é "qual a cobertura?", é **"o que me acorda de madrugada?"**.

| Testar sempre | Não vale o esforço |
|---|---|
| Regra de negócio no service | Getter, setter, `toString` |
| Condição de erro e caso limite | Wrapper de uma linha que só repassa |
| Cálculo (preço, imposto, prazo, desconto) | Biblioteca de terceiros (já é testada) |
| Bug que já aconteceu uma vez | Componente puramente visual |
| Autorização: quem pode o quê | Tipos do TypeScript (o compilador já faz) |

**Onde concentrar:** no service. É onde mora a regra, é onde o teste é barato (sem banco, sem rede), e é onde o erro custa caro.

## Anatomia de um bom teste

Do `exemplo/invoice.service.test.ts`:

```ts
it("recusa quando a fatura é de outro dono", async () => {
  const service = makeService([makeInvoice({ ownerId: ANA })]);

  await expect(
    service.markAsPaid({ invoiceId: "inv_1", actorId: BRUNO }),
  ).rejects.toBeInstanceOf(ForbiddenError);
});
```

**Três coisas para copiar daí:**

**1. O nome descreve comportamento.** "recusa quando a fatura é de outro dono", não "testa markAsPaid caso 2". Quando esse teste quebrar daqui a um ano, o nome sozinho já diz o que o sistema deixou de fazer.

**2. O teste só declara o que é diferente do normal.** `makeInvoice({ ownerId: ANA })` — todo o resto vem do padrão da fábrica. Sem isso, cada teste vira 12 linhas de objeto e ninguém enxerga o que importa.

**3. Arrange, act, assert.** Monta o cenário, executa uma coisa, verifica uma coisa. Um teste que verifica cinco comportamentos falha sem dizer qual quebrou.

## Mock, fake e stub — a escolha que mais dá errado

**Prefira fake a mock.** Um *fake* é uma implementação de verdade, simplificada — o repository em memória do exemplo. Um *mock* finge um retorno.

```ts
// ✅ fake: comporta-se como o real
const repo = createInMemoryInvoiceRepository([makeInvoice()]);

// ⚠️ mock: passa mesmo se a assinatura real mudar
const repo = { findById: vi.fn().mockResolvedValue({ id: "inv_1" }) };
```

O problema do mock não é ser feio, é **mentir**. Ele passa a testar o que você imaginou que o repository faz. No dia em que o repository real passa a devolver outra coisa, o teste continua verde e a produção quebra.

Mock é a ferramenta certa para o que você não controla e não quer executar: gateway de pagamento, envio de e-mail, relógio do sistema.

**Nunca mocke o objeto que está sendo testado.** Se para testar o service você precisou mockar um método dele mesmo, o service faz coisa demais.

## Teste de comportamento, não de implementação

```ts
// ❌ quebra em qualquer refatoração, mesmo correta
expect(repo.findById).toHaveBeenCalledTimes(1);

// ✅ só quebra se o comportamento mudar
expect(result.status).toBe("paid");
```

Regra de bolso: **se você renomear uma função interna e o teste quebrar, o teste está errado.**

## Bug: o teste vem primeiro

Sequência obrigatória:

1. Reproduza o bug num teste.
2. **Rode e veja falhar.** Se passou de primeira, você não reproduziu o bug — testou outra coisa.
3. Conserte.
4. Rode de novo: verde.
5. Commit: `fix: impede pagar fatura em rascunho` (código e teste juntos, no mesmo commit).

O passo 2 é o que quase todo mundo pula, e é o único que prova que o teste vale alguma coisa.

## Cobertura

Cobertura é termômetro, não meta. 100% com testes que só verificam se a função foi chamada é pior que 40% cobrindo as regras de verdade — dá a sensação de segurança sem a segurança.

Se quiser um número: garanta que **os services estejam bem cobertos** e ignore o resto. E se for ligar um mínimo no CI, comece no que você já tem hoje e suba de pouco em pouco. Um piso alto demais no primeiro dia é desligado na primeira sexta-feira.

## Estrutura no projeto

```
src/invoice/
├── invoice.service.ts
└── invoice.service.test.ts    ← ao lado, sempre
```

Ao lado do arquivo testado, e não numa pasta `tests/` paralela. Motivo prático: quando alguém move ou apaga o arquivo, vê o teste junto. Em pasta paralela, o teste órfão fica lá por anos.

Exceção: teste ponta a ponta (que sobe o app inteiro) fica separado, em `tests/e2e/` — é outra natureza, roda em outro momento.

## Comandos

```bash
npm test              # roda tudo uma vez (é o que o CI usa)
npm run test:watch    # roda ao salvar — é assim que se trabalha
```
