/**
 * REPOSITORY — a única camada que fala com o banco.
 *
 * O que ele NÃO tem:
 *  - noção de usuário logado, permissão ou sessão
 *  - noção de HTTP, request, response
 *  - regra de negócio
 *
 * Se você precisou escrever um `if` de negócio aqui, ele pertence ao service.
 *
 * Aqui a persistência é um Map em memória, só para o exemplo rodar sem banco.
 * Trocar por Prisma, Drizzle ou pg puro NÃO muda a assinatura de nenhum método —
 * e é exatamente por isso que o service não precisa saber qual você usa.
 */

export type InvoiceStatus = "draft" | "sent" | "paid";

export type Invoice = {
  id: string;
  ownerId: string;
  status: InvoiceStatus;
  amountCents: number;
  paidAt: Date | null;
};

/**
 * A interface é o contrato. O service depende DISTO, não da implementação.
 * É o que torna o teste do service trivial: passe outra implementação.
 */
export type InvoiceRepository = {
  findById(id: string): Promise<Invoice | null>;
  update(id: string, patch: Partial<Invoice>): Promise<Invoice>;
};

export function createInMemoryInvoiceRepository(
  seed: Invoice[] = [],
): InvoiceRepository {
  const rows = new Map<string, Invoice>(seed.map((row) => [row.id, row]));

  return {
    async findById(id) {
      return rows.get(id) ?? null;
    },

    async update(id, patch) {
      const current = rows.get(id);
      if (!current) throw new Error(`invoice ${id} não existe`);
      const next = { ...current, ...patch };
      rows.set(id, next);
      return next;
    },
  };
}

/*
 * Com Prisma, a mesma interface fica assim — repare que o service não muda:
 *
 * export function createPrismaInvoiceRepository(prisma: PrismaClient): InvoiceRepository {
 *   return {
 *     findById: (id) => prisma.invoice.findUnique({ where: { id } }),
 *     update: (id, patch) => prisma.invoice.update({ where: { id }, data: patch }),
 *   };
 * }
 */
