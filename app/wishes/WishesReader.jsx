'use client';

import { useState } from 'react';

const toArabic = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

export default function WishesReader() {
  const [key, setKey] = useState('');
  const [state, setState] = useState('idle');       // idle | loading | open | denied | error
  const [wishes, setWishes] = useState([]);

  const open = async e => {
    e.preventDefault();
    if (!key.trim() || state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch('/api/wishes', { headers: { Authorization: `Bearer ${key.trim()}` }, cache: 'no-store' });
      if (res.status === 401) { setState('denied'); return; }
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      setWishes(body.wishes || []);
      setState('open');
      setKey('');                 // the key is not kept anywhere on the page
    } catch {
      setState('error');
    }
  };

  if (state === 'open') {
    return (
      <main className="wr">
        <h1 className="wr-title">أمنيات الضيوف</h1>
        <p className="wr-count">{wishes.length ? `${toArabic(wishes.length)} أمنية` : 'لا توجد أمنيات بعد'}</p>
        <ul className="wr-list">
          {[...wishes].reverse().map((w, i) => (
            <li className="wr-wish" key={i}>
              <p className="wr-text">«{w.wish}»</p>
              <p className="wr-meta"><bdi>{w.name || 'ضيف'}</bdi> · {w.date}</p>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return (
    <main className="wr">
      <h1 className="wr-title">أمنيات الضيوف</h1>
      <p className="wr-lead">هذه الصفحة خاصة بالعروسين. اكتبا مفتاح القراءة لعرض الأمنيات.</p>
      <form className="wr-form" onSubmit={open}>
        <input type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" aria-label="مفتاح القراءة" placeholder="مفتاح القراءة" />
        <button type="submit" disabled={state === 'loading'}>{state === 'loading' ? 'جارٍ الفتح…' : 'عرض الأمنيات'}</button>
      </form>
      <p className="wr-msg" role="alert">
        {state === 'denied' ? 'المفتاح غير صحيح، أو لم يُضبط مفتاح على الخادم.' : state === 'error' ? 'تعذّر الاتصال، حاول مرة أخرى.' : ''}
      </p>
    </main>
  );
}
