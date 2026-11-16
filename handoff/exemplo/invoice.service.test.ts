/**
 * TESTE DO SERVICE — é aqui que a maior parte dos seus testes deve estar.
 *
 * Repare em três coisas:
 *
 * 1. Não tem mock de biblioteca. O repository real de teste é uma implementação
 *    de verdade, em memória. Mock que "finge" retorno costuma mentir; um Map
 *    de verdade, não.
 *
 * 2. O nome de cada teste descreve COMPORTAMENTO ("recusa fatura de outro dono"),
 *    não implementação ("chama repo.findById uma vez").
 *
 * 3. Cada teste tem um motivo de existir: um caminho feliz e quatro maneiras
 *    diferentes de dar errado. É o que te acorda de madrugada, não o getter.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemoryInvoiceRepository,
  type Invoice,
} from "./invoice.repository";
import {
  BusinessRuleError,
  createInvoiceService,
  ForbiddenError,
  NotFoundError,
} from "./invoice.service";

const ANA = "user_ana";
const BRUNO = "user_bruno";

/** Fábrica de dado de teste: o teste só diz o que é DIFERENTE do normal. */
function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_1",
    ownerId: ANA,
    status: "sent",
    amountCents: 5000,
    paidAt: null,
    ...overrides,
  };
}

function makeService(rows: Invoice[]) {
  return createInvoiceService(createInMemoryInvoiceRepository(rows));
}

describe("invoiceService.markAsPaid", () => {
  it("marca como paga a fatura enviada do próprio dono", async () => {
    const service = makeService([makeInvoice({ status: "sent" })]);

    const result = await service.markAsPaid({
      invoiceId: "inv_1",
      actorId: ANA,
    });

    expect(result.status).toBe("paid");
    expect(result.paidAt).toBeInstanceOf(Date);
  });

  it("recusa quando a fatura é de outro dono", async () => {
    const service = makeService([makeInvoice({ ownerId: ANA })]);

    await expect(
      service.markAsPaid({ invoiceId: "inv_1", actorId: BRUNO }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("recusa pagar um rascunho", async () => {
    const service = makeService([makeInvoice({ status: "draft" })]);

    await expect(
      service.markAsPaid({ invoiceId: "inv_1", actorId: ANA }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("é idempotente: pagar de novo devolve a fatura sem alterá-la", async () => {
    const paidAt = new Date("2026-01-15T10:00:00Z");
    const service = makeService([makeInvoice({ status: "paid", paidAt })]);

    const result = await service.markAsPaid({
      invoiceId: "inv_1",
      actorId: ANA,
    });

    expect(result.status).toBe("paid");
    expect(result.paidAt).toEqual(paidAt); // a data original foi preservada
  });

  it("falha quando a fatura não existe", async () => {
    const service = makeService([]);

    await expect(
      service.markAsPaid({ invoiceId: "inv_inexistente", actorId: ANA }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
