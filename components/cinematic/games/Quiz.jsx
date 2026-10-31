'use client';

import { useEffect, useRef, useState } from 'react';
import { CHOICES, QUIZ, scoreOf, verdict } from '@/lib/games/quiz';
import { HeartGem, QuizIcon, Replay } from './icons';

/* «تحدي العروسين» — five questions, two medallions (the groom on the right, as on the tree).
   Until the couple approve the answers (lib/games/quiz.js) it records the guest's picks
   on screen only and shows no score. */

const toArabic = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const PRAISE = ['إجابة صحيحة!', 'تمامًا!', 'أنت تعرفهما جيدًا!'];
const TEASE = ['لا… ليس هذه المرة!', 'قريب… لكن لا!', 'العروسان يضحكان الآن!'];
const pick = list => list[(Math.random() * list.length) | 0];

export default function Quiz({ name, reduced, onBack }) {
  const [step, setStep] = useState(-1);          // -1 intro, 0..n-1 questions, n the end
  const [picks, setPicks] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [line, setLine] = useState('');
  const [faces, setFaces] = useState({});
  const timer = useRef(0);
  const total = QUIZ.questions.length;
  const approved = QUIZ.approved && QUIZ.questions.every(q => q.answer);

  // the same cartoon portraits as the medallions on the tree
  useEffect(() => {
    let alive = true;
    import('@/lib/cinematic/shapes').then(({ groomPortrait, bridePortrait }) => {
      if (!alive) return;
      setFaces({ ahmed: groomPortrait(320).toDataURL('image/webp', 0.9), abeer: bridePortrait(320).toDataURL('image/webp', 0.9) });
    });
    return () => { alive = false; clearTimeout(timer.current); };
  }, []);

  const answer = id => {
    if (chosen) return;
    const q = QUIZ.questions[step];
    setChosen(id);
    setLine(!approved ? 'سجّلنا اختيارك!' : id === q.answer ? pick(PRAISE) : `${pick(TEASE)} الإجابة: ${CHOICES.find(c => c.id === q.answer).label}`);
    timer.current = setTimeout(() => {
      setPicks(p => [...p, id]);
      setChosen(null);
      setLine('');
      setStep(s => s + 1);
    }, reduced ? 900 : 1700);
  };
  const again = () => { setPicks([]); setChosen(null); setLine(''); setStep(0); };

  if (step < 0) {
    return (
      <div className="qz qz-intro">
        <QuizIcon size={64} />
        <h2 className="gm-title">تحدي العروسين</h2>
        <p className="gm-sub">{name ? `أهلًا يا ${name}، ` : ''}كم تعرف أحمد وعبير؟ خمسة أسئلة خفيفة… اختر بقلبك!</p>
        <button type="button" className="cine-btn" onClick={() => setStep(0)}>ابدأ التحدي</button>
      </div>
    );
  }

  if (step >= total) {
    const score = scoreOf(picks);
    return (
      <div className="qz qz-end" role="status">
        <div className="qz-hearts" aria-hidden="true">{[0, 1, 2].map(i => <HeartGem key={i} size={30} />)}</div>
        {score === null ? (
          <>
            <h2 className="gm-title">{name ? `شكرًا يا ${name}!` : 'شكرًا لك!'}</h2>
            <p className="gm-sub">أجبت عن الأسئلة الخمسة. الإجابات الصحيحة يكشفها أحمد وعبير قريبًا… استعدّ للمفاجأة!</p>
          </>
        ) : (
          <>
            <p className="qz-score"><span>{toArabic(score)}</span> من {toArabic(total)}</p>
            <h2 className="gm-title">{name ? `${name}، ` : ''}{verdict(score, total)}</h2>
          </>
        )}
        <div className="gm-actions">
          <button type="button" className="cine-btn cine-small" onClick={again}><Replay /><span>العب مرة أخرى</span></button>
          <button type="button" className="cine-link" onClick={onBack}>العودة للدعوة</button>
        </div>
      </div>
    );
  }

  const q = QUIZ.questions[step];
  return (
    <div className="qz">
      <p className="qz-step" aria-live="polite">السؤال {toArabic(step + 1)} من {toArabic(total)}</p>
      <div className="qz-dots" aria-hidden="true">{QUIZ.questions.map((x, i) => <i key={x.id} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} />)}</div>
      <h2 className="qz-q" key={q.id}>{q.q}</h2>
      <div className="qz-choices">
        {CHOICES.map(c => {
          const state = chosen === c.id ? (approved ? (c.id === q.answer ? ' is-right' : ' is-wrong') : ' is-picked') : chosen ? ' is-other' : '';
          return (
            <button type="button" key={c.id} className={`qz-choice${state}`} onClick={() => answer(c.id)} disabled={!!chosen} aria-pressed={chosen === c.id}>
              <span className="qz-face">{faces[c.id] ? <img src={faces[c.id]} alt="" /> : null}</span>
              <span className="qz-name">{c.label}</span>
              {chosen === c.id && !reduced && <span className="qz-burst" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <HeartGem key={i} size={16} />)}</span>}
            </button>
          );
        })}
      </div>
      <p className="qz-line" role="status">{line}</p>
    </div>
  );
}
