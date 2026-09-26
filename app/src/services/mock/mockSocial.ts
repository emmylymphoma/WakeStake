import type { SocialService } from '../types';
import { delay } from './util';

export function createMockSocialService(latencyMs: number): SocialService {
  return {
    async publish(post) {
      await delay(latencyMs);
      const id = BigInt(Date.now()) * 4_194_304n;
      return { url: `https://x.com/${post.author.handle || 'wakestake'}/status/${id}` };
    },
  };
}
