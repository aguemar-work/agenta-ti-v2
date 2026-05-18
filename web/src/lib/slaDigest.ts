import { fechaLocalYmd } from '@/lib/fecha';

const PREFIX = 'nexora_sla_digest_v1_';

function key(userId: string): string {
  return `${PREFIX}${userId}_${fechaLocalYmd(new Date())}`;
}

export function wasSlaDigestShownToday(userId: string): boolean {
  try {
    return sessionStorage.getItem(key(userId)) === '1';
  } catch {
    return false;
  }
}

export function markSlaDigestShownToday(userId: string): void {
  try {
    sessionStorage.setItem(key(userId), '1');
  } catch {
    // modo privado / quota
  }
}
