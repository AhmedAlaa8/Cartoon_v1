/* What a guest's own device remembers for the games (nothing leaves it):
   the hearts found so far, whether the finale has played, and the optional
   name the guest typed for the games. Never connected to the RSVP.
   Every access is guarded — private browsing can refuse storage. */

export const HEART_IDS = ['door', 'aisle', 'lake', 'tree', 'arch'];
const KEYS = { hearts: 'wedding-hearts', finale: 'wedding-hearts-finale', name: 'wedding-guest-name', asked: 'wedding-guest-asked' };

const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ } };

export function foundHearts() {
  try {
    const list = JSON.parse(read(KEYS.hearts) || '[]');
    return Array.isArray(list) ? HEART_IDS.filter(id => list.includes(id)) : [];
  } catch { return []; }
}
export function saveHeart(id) {
  const list = foundHearts();
  if (!list.includes(id)) list.push(id);
  write(KEYS.hearts, JSON.stringify(list));
  return list;
}
export const finaleSeen = () => read(KEYS.finale) === '1';
export const markFinale = () => write(KEYS.finale, '1');

export const guestName = () => (read(KEYS.name) || '').slice(0, 40);
export const nameAsked = () => read(KEYS.asked) === '1';
export function saveName(name) {
  write(KEYS.name, name ? name.slice(0, 40) : null);
  write(KEYS.asked, '1');
}
