'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WEDDING, weddingInstant } from '@/lib/wedding';

/* ================================================================
   Cinematic invitation shell: six chapters, no page scroll.
   Next = swipe left→right (RTL), the ‹ medallion, ←, PageDown/Space,
   the mouse wheel — or tap a thing in the world (the moon, the tree,
   the arch, the lake, the high sky) to travel to its chapter. Each
   chapter has its own #hash. Until the 3D world is ready (or without
   WebGL) a pre-rendered still of the chapter stands in.
   Query flags (preview tools): ?still=1 capture mode, ?slowmo=N, ?debug=1,
   ?games=1 the games & surprises preview (not part of the invitation until approved)
================================================================ */

// only fetched in the games preview; the invitation itself never loads it
const GamesLayer = dynamic(() => import('./games/GamesLayer'), { ssr: false });

const CHAPTERS = [
  { id: 'door', title: 'الباب' },
  { id: 'names', title: 'الأسماء' },
  { id: 'countdown', title: 'العدّ التنازلي' },
  { id: 'couple', title: 'العروسان' },
  { id: 'rsvp', title: 'تأكيد الحضور' },
  { id: 'sky', title: 'الختام' },
];
const indexOfHash = () => Math.max(0, CHAPTERS.findIndex(c => `#${c.id}` === window.location.hash));
const indexOfId = id => CHAPTERS.findIndex(c => c.id === id);
const toArabic = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const param = name => new URLSearchParams(window.location.search).get(name);

/* ---------- drawn icons (no emoji) ---------- */
const Chevron = ({ to }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d={to === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const PinIcon = () => (
  <svg className="cine-icon" viewBox="0 0 32 40" width="24" height="30" aria-hidden="true">
    <defs>
      <radialGradient id="pinBody" cx="35%" cy="28%" r="80%"><stop offset="0" stopColor="#3d5cab" /><stop offset=".55" stopColor="#17264f" /><stop offset="1" stopColor="#0a1230" /></radialGradient>
      <linearGradient id="pinRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4d6" /><stop offset=".5" stopColor="#c99a4b" /><stop offset="1" stopColor="#7c5622" /></linearGradient>
      <radialGradient id="pinJewel" cx="38%" cy="32%" r="70%"><stop offset="0" stopColor="#fff8e6" /><stop offset=".5" stopColor="#e3c27e" /><stop offset="1" stopColor="#9a6c2c" /></radialGradient>
    </defs>
    <ellipse cx="16" cy="37.6" rx="6.5" ry="1.8" fill="rgba(60,35,5,.35)" />
    <path d="M16 1.5C8.3 1.5 3 7.3 3 14.6 3 23.8 16 36.5 16 36.5S29 23.8 29 14.6C29 7.3 23.7 1.5 16 1.5z" fill="url(#pinBody)" stroke="url(#pinRim)" strokeWidth="1.7" />
    <circle cx="16" cy="14.6" r="5.4" fill="url(#pinJewel)" stroke="#7c5622" strokeWidth=".6" />
    <ellipse cx="11" cy="8.4" rx="3.6" ry="2" fill="rgba(255,255,255,.32)" transform="rotate(-32 11 8.4)" />
  </svg>
);
const KeyIcon = () => (
  <svg className="cine-icon" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="#13204a" strokeWidth="3.2"><circle cx="20" cy="12" r="6" /><path d="M20 18v16M20 27h5.5M20 31.5h4" /></g>
      <g stroke="rgba(255,248,230,.55)" strokeWidth="1" transform="translate(-.7 -.9)"><path d="M15.2 9.6a6 6 0 0 1 6.6-3.2" /><path d="M20 19v13" /></g>
    </g>
  </svg>
);
const HeartIcon = () => (
  <svg className="cine-icon" viewBox="0 0 24 22" width="20" height="18" aria-hidden="true">
    <defs><radialGradient id="heartGem" cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#ffe7ec" /><stop offset=".5" stopColor="#e9a9b8" /><stop offset="1" stopColor="#a65468" /></radialGradient></defs>
    <path d="M12 20.5S2 14.2 2 7.6C2 4.5 4.4 2 7.3 2c2 0 3.7 1.1 4.7 2.8C13 3.1 14.7 2 16.7 2 19.6 2 22 4.5 22 7.6c0 6.6-10 12.9-10 12.9z" fill="url(#heartGem)" stroke="#7c5622" strokeWidth=".8" />
    <ellipse cx="7.6" cy="6.6" rx="2.4" ry="1.4" fill="rgba(255,255,255,.45)" transform="rotate(-30 7.6 6.6)" />
  </svg>
);
const ReplayIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="#13204a" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M6.5 2.8 6.9 7.4 11.4 6.8" fill="none" stroke="#13204a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ---------- countdown on the venue's clock; the finale fires once ---------- */
const TARGET = weddingInstant();
const pad = n => String(n).padStart(2, '0');

function useCountdown() {
  const [left, setLeft] = useState(null);
  const fired = useRef(false);
  useEffect(() => {
    const tick = () => {
      const d = Math.max(0, TARGET - Date.now());
      setLeft({
        days: Math.floor(d / 86400000), hours: pad(Math.floor(d % 86400000 / 3600000)),
        minutes: pad(Math.floor(d % 3600000 / 60000)), seconds: pad(Math.floor(d % 60000 / 1000)), arrived: d === 0,
      });
      if (d === 0 && !fired.current) {
        fired.current = true;
        let seen = false;
        try { seen = sessionStorage.getItem('wedding-finale') === '1'; sessionStorage.setItem('wedding-finale', '1'); } catch { /* private mode */ }
        if (!seen) window.dispatchEvent(new CustomEvent('wedding:celebrate'));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

/* ---------- RSVP at the arch ---------- */
// a v4 UUID that also works outside secure contexts (crypto.randomUUID needs HTTPS)
function submissionId() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function RsvpForm() {
  const [name, setName] = useState('');
  const [count, setCount] = useState(1);
  const [state, setState] = useState('idle');        // idle | sending | done | error
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const id = useRef(null);                             // kept across retries: the server ignores repeats
  const nameIn = useRef(null);

  const submit = async e => {
    e.preventDefault();
    if (state === 'sending') return;
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean) { setError('من فضلك اكتب الاسم الكريم'); setState('error'); nameIn.current?.focus(); return; }
    id.current ||= submissionId();
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id.current },
        body: JSON.stringify({ name: clean, count, id: id.current }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaved(clean);
      setState('done');
      nameIn.current?.blur();
      // the confirmation is on screen first; the sky celebrates after
      setTimeout(() => window.dispatchEvent(new CustomEvent('wedding:celebrate')), 350);
    } catch {
      setError('تعذّر حفظ التأكيد — تأكّد من الاتصال وحاول مرة أخرى');
      setState('error');
    }
  };

  const another = () => { id.current = null; setName(''); setCount(1); setSaved(''); setState('idle'); };
  const scrollIntoView = e => { const el = e.currentTarget; setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320); };

  if (state === 'done') {
    return (
      <div className="cine-rsvp-done" role="status">
        <HeartIcon />
        <p className="cine-done-title">تم تأكيد حضورك يا {saved}</p>
        <p className="cine-done-sub">بانتظاركم بفارغ الصبر 💛</p>
        <button type="button" className="cine-link" onClick={another}>تأكيد حضور ضيف آخر</button>
      </div>
    );
  }
  return (
    <form className="cine-form" onSubmit={submit} noValidate data-no-swipe>
      <label className="cine-field">
        <span>الاسم الكريم</span>
        <input
          ref={nameIn} type="text" name="name" value={name} maxLength={80} autoComplete="name" enterKeyHint="send"
          onChange={e => { setName(e.target.value); if (state === 'error') setState('idle'); }}
          onFocus={scrollIntoView}
          aria-invalid={state === 'error' && !name.trim() ? 'true' : undefined} aria-describedby="rsvp-msg"
        />
      </label>
      <div className="cine-field">
        <span id="rsvp-count-label">عدد الأفراد</span>
        <div className="cine-stepper" role="group" aria-labelledby="rsvp-count-label">
          <button type="button" className="cine-coin" onClick={() => setCount(c => Math.min(50, c + 1))} aria-label="زيادة العدد" disabled={count >= 50}>+</button>
          <output aria-live="polite">{toArabic(count)}</output>
          <button type="button" className="cine-coin" onClick={() => setCount(c => Math.max(1, c - 1))} aria-label="إنقاص العدد" disabled={count <= 1}>−</button>
        </div>
      </div>
      <button type="submit" className="cine-btn cine-submit" disabled={state === 'sending'} aria-busy={state === 'sending'}>
        <span>{state === 'sending' ? 'جارٍ الإرسال…' : 'أؤكّد حضوري'}</span><HeartIcon />
      </button>
      <p id="rsvp-msg" className="cine-msg" role="alert">{state === 'error' ? error : ''}</p>
    </form>
  );
}

/* ---------- the app ---------- */
export default function CinematicApp({ photos = {} }) {
  const root = useRef(null);
  const canvas = useRef(null);
  const scene = useRef(null);
  const busy = useRef(false);
  const namesPlayed = useRef(false);
  const [index, setIndex] = useState(0);         // where we are going (dots, hash)
  const [shown, setShown] = useState(0);         // whose words are on screen — only once the camera has arrived
  const [dir, setDir] = useState(1);
  const [ready, setReady] = useState(false);
  const [capture, setCapture] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [namesPhase, setNamesPhase] = useState('idle');   // idle | show | formed | done
  const [games, setGames] = useState(false);
  const gamesHook = useRef(null);                          // the games layer's say on pointers and keys
  const left = useCountdown();

  /* the page itself never scrolls in this mode; the keyboard shrinks the visual viewport */
  useEffect(() => {
    document.documentElement.classList.add('cine-mode');
    const vv = window.visualViewport;
    const fit = () => root.current?.style.setProperty('--vvh', `${vv ? vv.height : window.innerHeight}px`);
    fit();
    vv?.addEventListener('resize', fit);
    return () => { document.documentElement.classList.remove('cine-mode'); vv?.removeEventListener('resize', fit); };
  }, []);

  const go = useCallback(async target => {
    if (target < 0 || target >= CHAPTERS.length || busy.current) return;
    const from = scene.current ? scene.current.index : index;
    if (target === from) return;
    busy.current = true;
    if (from === 0 && scene.current && !reduced && !namesPlayed.current) {
      namesPlayed.current = true;
      setNamesPhase('show');
      scene.current.namesOnDoor();          // the scene fires them 1.6 s into the door leg
    }
    setDir(target > from ? 1 : -1);
    setIndex(target);
    setShown(-1);
    history.replaceState(null, '', `#${CHAPTERS[target].id}`);
    try {
      await scene.current?.goTo(target);
    } finally {
      busy.current = false;
      setShown(target);
    }
  }, [index, reduced]);

  /* load the world after first paint; until then the chapter's still is on screen */
  useEffect(() => {
    const start = indexOfHash();
    setIndex(start);
    setShown(start);
    const still = param('still') === '1';
    const red = still || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setCapture(still);
    setReduced(red);
    const withGames = !still && param('games') === '1';
    setGames(withGames);
    let disposed = false;
    const load = async () => {
      const [{ createCinematicScene }, { webglAvailable }, progress] = await Promise.all([
        import('@/lib/cinematic/scene'), import('@/lib/cinematic/geometry'), withGames ? import('@/lib/games/progress') : null,
      ]);
      if (disposed || !webglAvailable()) return;
      const s = createCinematicScene(canvas.current, {
        reducedMotion: red,
        start: CHAPTERS[start].id,
        photos,
        games: withGames,
        foundHearts: progress ? progress.foundHearts() : [],
        slowmo: Math.max(1, Number(param('slowmo')) || 1),
        debug: param('debug') === '1',
        onCue: cue => setNamesPhase(cue === 'names-formed' ? 'formed' : cue === 'names-done' ? 'done' : 'show'),
        onContextLost: () => { scene.current = null; setReady(false); },
      });
      scene.current = s;
      await s.ready;
      if (!disposed) setReady(true);
    };
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 120));
    // the stills stay on screen if the world fails; say why in the console
    idle(() => { load().catch(e => console.error('cinematic scene failed:', e)); }, { timeout: 800 });
    const onResize = () => scene.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { disposed = true; scene.current?.dispose(); scene.current = null; window.removeEventListener('resize', onResize); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* the names are written once: as the door opens (go), or on arriving at the lake by a direct link */
  useEffect(() => {
    if (!ready || reduced || CHAPTERS[shown]?.id !== 'names' || namesPlayed.current) return;
    namesPlayed.current = true;
    setNamesPhase('show');
    scene.current?.playNames();
  }, [ready, reduced, shown]);
  const replayNames = () => { setNamesPhase('show'); scene.current?.playNames(); };

  /* keyboard, wheel, hash */
  useEffect(() => {
    const onKey = e => {
      if (gamesHook.current?.blocking() || gamesHook.current?.exploring()) return;
      if (e.target.closest?.('input, textarea, select, button, a')) return;
      if (['ArrowLeft', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(index + 1); }
      if (['ArrowRight', 'PageUp'].includes(e.key)) { e.preventDefault(); go(index - 1); }
    };
    let acc = 0, quietUntil = 0;
    const onWheel = e => {
      if (e.target.closest?.('[data-scroll]')) return;
      if (gamesHook.current?.blocking() || gamesHook.current?.exploring()) { e.preventDefault(); return; }
      e.preventDefault();
      const now = performance.now();
      if (now < quietUntil) return;
      acc += e.deltaY;
      if (Math.abs(acc) > 60) {
        go(index + Math.sign(acc));
        acc = 0;
        quietUntil = now + 900;      // one gesture, one chapter
      }
    };
    const onHash = () => go(indexOfHash());
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('hashchange', onHash);
    };
  }, [go, index]);

  /* swipe (left→right = next), taps on the world, hover cursor */
  const touch = useRef(null);
  const typing = () => document.activeElement?.matches?.('input, textarea');
  const onPointerDown = e => {
    // a game is open, or the guest is exploring the garden: the games layer has the pointer
    if (gamesHook.current?.blocking() || gamesHook.current?.exploring()) { touch.current = null; return; }
    if (typing() || e.target.closest('button, a, input, textarea, select, label, output, [data-no-swipe]')) { touch.current = null; return; }
    touch.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = e => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y, dt = performance.now() - s.t;
    const isTap = Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 500;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { go(index + (dx > 0 ? 1 : -1)); return; }
    if (isTap) {
      if (gamesHook.current?.tap(e.clientX, e.clientY)) return;     // a hidden heart or a game entrance
      if (CHAPTERS[index].id === 'door') { go(1); return; }        // tap the door to enter
      const target = scene.current?.tap(e.clientX, e.clientY);    // the moon, the tree, the arch, the lake, the sky
      if (target) go(indexOfId(target));
    }
  };
  const hover = useRef(0);
  const onPointerMove = e => {
    if (e.pointerType !== 'mouse' || hover.current) return;
    const { clientX: x, clientY: y } = e;
    hover.current = requestAnimationFrame(() => {
      hover.current = 0;
      const here = CHAPTERS[index].id;
      const t = here === 'door' ? 'names' : scene.current?.interact?.(x, y) ? 'game' : scene.current?.pick(x, y);
      if (root.current) root.current.style.cursor = t && t !== here ? 'pointer' : '';
    });
  };

  const c = shown >= 0 ? CHAPTERS[shown].id : null;
  const chapterClass = id => `cine-chapter cine-${id}${c === id ? ' is-active' : ''}`;
  const inactive = id => (c === id ? {} : { inert: true, 'aria-hidden': true });
  const stillId = CHAPTERS[index].id;

  return (
    <div
      className={`cine${ready ? ' is-ready' : ''}${capture ? ' is-capture' : ''}`}
      data-dir={dir > 0 ? 'next' : 'prev'}
      ref={root}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
    >
      {/* the pre-rendered still of the chapter: the first paint, and the whole picture without WebGL */}
      {!capture && (
        <picture className="cine-still" key={stillId} aria-hidden="true">
          <source media="(min-aspect-ratio: 1/1)" srcSet={`/cinematic/stills/${stillId}-l.webp`} />
          <img src={`/cinematic/stills/${stillId}-p.webp`} alt="" fetchPriority={stillId === 'door' ? 'high' : 'auto'} onError={e => { e.currentTarget.style.display = 'none'; }} />
        </picture>
      )}
      <canvas className="cine-canvas" ref={canvas} aria-hidden="true" />

      <section className={chapterClass('door')} {...inactive('door')} aria-label="الباب">
        <div className="cine-hint">
          <button type="button" className="cine-enter" onClick={() => go(1)} aria-label="افتح الباب وادخل"><KeyIcon /></button>
          <p>اضغط على الباب للدخول</p>
        </div>
      </section>

      <section className={chapterClass('names')} {...inactive('names')} aria-label="أحمد وعبير">
        <p className="cine-eyebrow">بسم الله نبدأ حكايتنا</p>
        <h1 className="cine-sr">أحمد ♥ عبير</h1>
        {(namesPhase === 'done' || reduced) && (
          <div className="cine-names-rest">
            {!reduced && <p className="cine-names-caption" aria-hidden="true">أحمد <span>♥</span> عبير</p>}
            {!reduced && (
              <button type="button" className="cine-btn cine-small" onClick={replayNames}><ReplayIcon /><span>شاهد الأسماء مرة أخرى</span></button>
            )}
            <p className="cine-tip">المس القمر أو الشجرة أو القوس لتنتقل إليها</p>
          </div>
        )}
      </section>

      <section className={chapterClass('countdown')} {...inactive('countdown')} aria-label="العدّ التنازلي">
        <h2 className="cine-title">{left?.arrived ? 'لقد حلّ اليوم الموعود' : 'العدّ التنازلي ليوم العمر'}</h2>
        <p className="cine-date">{WEDDING.dateLabelAr}</p>
        <div className="cine-count" role="timer" aria-live="off">
          {[['days', 'يوم'], ['hours', 'ساعة'], ['minutes', 'دقيقة'], ['seconds', 'ثانية']].map(([k, label], i) => (
            <div className="cine-unit" key={k}>
              {i > 0 && <span className="cine-sep" aria-hidden="true">✦</span>}
              <span className="cine-num" key={left ? left[k] : 'x'}>{left ? toArabic(left[k]) : '٠٠'}</span>
              <span className="cine-lbl">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={chapterClass('couple')} {...inactive('couple')} aria-label="العروسان">
        <h2 className="cine-title">العروسان</h2>
        <p className="cine-sr">العريس أحمد ♥ العروس عبير</p>
      </section>

      <section className={chapterClass('rsvp')} {...inactive('rsvp')} aria-label="تأكيد الحضور">
        <div className="cine-rsvp-scroll" data-scroll>
          <h2 className="cine-title">شرّفونا بحضوركم</h2>
          <div className="cine-venue">
            <svg className="cine-flourish" viewBox="0 0 220 24" aria-hidden="true">
              <path d="M4 12 C40 12 60 2 92 10 M216 12 C180 12 160 2 128 10" />
              <path d="M110 4 l6 8 -6 8 -6 -8z" />
            </svg>
            <p className="cine-venue-name">قاعة <bdi>{WEDDING.venue.name}</bdi></p>
            <p className="cine-venue-city">{WEDDING.venue.city} – {WEDDING.venue.country} · {WEDDING.dateLabelAr}</p>
            <a className="cine-btn cine-map" href={WEDDING.venue.mapsUrl} target="_blank" rel="noopener noreferrer">
              <PinIcon /><span>عرض موقع القاعة</span>
            </a>
          </div>
          <RsvpForm />
        </div>
      </section>

      <section className={chapterClass('sky')} {...inactive('sky')} aria-label="الختام">
        <p className="cine-verse">«ومن آياته أن خلق لكم من أنفسكم أزواجًا لتسكنوا إليها وجعل بينكم مودّةً ورحمة»</p>
        <p className="cine-wish">{reduced ? 'بدعوةٍ من عائلتَي العروسين — نتشرّف بحضوركم' : 'المس السماء وأضف نجمتك لليلتنا ✨'}</p>
      </section>

      <nav className="cine-nav" aria-label="فصول الدعوة">
        <button type="button" className="cine-arrow prev" onClick={() => go(index - 1)} disabled={index === 0} aria-label="الفصل السابق"><Chevron to="right" /></button>
        <div className="cine-dots">
          {CHAPTERS.map((ch, i) => (
            <button
              type="button" key={ch.id} className={`cine-dot${i === index ? ' is-active' : ''}`}
              onClick={() => go(i)} aria-label={ch.title} aria-current={i === index ? 'step' : undefined}
            />
          ))}
        </div>
        <button type="button" className="cine-arrow next" onClick={() => go(index + 1)} disabled={index === CHAPTERS.length - 1} aria-label="الفصل التالي"><Chevron to="left" /></button>
      </nav>
      <p className="cine-sr" aria-live="polite">{`${toArabic(index + 1)} من ٦: ${CHAPTERS[index].title}`}</p>
      {games && (
        <GamesLayer
          hook={gamesHook} sceneRef={scene} rootRef={root} chapter={c} index={index} go={go} ready={ready} reduced={reduced}
        />
      )}
    </div>
  );
}
