// Install-to-home-screen support (Android/desktop prompt + iOS instructions) and persistent storage.
let deferred = null;
const subs = new Set();
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canInstall = () => !isStandalone() && (!!deferred || isIOS());
export const onChange = fn => { subs.add(fn); return () => subs.delete(fn); };

addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; subs.forEach(f => f()); });
addEventListener('appinstalled', () => { deferred = null; subs.forEach(f => f()); });

export async function install() {
  if (deferred) { deferred.prompt(); const r = await deferred.userChoice; deferred = null; subs.forEach(f => f()); return r.outcome; }
  return isIOS() ? 'ios' : 'unavailable';
}
export async function persist() {
  try { return (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false; } catch { return false; }
}
export async function estimate() {
  try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } catch { return null; }
}
