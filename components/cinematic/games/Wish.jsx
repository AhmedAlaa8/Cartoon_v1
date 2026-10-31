'use client';

import { useRef, useState } from 'react';
import { submissionId } from '@/lib/games/id';
import { WishIcon } from './icons';

/* «اكتب أمنيتك» — a short wish to the bride and groom, saved apart from the RSVP
   (/api/wishes → wishes.json) and readable only by them. On success the layer closes
   this and a golden star rises into the sky. */

const MAX = 300;
const toArabic = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

export default function Wish({ name: initialName, onSent }) {
  const [name, setName] = useState(initialName || '');
  const [wish, setWish] = useState('');
  const [state, setState] = useState('idle');      // idle | sending | error
  const [error, setError] = useState('');
  const id = useRef(null);                          // kept across retries: the server ignores repeats
  const wishIn = useRef(null);

  const submit = async e => {
    e.preventDefault();
    if (state === 'sending') return;
    const text = wish.replace(/\s+/g, ' ').trim();
    if (!text) { setError('اكتب أمنيتك أولًا'); setState('error'); wishIn.current?.focus(); return; }
    id.current ||= submissionId();
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id.current },
        body: JSON.stringify({ name: name.replace(/\s+/g, ' ').trim(), wish: text, id: id.current }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onSent();
    } catch {
      setError('تعذّر إرسال الأمنية — تأكّد من الاتصال وحاول مرة أخرى');
      setState('error');
    }
  };

  return (
    <form className="gm-wish" onSubmit={submit} noValidate>
      <WishIcon size={66} />
      <h2 className="gm-title">اكتب أمنيتك</h2>
      <p className="gm-sub">كلمة منك لأحمد وعبير — تصلهما وحدهما، وتضيء نجمة في سمائهما</p>
      <label className="cine-field">
        <span>اسمك (اختياري)</span>
        <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="name" />
      </label>
      <label className="cine-field">
        <span>أمنيتك</span>
        <textarea
          ref={wishIn} value={wish} maxLength={MAX} rows={4}
          onChange={e => { setWish(e.target.value); if (state === 'error') setState('idle'); }}
          aria-invalid={state === 'error' && !wish.trim() ? 'true' : undefined} aria-describedby="wish-msg wish-count"
        />
        <small id="wish-count" className="gm-count-chars">{toArabic(wish.length)} / {toArabic(MAX)}</small>
      </label>
      <button type="submit" className="cine-btn" disabled={state === 'sending'} aria-busy={state === 'sending'}>
        {state === 'sending' ? 'جارٍ الإرسال…' : 'أرسل أمنيتي إلى السماء'}
      </button>
      <p id="wish-msg" className="cine-msg" role="alert">{state === 'error' ? error : ''}</p>
    </form>
  );
}
