/**
 * ENTRADA — a camada exposta ao mundo.
 *
 * Este exemplo usa a sintaxe de Server Action do Next, mas o conteúdo é o mesmo
 * numa rota Express, num handler de fila ou num comando de CLI: **os 4 pilares
 * acontecem aqui, nesta ordem, e a regra de negócio acontece lá embaixo.**
 *
 * A verdade que todo mundo esquece: uma função `"use server"` exportada é um
 * endpoint POST público. O framework gera uma URL e publica na internet. Não
 * existe "função interna" — a diferença para uma rota HTTP é só sintática.
 */

"use server";

import { z } from "zod";

import { createInMemoryInvoiceRepository } from "./invoice.repository";
import {
  BusinessRuleError,
  createInvoiceService,
  ForbiddenError,
  NotFoundError,
} from "./invoice.service";

// No projeto de verdade isto vem do seu container de dependências / módulo de
// bootstrap, com o repository apontando para o banco real.
const invoiceService = createInvoiceService(createInMemoryInvoiceRepository());

// Troque pelo seu provedor de auth (Clerk, better-auth, NextAuth, sessão própria).
async function getCurrentUserId(): Promise<string | null> {
  return null;
}

const markAsPaidInput = z.object({
  invoiceId: z.string().min(1),
});

type Result =
  | { ok: true; invoiceId: string }
  | { ok: false; error: "unauthorized" | "invalid_input" | "not_found" | "forbidden" | "business_rule" | "internal" };

export async function markInvoiceAsPaid(raw: unknown): Promise<Result> {
  // ── Pilar 1: quem é? ──────────────────────────────────────────────────────
  // Primeira operação da função. Não atrás de outro `await`, não dentro de um
  // `if`. Se falhar aqui, nada mais acontece.
  const actorId = await getCurrentUserId();
  if (!actorId) return { ok: false, error: "unauthorized" };

  // ── Pilar 2: a entrada é válida? ──────────────────────────────────────────
  // O parâmetro é `unknown` de propósito. Se fosse tipado como
  // `{ invoiceId: string }`, o TypeScript te daria uma falsa sensação de
  // segurança: em runtime chega o que o cliente mandar.
  const parsed = markAsPaidInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  // ── Pilar 3: pode fazer isso? ─────────────────────────────────────────────
  // Não é aqui. É no service, que tem a fatura carregada em mãos e consegue
  // perguntar "este recurso é deste usuário?".

  // ── Pilar 4: rate limit ───────────────────────────────────────────────────
  // TODO: limitar por (actorId, "markInvoiceAsPaid"). Em operação cara ou
  // sensível isto não é opcional — é o que impede alguém de rodar um `for`.

  try {
    const invoice = await invoiceService.markAsPaid({
      invoiceId: parsed.data.invoiceId,
      actorId,
    });
    return { ok: true, invoiceId: invoice.id };
  } catch (error) {
    // Erro de domínio vira código conhecido. Erro inesperado NÃO vaza mensagem
    // para o cliente — vai para o log e o cliente recebe "internal".
    if (error instanceof NotFoundError) return { ok: false, error: "not_found" };
    if (error instanceof ForbiddenError) return { ok: false, error: "forbidden" };
    if (error instanceof BusinessRuleError) return { ok: false, error: "business_rule" };

    console.error("markInvoiceAsPaid falhou", error);
    return { ok: false, error: "internal" };
  }
}
