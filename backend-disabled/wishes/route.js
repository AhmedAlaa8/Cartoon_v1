import { createHash, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/* «اكتب أمنيتك» — guests' wishes, kept apart from the RSVP list (wishes.json, never rsvp.json).
   POST appends { name, wish, date[, id] } with the same serialised, atomic write and
   Idempotency-Key handling as /api/rsvp. GET returns the wishes only to the bride and groom:
   it needs `Authorization: Bearer <WISHES_KEY>` (an environment variable). With no key
   configured, reading is closed to everyone. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// WISHES_FILE lets tests write to their own file; unset, it is the real list
const DATA = process.env.WISHES_FILE ? path.resolve(process.env.WISHES_FILE) : path.join(process.cwd(), 'wishes.json');
const MAX_BODY = 10_000;
const MAX_NAME = 60;
const MAX_WISH = 300;
const MIN_KEY = 16;

let queue = Promise.resolve();

async function readList() {
  try {
    const list = JSON.parse(await fs.readFile(DATA, 'utf8'));
    if (!Array.isArray(list)) throw new Error('wishes.json is not a list');
    return list;
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

// a repeated submission id (a retry, a double tap) is answered without writing again
async function append(record) {
  const list = await readList();
  if (record.id && list.some(r => r.id === record.id)) return { duplicate: true };
  list.push(record);
  const tmp = `${DATA}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
  await fs.rename(tmp, DATA);
  return { duplicate: false };
}

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export async function POST(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false }, 413);

  let data;
  try { data = JSON.parse(raw || '{}'); } catch { return json({ ok: false }, 400); }

  const wish = clean(data?.wish, MAX_WISH);
  if (!wish) return json({ ok: false }, 400);
  const name = clean(data?.name, MAX_NAME);
  const id = String(request.headers.get('idempotency-key') || data.id || '').trim();
  if (id && !/^[A-Za-z0-9-]{8,64}$/.test(id)) return json({ ok: false }, 400);
  const record = { name, wish, date: new Date().toLocaleString('ar-EG') };
  if (id) record.id = id;

  const write = queue.then(() => append(record));
  queue = write.catch(() => {});

  try {
    const { duplicate } = await write;
    // the wish itself stays out of the server log: it is private to the couple
    if (!duplicate) console.log('✨ أمنية جديدة');
    return json(duplicate ? { ok: true, duplicate } : { ok: true });
  } catch (e) {
    console.error('wish write failed:', e.message);
    return json({ ok: false }, 500);
  }
}

// constant-time comparison of the presented key against WISHES_KEY
function authorised(request) {
  const key = process.env.WISHES_KEY || '';
  if (key.length < MIN_KEY) return false;
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = createHash('sha256').update(given).digest(), b = createHash('sha256').update(key).digest();
  return given.length > 0 && timingSafeEqual(a, b);
}

export async function GET(request) {
  if (!authorised(request)) return json({ ok: false }, 401);
  try {
    const list = await readList();
    return json({ ok: true, wishes: list.map(({ name, wish, date }) => ({ name, wish, date })) });
  } catch (e) {
    console.error('wish read failed:', e.message);
    return json({ ok: false }, 500);
  }
}
