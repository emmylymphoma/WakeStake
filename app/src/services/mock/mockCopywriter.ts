import { formatMoney } from '../../domain/money';
import type { CopywriterService, ShameContext } from '../types';
import { delay } from './util';

const TEMPLATES: ((c: ShameContext, amount: string) => string)[] = [
  (c, a) =>
    `I just paid ${a} to sleep 9 more minutes. That's snooze #${c.stats.snoozeCount + 1} for me. My alarm is undefeated.`,
  (c, a) =>
    `Update: my bed has successfully extorted ${a} from me. The money went to ${c.charityName}, so technically I'm a hero.`,
  (_c, a) => `Me: "I'm a morning person now." Also me, 7:09am: *donates ${a} to avoid standing up*`,
  (c, a) =>
    `Snooze #${c.sessionSnoozeIndex + 1} this morning. ${a} gone. At this rate ${c.charityName} should name a wing after me.`,
];

export function createMockCopywriterService(latencyMs: number): CopywriterService {
  return {
    async writeShamePost(ctx) {
      await delay(latencyMs);
      const template = TEMPLATES[(ctx.stats.snoozeCount + ctx.sessionSnoozeIndex) % TEMPLATES.length]!;
      return `${template(ctx, formatMoney(ctx.penalty))}\n\n#USnoozeULose @WakeStake`;
    },
  };
}
