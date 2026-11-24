import { it } from 'vitest';
import { report } from './sim';
it.skipIf(!process.env.BALANCE)('balance', () => { report(Number(process.env.BALANCE)); }, 3_600_000);
