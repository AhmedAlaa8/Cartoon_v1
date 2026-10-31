'use client';

import { useEffect, useRef, useState } from 'react';
import { Back, BallIcon, Glove, NetBall, Replay, Turn } from './icons';

/* «تحدي العروسة» — the HUD over the penalty scene (lib/games/penalty.js, loaded here on demand).
   Every result is shown with an icon and words, never by colour alone. */

const toArabic = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const SAVE = ['صدّها أحمد!', 'يا لها من قفزة!', 'أحمد حارس من ذهب!', 'ولا كرة تعدّي!'];
const GOAL = ['جوووول! عبير لا تُرحم', 'هدف في الزاوية!', 'عبير تسجّل بابتسامة', 'آسف يا أحمد… هدف!'];
const pick = list => list[(Math.random() * list.length) | 0];
function ending(saves, total) {
  if (saves === total) return 'حارس الفرح الأسطوري — ولا هدف واحد!';
  if (saves >= 3) return 'أحمد صمد… وعبير لن تنسى هذه المباراة';
  if (saves >= 1) return 'عبير هدّافة الفرح بلا منازع';
  return 'عبير سجّلت الخمسة… وسجّلت في القلب قبلها';
}

export default function Penalty({ name, tier, reduced, onBack }) {
  const canvas = useRef(null), game = useRef(null), nextTimer = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState('intro');     // intro | play | end
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState(null);
  const [total, setTotal] = useState(5);

  useEffect(() => {
    let alive = true, g = null;
    import('@/lib/games/penalty').then(({ createPenalty, SHOTS }) => {
      if (!alive) return;
      setTotal(SHOTS);
      g = createPenalty(canvas.current, {
        tier,
        reducedMotion: reduced,
        onEvent: e => {
          if (e.type === 'round') setMsg({ kind: 'hint', text: 'راقب نظرة عبير… واسحب!' });
          if (e.type === 'result') { setResults(r => [...r, e.saved]); setMsg({ kind: e.saved ? 'save' : 'goal', text: pick(e.saved ? SAVE : GOAL) }); }
          if (e.type === 'next') nextTimer.current = setTimeout(() => g?.next(), 500);
          if (e.type === 'end') { setMsg(null); setPhase('end'); }
        },
      });
      game.current = g;
      // «ابدأ التحدي» once the scene's shaders are compiled, so the first kick never stutters
      g.ready.then(() => { if (alive) setLoaded(true); });
    });
    return () => { alive = false; clearTimeout(nextTimer.current); g?.dispose(); game.current = null; };
  }, [reduced, tier]);

  const start = () => { setResults([]); setMsg(null); setPhase('play'); game.current?.start(); };
  const saves = results.filter(Boolean).length;
  const dive = dir => game.current?.input(dir);

  return (
    <div className="pk" role="dialog" aria-modal="true" aria-label="تحدي العروسة" data-no-swipe>
      <canvas className="pk-canvas" ref={canvas} aria-hidden="true" />
      <div className="pk-top">
        <button type="button" className="gm-back" onClick={onBack}><Back /><span>رجوع</span></button>
        <div className="pk-score" aria-label={`${results.length} من ${total} ركلات: صدّ ${saves}، أهداف ${results.length - saves}`}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`pk-pip${i < results.length ? (results[i] ? ' is-save' : ' is-goal') : ''}`}>
              {i < results.length ? (results[i] ? <Glove size={18} /> : <NetBall size={18} />) : null}
            </span>
          ))}
        </div>
      </div>

      {msg && phase === 'play' && <p className={`pk-msg is-${msg.kind}`} key={`${results.length}-${msg.kind}`} role="status">{msg.text}</p>}

      {phase === 'play' && (
        <div className="pk-controls">
          <p className="pk-tip">اسحب يسارًا أو يمينًا أو لأعلى ليرتمي أحمد</p>
          <div className="pk-pad">
            <button type="button" className="cine-arrow" aria-label="ارتمِ يسارًا" onClick={() => dive('left')}><Turn to="left" /></button>
            <button type="button" className="cine-arrow pk-up" aria-label="اقفز في المنتصف" onClick={() => dive('up')}><Turn to="left" /></button>
            <button type="button" className="cine-arrow" aria-label="ارتمِ يمينًا" onClick={() => dive('right')}><Turn to="right" /></button>
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className="pk-card">
          <BallIcon size={58} />
          <h2 className="gm-title">تحدي العروسة</h2>
          <p className="gm-sub">{name ? `أهلًا يا ${name}، جاهز لتحدي العروسة؟` : 'جاهز لتحدي العروسة؟'}</p>
          <p className="pk-rules">عبير تسدّد خمس ركلات، وأنت أحمد في المرمى. اسحب يسارًا أو يمينًا أو لأعلى في اللحظة المناسبة لتصدّ الكرة. نصيحة: انظر إلى أين تلتفت عبير!</p>
          <button type="button" className="cine-btn" onClick={start} disabled={!loaded}>{loaded ? 'ابدأ التحدي' : 'جارٍ التحضير…'}</button>
        </div>
      )}

      {phase === 'end' && (
        <div className="pk-card" role="status">
          <p className="pk-final"><Glove size={30} /> {name ? `يا ${name}، ` : ''}أنقذ أحمد <b>{toArabic(saves)}</b> من {toArabic(total)}</p>
          <h2 className="gm-title">{ending(saves, total)}</h2>
          <div className="gm-actions">
            <button type="button" className="cine-btn cine-small" onClick={start}><Replay /><span>العب مرة أخرى</span></button>
            <button type="button" className="cine-link" onClick={onBack}>العودة للدعوة</button>
          </div>
        </div>
      )}
    </div>
  );
}
