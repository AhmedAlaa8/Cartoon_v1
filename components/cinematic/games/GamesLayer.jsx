'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { POSTER } from '@/lib/games/poster';
import { finaleSeen, foundHearts, guestName, HEART_IDS, markFinale, nameAsked, saveHeart, saveName } from '@/lib/games/progress';
import { Back, BallIcon, CompassIcon, GiftIcon, HeartGem, QuizIcon, Turn, WishIcon } from './icons';
import './games.css';

/* ================================================================
   Games & surprises — the preview layer over the invitation (?games=1).
   It never changes a chapter on its own and never unmounts the world:
   a game opens over the invitation, the world stops drawing, and «رجوع»
   lands exactly where the guest was. The invitation hands this layer
   the pointer first (hook): taps on hearts and game objects, and the
   drag that turns the view while exploring.
================================================================ */

// one import per game, shared by the lazy component and the warm-up below: two import sites
// would build two copies of the chunk, and the warm-up would fetch the one nobody opens
const LOAD = { quiz: () => import('./Quiz'), wish: () => import('./Wish'), penalty: () => import('./Penalty') };
const Quiz = dynamic(LOAD.quiz, { ssr: false });
const Wish = dynamic(LOAD.wish, { ssr: false });
const Penalty = dynamic(LOAD.penalty, { ssr: false });

const toArabic = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const TOTAL = HEART_IDS.length;
const HINTS = {
  door: 'عند الباب الخشبي',
  aisle: 'بين الزهور على الممرّ',
  lake: 'مع الشموع العائمة على البحيرة',
  tree: 'بين زينة شجرة الثريّا',
  arch: 'في زهور القوس',
};
const GAMES = {
  penalty: { title: 'تحدي العروسة', Icon: BallIcon },
  quiz: { title: 'تحدي العروسين', Icon: QuizIcon },
  wish: { title: 'اكتب أمنيتك', Icon: WishIcon },
};

export default function GamesLayer({ hook, sceneRef, rootRef, chapter, index, go, ready, reduced }) {
  const [view, setView] = useState(null);          // null | name | menu | hearts | quiz | wish | penalty
  const [after, setAfter] = useState('menu');      // where the name step leads
  const [exploring, setExploring] = useState(false);
  const [found, setFound] = useState([]);
  const [toast, setToast] = useState(null);
  const [finale, setFinale] = useState(false);
  const [name, setName] = useState('');
  const viewRef = useRef(view), exploringRef = useRef(exploring), chapterRef = useRef(chapter), toastTimer = useRef(0);
  viewRef.current = view;
  exploringRef.current = exploring;
  chapterRef.current = chapter;

  useEffect(() => { setFound(foundHearts()); setName(guestName()); }, []);

  /* the games' code (and the penalty game's scene) is fetched while the guest looks around once the
     world is up, so opening a game never waits on the network */
  useEffect(() => {
    if (!ready) return undefined;
    const warm = () => [LOAD.penalty(), import('@/lib/games/penalty'), LOAD.quiz(), LOAD.wish()].forEach(p => p.catch(() => {}));
    const idle = typeof window.requestIdleCallback === 'function';
    const id = idle ? window.requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 2000);
    return () => (idle ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, [ready]);

  /* the letter on the door: open when the page loads; × rolls it into a sealed scroll and the
     walnut sign «افتح الرسالة» (hung under it while it is rolled) unrolls it again — neither touches
     the door. «ابدأ المغامرة» starts the adventure: the parchment is pressed in with a few golden
     sparks, the words fade, the scene rolls the letter away, then runs the door exactly as before */
  const [letter, setLetter] = useState(null);       // { state, box } while on the door
  const readLetter = useCallback(() => {
    const s = sceneRef.current, state = s?.letterState;
    setLetter(state && state !== 'gone' ? { state, box: s.letterLayout() } : null);
  }, [sceneRef]);
  useEffect(() => {
    if (!ready || chapter !== 'door') { setLetter(null); return undefined; }
    readLetter();
    window.addEventListener('resize', readLetter);
    return () => window.removeEventListener('resize', readLetter);
  }, [ready, chapter, readLetter]);
  const letterTo = async open => {
    setLetter(l => l && { ...l, state: open ? 'opening' : 'closing' });
    await sceneRef.current?.letterTo(open);
    readLetter();
  };
  // the door's own «tap to enter» hint steps aside while the letter is open
  useEffect(() => { rootRef.current?.classList.toggle('has-poster', !!letter && letter.state !== 'closed'); }, [letter, rootRef]);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const beginAdventure = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    await sceneRef.current?.letterStart?.();
    setLetter(l => l && { ...l, state: 'closing' });       // the words fade while the paper rolls away
    try { await go(1); } finally { startingRef.current = false; setStarting(false); }
  };

  const say = useCallback((title, sub) => {
    clearTimeout(toastTimer.current);
    setToast({ title, sub, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  /* the world stops drawing while anything covers it; the penalty game also hides its canvas */
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    if (view) s.suspend(); else s.resume();
    rootRef.current?.classList.toggle('is-gaming', view === 'penalty');
  }, [view, sceneRef, rootRef]);

  /* exploring: the camera flies to the overlook and the chapter's words step aside; leaving flies
     back to the chapter, and its words return once the camera is home */
  const explore = useCallback(on => {
    setExploring(on);
    if (on) rootRef.current?.classList.add('is-exploring');
    const done = sceneRef.current?.explore(on) || Promise.resolve();
    if (!on) done.then(() => { if (!exploringRef.current) rootRef.current?.classList.remove('is-exploring'); });
    return done;
  }, [sceneRef, rootRef]);
  useEffect(() => { if (exploringRef.current) explore(false); }, [index, explore]);

  /* a game opens — through the optional name step the first time. Opened from the overlook,
     «رجوع» comes back to the overlook: the guest returns to exactly where they were */
  const open = useCallback(target => {
    if (target !== 'hearts' && !nameAsked()) { setAfter(target); setView('name'); return; }
    setView(target);
  }, []);
  const close = useCallback(() => setView(null), []);

  /* all five hearts: back to the lake's open sky where the names were first written, the chapter's
     words step aside, golden shells, the names again — and the message once they have formed */
  const celebrate = useCallback(async () => {
    if (exploringRef.current) await explore(false);
    rootRef.current?.classList.add('is-celebrating');
    if (chapterRef.current !== 'names') await go(1);
    sceneRef.current?.heartsFinale();
    setTimeout(() => setFinale(true), reduced ? 0 : 9000);
  }, [explore, go, reduced, rootRef, sceneRef]);
  const endFinale = useCallback(() => { setFinale(false); rootRef.current?.classList.remove('is-celebrating'); }, [rootRef]);
  // the message thanks the guest, then steps aside by itself
  useEffect(() => {
    if (!finale) return undefined;
    const t = setTimeout(endFinale, 14000);
    return () => clearTimeout(t);
  }, [finale, endFinale]);

  const heart = useCallback(id => {
    if (!sceneRef.current?.collectHeart(id)) return;
    const list = saveHeart(id);
    setFound(list);
    say('اكتشفت قلبًا جديدًا', `جمعت ${toArabic(list.length)} من ${toArabic(TOTAL)} قلوب`);
    if (list.length === TOTAL && !finaleSeen()) {
      markFinale();
      setTimeout(celebrate, 1200);
    }
  }, [sceneRef, say, celebrate]);

  /* the invitation asks us first about every pointer and key */
  useEffect(() => {
    hook.current = {
      blocking: () => viewRef.current !== null,
      exploring: () => exploringRef.current,
      tap(x, y) {
        const hit = sceneRef.current?.interact(x, y);
        if (!hit) return false;
        if (hit.kind === 'heart') heart(hit.id);
        else open(hit.id);
        return true;
      },
    };
    return () => { hook.current = null; };
  }, [hook, sceneRef, heart, open]);

  /* exploring: one finger looks around (the world follows the finger), two fingers pinch to zoom,
     the wheel zooms, a light tap touches what glows */
  useEffect(() => {
    const el = rootRef.current;
    if (!exploring || !el) return undefined;
    const K = 0.004;                                  // rad per px at full view: ~4 screen-widths a full turn
    const pts = new Map();
    let pinch = 0, tap = null;
    const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const down = e => {
      if (viewRef.current || e.target.closest('button, a')) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) tap = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      if (pts.size === 2) { pinch = spread(); tap = null; }
    };
    const move = e => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size >= 2) { const d = spread(); if (pinch > 0) sceneRef.current?.zoomBy(d / pinch); pinch = d; return; }
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap.moved = true;
      sceneRef.current?.lookBy(-dx * K, dy * K);
    };
    const up = e => {
      if (!pts.delete(e.pointerId)) return;
      if (pts.size < 2) pinch = 0;
      if (tap && !tap.moved && pts.size === 0 && performance.now() - tap.t < 500) {
        const hit = sceneRef.current?.interact(e.clientX, e.clientY);
        if (hit?.kind === 'heart') heart(hit.id); else if (hit) open(hit.id);
      }
      if (pts.size === 0) tap = null;
    };
    const wheel = e => { e.preventDefault(); sceneRef.current?.zoomBy(Math.exp(-e.deltaY * 0.0015)); };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [exploring, rootRef, sceneRef, heart, open]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') {
        if (viewRef.current) { e.preventDefault(); setView(null); } else if (exploringRef.current) { e.preventDefault(); explore(false); }
        return;
      }
      if (exploringRef.current && !viewRef.current) {
        const s = sceneRef.current;
        const act = { ArrowLeft: () => s?.lookBy(-0.3), ArrowRight: () => s?.lookBy(0.3), ArrowUp: () => s?.lookBy(0, 0.15), ArrowDown: () => s?.lookBy(0, -0.15), '+': () => s?.zoomBy(1.4), '=': () => s?.zoomBy(1.4), '-': () => s?.zoomBy(1 / 1.4) }[e.key];
        if (act) { e.preventDefault(); act(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [explore, sceneRef]);

  /* the turn arrows: a tap turns a step, a press keeps turning */
  const hold = useRef(0);
  const press = dir => {
    sceneRef.current?.turn(dir * 0.32);
    clearInterval(hold.current);
    hold.current = setInterval(() => sceneRef.current?.turn(dir * 0.1), 140);
  };
  const release = () => clearInterval(hold.current);
  useEffect(() => () => { clearInterval(hold.current); clearTimeout(toastTimer.current); }, []);

  const inGarden = ready && chapter && chapter !== 'door';
  const greet = name ? `أهلًا يا ${name}` : '';

  return (
    <>
      {letter?.box && !view && (letter.state === 'closed'
        ? (
          // the sign itself is drawn in the scene; this is its tap area, a finger's size at least,
          // a little wider than the board so its sway and the camera's breath stay inside it
          <button type="button" className="gm-sign-hit" style={atLeast(letter.box.sign, 48, 24)} onClick={() => letterTo(true)} data-no-swipe>
            <span className="cine-sr">{POSTER.reopen}</span>
          </button>
        )
        : <Letter box={letter.box} shown={letter.state === 'open'} pressed={starting} onClose={() => letterTo(false)} onStart={beginAdventure} />)}

      {/* the two ways in: the games & surprises, and exploring the garden (inside the garden only — the door stays clean) */}
      {inGarden && !view && !exploring && (
        <div className="gm-corner" data-no-swipe>
          <button type="button" className="gm-coin" onClick={() => open('menu')} aria-label="الألعاب والمفاجآت">
            <GiftIcon /><span>الألعاب</span>
            {found.length > 0 && <b className="gm-badge" aria-label={`${found.length} من ${TOTAL} قلوب`}><HeartGem size={11} />{toArabic(found.length)}</b>}
          </button>
          <button type="button" className="gm-coin" onClick={() => explore(true)} aria-label="استكشف الحديقة">
            <CompassIcon /><span>استكشف</span>
          </button>
        </div>
      )}

      {exploring && !view && (
        <div className="gm-explore" data-no-swipe>
          <div className="gm-zoom">
            <button type="button" className="gm-zoom-btn" aria-label="تقريب" onClick={() => sceneRef.current?.zoomBy(1.5)}>+</button>
            <button type="button" className="gm-zoom-btn" aria-label="إبعاد" onClick={() => sceneRef.current?.zoomBy(1 / 1.5)}>−</button>
          </div>
          <p className="gm-explore-tip">اسحب لتنظر حولك، وقرّب بإصبعين أو بزر +، والمس ما يلمع</p>
          <div className="gm-explore-bar">
            <button type="button" className="cine-arrow" aria-label="انظر يسارًا" onPointerDown={() => press(-1)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}><Turn to="left" /></button>
            <button type="button" className="cine-btn cine-small" onClick={() => explore(false)}>العودة للفصل</button>
            <button type="button" className="cine-arrow" aria-label="انظر يمينًا" onPointerDown={() => press(1)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}><Turn to="right" /></button>
          </div>
        </div>
      )}

      {toast && (
        <div className="gm-toast" key={toast.key} role="status">
          <HeartGem size={22} />
          <div><p className="gm-toast-title">{toast.title}</p>{toast.sub && <p className="gm-toast-sub">{toast.sub}</p>}</div>
        </div>
      )}

      {finale && !view && (
        <div className="gm-finale" role="status">
          <p className="gm-finale-names">أحمد <span>♥</span> عبير</p>
          <p className="gm-finale-title">وجدت القلوب الخمسة!</p>
          <p className="gm-finale-sub">{name ? `شكرًا يا ${name}، ` : ''}أسرار الحديقة كلها صارت معك — ودعاؤك يكمل فرحتنا</p>
          <button type="button" className="cine-btn cine-small" onClick={endFinale} data-no-swipe>شكرًا</button>
        </div>
      )}

      {view === 'name' && (
        <NameStep
          initial={name}
          onDone={value => { saveName(value); setName(value); setView(after); }}
          onBack={close}
        />
      )}

      {view === 'menu' && (
        <Dialog label="الألعاب والمفاجآت" onBack={close}>
          <header className="gm-head">
            <h2 className="gm-title">{greet || 'الألعاب والمفاجآت'}</h2>
            <p className="gm-sub">{greet ? 'اختر مغامرتك في حديقة الفرح' : 'مغامرات صغيرة في حديقة الفرح'}</p>
            <button type="button" className="cine-link gm-name-link" onClick={() => { setAfter('menu'); setView('name'); }}>{name ? 'غيّر اسمك' : 'اكتب اسمك'}</button>
          </header>
          <GardenMap found={found.length} onPick={id => open(id)} />
        </Dialog>
      )}

      {view === 'hearts' && (
        <Dialog label="اكتشف أسرار الحديقة" onBack={() => setView('menu')} backLabel="الألعاب">
          <HeartsPanel found={found} onStart={close} onReplay={() => { close(); setTimeout(celebrate, 300); }} />
        </Dialog>
      )}

      {view === 'quiz' && <Dialog label="تحدي العروسين" onBack={close} wide><Quiz name={name} reduced={reduced} onBack={close} /></Dialog>}
      {view === 'wish' && (
        <Dialog label="اكتب أمنيتك" onBack={close}>
          <Wish
            name={name}
            onSent={() => {
              close();
              setTimeout(() => { sceneRef.current?.wishStar(); say('وصلت أمنيتك إلى أحمد وعبير', 'وها هي نجمتك تضيء سماءهما'); }, 450);
            }}
          />
        </Dialog>
      )}
      {view === 'penalty' && <Penalty name={name} tier={sceneRef.current?.tier} reduced={reduced} onBack={close} />}
    </>
  );
}

// a screen rectangle grown about its centre to at least `min` px each way (and `extraW` px wider)
function atLeast({ x, y, w, h }, min, extraW = 0) {
  const W = Math.max(w + extraW, min), H = Math.max(h, min);
  return { left: x - (W - w) / 2, top: y - (H - h) / 2, width: W, height: H };
}

/* ---------- the words on the letter: fitted to the paper, as large as it allows ---------- */
function Letter({ box, shown, pressed, onClose, onStart }) {
  const text = useRef(null);
  const [size, setSize] = useState(12);
  useLayoutEffect(() => {
    const el = text.current;
    if (!el) return;
    let f = Math.max(10, Math.min(15, box.w * 0.085));
    el.style.fontSize = `${f}px`;
    while (el.scrollHeight > el.clientHeight + 1 && f > 9) { f -= 0.25; el.style.fontSize = `${f}px`; }
    setSize(f);
  }, [box.w, box.h]);
  return (
    <div className={`gm-letter${shown ? ' is-shown' : ''}`} style={{ left: box.x, top: box.y, width: box.w, height: box.h }} data-no-swipe role="group" aria-label="رسالة على الباب" data-size={size.toFixed(2)}>
      <button type="button" className="gm-letter-close" onClick={onClose} aria-label={POSTER.close}><span aria-hidden="true">×</span></button>
      <div className="gm-letter-text" ref={text}>
        <h2>{POSTER.title}</h2>
        {POSTER.lines.map(l => <p key={l}>{l}</p>)}
        <p className="gm-letter-strong">{POSTER.closing}</p>
      </div>
      {/* the torn parchment under the words is 3D, in the scene; the words are printed on it here */}
      <button
        type="button"
        className={`gm-letter-start${pressed ? ' is-pressed' : ''}`}
        style={{ ...atLeast({ ...box.start, x: box.start.x - box.x, y: box.start.y - box.y }, 44), fontSize: `${Math.max(13, Math.min(18, box.start.h * 0.38)).toFixed(1)}px` }}
        onClick={onStart}
        disabled={pressed}
      >
        <span>{POSTER.action}</span>
      </button>
    </div>
  );
}

/* ---------- a full-screen layer with a clear way back ---------- */
function Dialog({ label, onBack, backLabel = 'رجوع', wide = false, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className={`gm-dialog${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={label} ref={ref} tabIndex={-1} data-no-swipe data-scroll>
      <button type="button" className="gm-back" onClick={onBack}><Back /><span>{backLabel}</span></button>
      <div className="gm-dialog-body">{children}</div>
    </div>
  );
}

/* ---------- «اكتب اسمك» — optional, never required ---------- */
function NameStep({ initial, onDone, onBack }) {
  const [value, setValue] = useState(initial);
  const submit = e => { e.preventDefault(); onDone(value.replace(/\s+/g, ' ').trim().slice(0, 40)); };
  return (
    <Dialog label="اكتب اسمك" onBack={onBack}>
      <form className="gm-name" onSubmit={submit}>
        <GiftIcon size={54} />
        <h2 className="gm-title">اكتب اسمك</h2>
        <p className="gm-sub">اختياري — لنرحّب بك باسمك في الألعاب</p>
        <label className="cine-field">
          <span className="cine-sr">الاسم</span>
          <input type="text" value={value} onChange={e => setValue(e.target.value)} maxLength={40} autoComplete="given-name" enterKeyHint="go" placeholder="اسمك" />
        </label>
        <button type="submit" className="cine-btn">متابعة</button>
        <button type="button" className="cine-link" onClick={() => onDone(initial || '')}>تخطَّ</button>
      </form>
    </Dialog>
  );
}

/* ---------- the illustrated garden map with its four medallions ---------- */
function GardenMap({ found, onPick }) {
  const spots = [
    { id: 'wish', x: 31, y: 27, ...GAMES.wish },
    { id: 'quiz', x: 22, y: 50, ...GAMES.quiz },
    { id: 'penalty', x: 77, y: 45, ...GAMES.penalty },
  ];
  const ring = 2 * Math.PI * 30;
  return (
    <div className="gm-map">
      <svg className="gm-map-art" viewBox="0 0 360 520" aria-hidden="true">
        <defs>
          <radialGradient id="mapLawn" cx="50%" cy="60%" r="70%"><stop offset="0" stopColor="#1c3326" /><stop offset="1" stopColor="#0c1830" /></radialGradient>
          <linearGradient id="mapLake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a1433" /><stop offset="1" stopColor="#1e2d55" /></linearGradient>
          <radialGradient id="mapGlow"><stop offset="0" stopColor="#ffd68f" stopOpacity=".95" /><stop offset="1" stopColor="#ffb45a" stopOpacity="0" /></radialGradient>
          <linearGradient id="mapGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4d6" /><stop offset=".5" stopColor="#e3c27e" /><stop offset="1" stopColor="#9a6c2c" /></linearGradient>
        </defs>
        <rect x="6" y="6" width="348" height="508" rx="38" fill="url(#mapLawn)" stroke="url(#mapGold)" strokeWidth="3" />
        <rect x="16" y="16" width="328" height="488" rx="30" fill="none" stroke="rgba(227,194,126,.35)" strokeWidth="1" />
        {/* the lake along the top, with floating candles */}
        <path d="M20 40 Q180 10 340 40 L340 150 Q260 132 180 140 Q100 132 20 150 Z" fill="url(#mapLake)" />
        {[[60, 70], [110, 100], [160, 62], [220, 92], [270, 66], [300, 108], [80, 124], [190, 112]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill="url(#mapGlow)" />)}
        {/* the aisle from the door to the arch, its lanterns */}
        <path d="M168 500 L174 168 L186 168 L192 500 Z" fill="#6e604c" opacity=".75" />
        {[200, 250, 300, 350, 400, 450].map(y => <g key={y}><circle cx="160" cy={y} r="5" fill="url(#mapGlow)" /><circle cx="200" cy={y} r="5" fill="url(#mapGlow)" /></g>)}
        {/* the floral arch at the shore */}
        <path d="M150 168 Q180 128 210 168" fill="none" stroke="#2c4426" strokeWidth="9" strokeLinecap="round" />
        {[[152, 162], [160, 148], [172, 140], [188, 140], [200, 148], [208, 162]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.4" fill={i % 2 ? '#f6dfe2' : '#fbeee6'} />)}
        {/* the grand chandelier tree on the left */}
        <g>
          <circle cx="62" cy="214" r="46" fill="#1e3120" /><circle cx="94" cy="196" r="34" fill="#24391f" /><circle cx="44" cy="186" r="30" fill="#2c4426" />
          {[[50, 228], [82, 214], [70, 182], [98, 230], [36, 208]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" fill="url(#mapGlow)" />)}
        </g>
        {/* the football corner on the right */}
        <g stroke="#f4eadd" strokeWidth="2" fill="none" opacity=".85">
          <path d="M262 214 h56 v-22 h-56 z" /><path d="M262 214 l-6 6 h68 l-6 -6" strokeOpacity=".5" />
        </g>
        {/* jasmine bushes */}
        {[[130, 230], [232, 260], [128, 330], [236, 360], [132, 420], [230, 440]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="13" fill="#24391f" />)}
        {/* the wooden door at the bottom */}
        <path d="M160 512 V488 a20 20 0 0 1 40 0 V512" fill="#5a3b25" stroke="url(#mapGold)" strokeWidth="2" />
      </svg>

      {spots.map(({ id, x, y, title, Icon }) => (
        <button type="button" key={id} className="gm-medal" style={{ left: `${x}%`, top: `${y}%` }} onClick={() => onPick(id)}>
          <span className="gm-medal-face"><Icon /></span>
          <span className="gm-ribbon">{title}</span>
        </button>
      ))}
      <button type="button" className="gm-medal is-hearts" style={{ left: '50%', top: '74%' }} onClick={() => onPick('hearts')}>
        <span className="gm-medal-face">
          <svg className="gm-ring" viewBox="0 0 70 70" aria-hidden="true">
            <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(227,194,126,.25)" strokeWidth="4" />
            <circle cx="35" cy="35" r="30" fill="none" stroke="#f1d6a5" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(ring * found) / TOTAL} ${ring}`} transform="rotate(-90 35 35)" />
          </svg>
          <HeartGem size={28} />
        </span>
        <span className="gm-ribbon">اكتشف أسرار الحديقة</span>
        <span className="gm-progress">{`${toArabic(found)} من ${toArabic(TOTAL)} قلوب`}</span>
      </button>
    </div>
  );
}

/* ---------- the hidden hearts: progress, a hint if wanted ---------- */
function HeartsPanel({ found, onStart, onReplay }) {
  const [hint, setHint] = useState(false);
  const all = found.length === TOTAL;
  return (
    <div className="gm-hearts">
      <h2 className="gm-title">اكتشف أسرار الحديقة</h2>
      <ul className="gm-slots" aria-label={`جمعت ${found.length} من ${TOTAL} قلوب`}>
        {HEART_IDS.map(id => {
          const got = found.includes(id);
          return (
            <li key={id} className={got ? 'is-found' : ''}>
              <HeartGem size={34} empty={!got} />
              <span className="cine-sr">{got ? 'وُجد' : 'لم يُكتشف بعد'}</span>
            </li>
          );
        })}
      </ul>
      <p className="gm-count">{all ? 'وجدت القلوب الخمسة!' : `جمعت ${toArabic(found.length)} من ${toArabic(TOTAL)} قلوب`}</p>
      <p className="gm-text">
        {all
          ? 'أسرار الحديقة كلها معك. يمكنك مشاهدة احتفال القلوب مرة أخرى.'
          : 'خمسة قلوب صغيرة متوهّجة مخبّأة في عالم الدعوة. تنقّل بين الفصول أو استكشف الحديقة، والمس أي قلب تجده.'}
      </p>
      {!all && (
        hint
          ? (
            <ul className="gm-hints">
              {HEART_IDS.map(id => <li key={id} className={found.includes(id) ? 'is-found' : ''}>{found.includes(id) ? '✓ ' : ''}{HINTS[id]}</li>)}
            </ul>
          )
          : <button type="button" className="cine-link" onClick={() => setHint(true)}>أريد تلميحًا</button>
      )}
      {all
        ? <button type="button" className="cine-btn" onClick={onReplay}>شاهد الاحتفال مرة أخرى</button>
        : <button type="button" className="cine-btn" onClick={onStart}>ابدأ البحث</button>}
    </div>
  );
}
