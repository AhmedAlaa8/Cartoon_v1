import { promises as fs } from 'node:fs';
import path from 'node:path';

/* RSVP — appends { name, count, date[, id] } to rsvp.json (same shape as the
   old server.js; `id` only on submissions that send one). Writes are serialised and atomic (temp file + rename)
   so two guests confirming at the same moment never lose a row, and an
   unreadable file is never overwritten with a fresh list. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// RSVP_FILE lets tests write to their own file; unset, it is the real guest list
const DATA = process.env.RSVP_FILE ? path.resolve(process.env.RSVP_FILE) : path.join(process.cwd(), 'rsvp.json');
const MAX_BODY = 10_000;
const MAX_NAME = 80;

let queue = Promise.resolve();

async function readList() {
  try {
    const list = JSON.parse(await fs.readFile(DATA, 'utf8'));
    if (!Array.isArray(list)) throw new Error('rsvp.json is not a list');
    return list;
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

// a repeated submission id (a retry, a double tap) is answered without writing again
async function append(record) {
  const list = await readList();
  if (record.id && list.some(r => r.id === record.id)) return { total: list.length, duplicate: true };
  list.push(record);
  const tmp = `${DATA}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
  await fs.rename(tmp, DATA);
  return { total: list.length, duplicate: false };
}

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false }, 413);

  let data;
  try { data = JSON.parse(raw || '{}'); } catch { return json({ ok: false }, 400); }

  const name = String(data?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  if (!name) return json({ ok: false }, 400);
  const count = Math.min(50, Math.max(1, parseInt(data.count, 10) || 1));
  // optional submission id (Idempotency-Key header or body.id) — older clients send none
  const id = String(request.headers.get('idempotency-key') || data.id || '').trim();
  if (id && !/^[A-Za-z0-9-]{8,64}$/.test(id)) return json({ ok: false }, 400);
  const record = { name, count, date: new Date().toLocaleString('ar-EG') };
  if (id) record.id = id;

  const write = queue.then(() => append(record));
  queue = write.catch(() => {});

  try {
    const { total, duplicate } = await write;
    if (!duplicate) console.log('✅ تأكيد حضور:', name, '— عدد:', count, '— الإجمالي:', total);
    return json(duplicate ? { ok: true, total, duplicate } : { ok: true, total });
  } catch (e) {
    console.error('RSVP write failed:', e.message);
    return json({ ok: false }, 500);
  }
}
