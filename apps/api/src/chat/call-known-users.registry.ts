import { Injectable } from '@nestjs/common';

/** IDs de usuários que já autenticaram no namespace `/chat` neste processo. */
@Injectable()
export class CallKnownUsersRegistry {
  private readonly known = new Set<string>();

  register(userId: string): void {
    if (userId) this.known.add(userId);
  }

  isKnown(userId: string): boolean {
    return this.known.has(userId);
  }

  /** Apenas para testes unitários. */
  reset(): void {
    this.known.clear();
  }
}