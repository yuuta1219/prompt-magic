import type { LogEntry, LogKind } from './types';

export class BattleLogger {
  private entries: LogEntry[] = [];
  private seq = 0;
  constructor(private readonly limit = 200) {}

  log(t: number, kind: LogKind, text: string): void {
    this.entries.push({ id: ++this.seq, t, kind, text });
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
  }

  all(): readonly LogEntry[] {
    return this.entries;
  }

  /** テスト用 */
  has(pattern: RegExp): boolean {
    return this.entries.some((e) => pattern.test(e.text));
  }
}
