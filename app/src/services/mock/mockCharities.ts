import type { Charity } from '../../domain/types';
import type { CharityService } from '../types';
import { delay } from './util';

export const MOCK_CHARITIES: Charity[] = [
  { id: 'givedirectly', name: 'GiveDirectly', tagline: 'Cash straight to people in poverty.', emoji: '💸', category: 'Poverty' },
  { id: 'amf', name: 'Against Malaria Foundation', tagline: 'Bed nets. Ironic, given your situation.', emoji: '🦟', category: 'Health' },
  { id: 'oceancleanup', name: 'The Ocean Cleanup', tagline: 'Pulling plastic out of the ocean.', emoji: '🌊', category: 'Climate' },
  { id: 'foodbank', name: 'Local Food Bank', tagline: 'Feeds your neighbors while you sleep in.', emoji: '🥫', category: 'Community' },
  { id: 'eff', name: 'Electronic Frontier Foundation', tagline: 'Defends digital rights. Not your right to snooze.', emoji: '🛡️', category: 'Tech' },
  { id: 'sleepresearch', name: 'Sleep Research Society', tagline: 'Maximum irony option.', emoji: '😴', category: 'Science' },
];

export function createMockCharityService(latencyMs: number): CharityService {
  return {
    async list() {
      await delay(latencyMs);
      return MOCK_CHARITIES;
    },
  };
}
