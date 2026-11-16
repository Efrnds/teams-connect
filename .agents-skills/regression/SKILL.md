---
name: regression
description: Use sempre que um bug for descrito — print de tela quebrada, stack trace, erro de console, erro de build, ou uma frase como "isso não funciona", "não atualiza", "o botão não faz nada". Força TDD - escreve o teste que falha primeiro, só depois conserta, e valida em cadeia no fim. Não usar para funcionalidade nova nem para refatoração sem bug reportado.
---

# regression — conserto de bug com teste primeiro

Quando esta skill ativa, siga o fluxo abaixo **sem pular etapa**. Especialmente a etapa 3.

## Quando ativa

- Print de tela quebrada, layout torto, botão que não responde
- Stack trace, erro de console, erro de build ou de tipo
- Descrição de comportamento errado: "salvei e não mudou nada", "o total está errado"
- Teste que passou a falhar

## Quando NÃO ativa

- Funcionalidade nova → é implementação normal, não conserto
- Refatoração sem bug reportado
- Ajuste de texto ou cor num lugar só, sem lógica envolvida → conserte direto

---

## Fluxo

### 1 · Entenda antes de tocar em arquivo

Escreva, em uma linha cada:

- **Sintoma** — o que a pessoa viu acontecer
- **Esperado** — o que deveria ter acontecido
- **Camada** — entrada, service, repository, banco, build ou interface

Se a descrição estiver ambígua, **leia o código primeiro**. Pergunte só se, depois de ler, você ainda não conseguir reproduzir mentalmente. Pergunta que o repositório responde é tempo perdido.

### 2 · Encontre a causa, não o sintoma

Busque no código de produção até achar a linha responsável. Verbalize a causa antes de escrever qualquer coisa:

> "O service devolve a fatura sem verificar o status, então rascunho passa pelo caminho de pagamento."

Se não consegue escrever essa frase, ainda não entendeu o bug. Continue lendo.

### 3 · Escreva o teste que falha — e veja ele falhar

Esta é a etapa que não se pula.

1. Escreva o teste que reproduz o bug.
2. **Rode.**
3. **Confirme que ele falha, e falha pelo motivo certo.**

Se passou de primeira, você não reproduziu o bug — reescreva o teste. Se falhou por outro motivo (import errado, dado faltando), corrija o teste até falhar pela razão real.

**Não escreva o conserto antes disto.** Um teste escrito depois do conserto costuma testar a solução que você já tinha em mente, não o problema.

### 4 · Conserte

O menor conserto que faz o teste passar. Sem refatorar de carona, sem "já que estou aqui".

### 5 · Valide em cadeia

```bash
npm test          # o novo teste passa E os antigos continuam passando
npm run typecheck
npm run lint
```

Se mexeu em configuração ou build, rode `npm run build` também.

### 6 · Commit

Teste e conserto no **mesmo commit** — separados, o histórico perde a prova de que o teste pegava o bug:

```
fix: impede pagar fatura em rascunho
```

---

## Relatório final

Termine sempre com:

- **Causa** — uma frase
- **Conserto** — arquivo e o que mudou
- **Teste** — nome do teste que agora protege isso
- **Validação** — o que rodou e passou

Se alguma etapa foi pulada, **diga qual e por quê**. Não afirme que está pronto sem ter rodado os comandos.
