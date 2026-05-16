const VERSION = 1;

export function onboardingStorageKey(userId: string): string {
  return `nexora_onboarding_v${VERSION}_${userId}`;
}

export function isOnboardingCompleted(userId: string): boolean {
  try {
    return localStorage.getItem(onboardingStorageKey(userId)) === 'done';
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(userId: string): void {
  try {
    localStorage.setItem(onboardingStorageKey(userId), 'done');
  } catch {
    // ignore
  }
}

export function valuePropDismissKey(userId: string, feature: string): string {
  return `nexora_value_prop_${feature}_v1_${userId}`;
}

export function isValuePropDismissed(userId: string, feature: string): boolean {
  try {
    return localStorage.getItem(valuePropDismissKey(userId, feature)) === '1';
  } catch {
    return false;
  }
}

export function dismissValueProp(userId: string, feature: string): void {
  try {
    localStorage.setItem(valuePropDismissKey(userId, feature), '1');
  } catch {
    // ignore
  }
}
