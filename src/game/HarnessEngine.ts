/**
 * ハーネス（自律術式）エンジン。
 *
 * 呪文は登録時に一度だけ解釈する。その後はここが構造化された
 * trigger / conditions / actions / cooldown をローカルで監視・実行する。
 * 毎フレーム呪文を解釈し直すことはしない。
 *
 * 無制限発動の禁止:
 * - クールダウン（最低 HARNESS.MIN_COOLDOWN_MS）
 * - 最大発動回数
 * - 発動ごとに魔力を消費（足りなければ不発）
 * - 自律術式が起こしたイベントで自律術式は発動しない（連鎖・無限ループ防止）
 * - 自律術式の中で自律術式は登録できない
 */
import { HARNESS } from './constants';
import { harnessTriggerCost } from './ManaSystem';
import type { BattleState } from './BattleState';
import type { MagicEngine } from './MagicEngine';
import type { ActiveHarness, BattleEvent } from './types';
import type { HarnessSpec } from '../interpreter/schema';

const TRIGGER_JA: Record<HarnessSpec['trigger']['type'], string> = {
  ENEMY_CAST_START: '敵が攻撃詠唱を開始したとき',
  PLAYER_HIT: '自分が被弾したとき',
  PLAYER_HP_BELOW: '自分のHPが一定以下になったとき',
  ENEMY_HP_BELOW: '敵のHPが一定以下になったとき',
  EVERY_SECONDS: '一定時間ごと',
};

export function describeTrigger(spec: HarnessSpec): string {
  const v = spec.trigger.value;
  const base = TRIGGER_JA[spec.trigger.type];
  return v !== null && spec.trigger.type !== 'ENEMY_CAST_START' && spec.trigger.type !== 'PLAYER_HIT'
    ? `${base}（${v}${spec.trigger.type === 'EVERY_SECONDS' ? '秒' : ''}）`
    : base;
}

export class HarnessEngine {
  private executing = false;

  constructor(
    private readonly s: BattleState,
    private readonly magic: MagicEngine,
  ) {}

  register(spec: HarnessSpec, sourceText: string): ActiveHarness {
    const s = this.s;
    while (s.harnesses.length >= HARNESS.MAX_ACTIVE) {
      const old = s.harnesses.shift()!;
      s.log('harness', `自律術式「${old.spec.name}」を解除（同時に保持できるのは${HARNESS.MAX_ACTIVE}件まで）`);
    }
    const h: ActiveHarness = {
      id: s.nextId(),
      spec,
      sourceText,
      registeredAt: s.time,
      lastTriggeredAt: -Infinity,
      triggerCount: 0,
      triggerCost: harnessTriggerCost(spec),
      armed: true,
      lastStatus: '監視中',
    };
    s.harnesses.push(h);
    s.log('harness', `自律術式「${spec.name}」を刻印: ${describeTrigger(spec)} / 発動コスト${h.triggerCost} / CD ${spec.cooldownMs / 1000}秒 / 最大${spec.maxTriggers}回`);
    return h;
  }

  /** tick中に起きたイベントを処理 */
  onEvents(events: BattleEvent[]): void {
    for (const ev of events) {
      for (const h of [...this.s.harnesses]) {
        if (h.spec.trigger.type === ev.type) this.tryFire(h, ev.type === 'ENEMY_CAST_START' ? '敵の攻撃詠唱を検知' : '被弾を検知');
      }
    }
  }

  /** 状態監視型トリガー */
  tick(): void {
    const s = this.s;
    for (const h of [...s.harnesses]) {
      const t = h.spec.trigger;
      if (t.type === 'PLAYER_HP_BELOW' || t.type === 'ENEMY_HP_BELOW') {
        const hp = t.type === 'PLAYER_HP_BELOW' ? s.player.hp : s.enemy.hp;
        const th = t.value ?? 30;
        if (hp <= th && h.armed) {
          h.armed = false;
          this.tryFire(h, `HP ${hp} ≤ ${th} を検知`);
        } else if (hp > th) {
          h.armed = true;
        }
      } else if (t.type === 'EVERY_SECONDS') {
        const interval = Math.max((t.value ?? 5) * 1000, h.spec.cooldownMs);
        const since = Math.max(h.registeredAt, Number.isFinite(h.lastTriggeredAt) ? h.lastTriggeredAt : h.registeredAt);
        if (s.time - since >= interval) this.tryFire(h, '定期発動');
      }
    }
  }

  private conditionsMet(h: ActiveHarness): string | null {
    const s = this.s;
    for (const c of h.spec.conditions) {
      const ok =
        c.type === 'MANA_ABOVE' ? s.mana.current > c.value
        : c.type === 'MANA_BELOW' ? s.mana.current < c.value
        : c.type === 'PLAYER_HP_ABOVE' ? s.player.hp > c.value
        : c.type === 'PLAYER_HP_BELOW' ? s.player.hp < c.value
        : s.enemy.hp < c.value;
      if (!ok) return `条件 ${c.type} ${c.value} を満たさない`;
    }
    return null;
  }

  private tryFire(h: ActiveHarness, why: string): void {
    const s = this.s;
    if (this.executing) return; // 連鎖発動の禁止
    if (s.phase !== 'battle') return;
    if (h.triggerCount >= h.spec.maxTriggers) {
      h.lastStatus = '発動上限に到達（停止）';
      return;
    }
    if (s.time - h.lastTriggeredAt < h.spec.cooldownMs) {
      h.lastStatus = `${why} → クールダウン中で不発`;
      s.log('harness', `「${h.spec.name}」${h.lastStatus}`);
      return;
    }
    const ng = this.conditionsMet(h);
    if (ng) {
      h.lastStatus = `${why} → ${ng}ため実行しない`;
      s.log('harness', `「${h.spec.name}」${h.lastStatus}`);
      return;
    }
    if (!s.mana.spend(h.triggerCost)) {
      h.lastStatus = `${why} → 魔力不足で不発（必要${h.triggerCost}）`;
      s.log('harness', `「${h.spec.name}」${h.lastStatus}`);
      return;
    }
    h.lastTriggeredAt = s.time;
    h.triggerCount++;
    h.lastStatus = `${why} → 発動（${h.triggerCount}/${h.spec.maxTriggers}）`;
    s.log('harness', `⚙ 自律術式「${h.spec.name}」発動: ${why}（魔力-${h.triggerCost}）`);
    this.executing = true;
    try {
      for (const a of h.spec.actions) this.magic.execute(a, 'harness');
    } finally {
      this.executing = false;
    }
  }
}
