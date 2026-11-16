/**
 * SERVICE — onde moram a regra de negócio e a autorização.
 *
 * O que ele NÃO tem:
 *  - `Request`, `Response`, header, cookie, código de status HTTP
 *  - SQL, query builder, nome de tabela
 *
 * Ele recebe o repository por parâmetro (injeção de dependência). Isso não é
 * cerimônia de arquiteto: é o que faz o teste rodar em milissegundos sem banco.
 */

import type { Invoice, InvoiceRepository } from "./invoice.repository";

export class NotFoundError extends Error {
  readonly code = "not_found";
}

export class ForbiddenError extends Error {
  readonly code = "forbidden";
}

export class BusinessRuleError extends Error {
  readonly code = "business_rule";
}

export type InvoiceService = ReturnType<typeof createInvoiceService>;

export function createInvoiceService(repo: InvoiceRepository) {
  return {
    /**
     * Marca uma fatura como paga.
     *
     * `actorId` é quem está pedindo. O service SEMPRE recebe quem é o ator —
     * ele nunca vai buscar essa informação sozinho, porque não sabe se veio de
     * HTTP, de uma fila ou de um script.
     */
    async markAsPaid(input: {
      invoiceId: string;
      actorId: string;
    }): Promise<Invoice> {
      const invoice = await repo.findById(input.invoiceId);

      if (!invoice) {
        throw new NotFoundError("fatura não encontrada");
      }

      // AuthZ sobre o RECURSO CARREGADO, não sobre o papel do usuário.
      // "É admin?" não responde "esta fatura é dele?".
      //
      // Nota: distinguir "não existe" de "não é sua" revela para um estranho
      // quais IDs existem. Se os IDs forem sequenciais ou adivinháveis,
      // devolva NotFound nos dois casos.
      if (invoice.ownerId !== input.actorId) {
        throw new ForbiddenError("esta fatura não pertence a você");
      }

      // Idempotente: pagar de novo não é erro, simplesmente não faz nada.
      // Vale a pena sempre que a chamada pode ser repetida (retry, duplo clique,
      // webhook reentregue).
      if (invoice.status === "paid") {
        return invoice;
      }

      if (invoice.status === "draft") {
        throw new BusinessRuleError(
          "rascunho precisa ser enviado antes de ser pago",
        );
      }

      return repo.update(invoice.id, { status: "paid", paidAt: new Date() });
    },
  };
}
