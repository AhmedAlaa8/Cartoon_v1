/* Drawn icons for the games (no emoji): gold, navy enamel and blush, like the rest of the world. */

const Gold = () => (
  <defs>
    <linearGradient id="gmGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4d6" /><stop offset=".5" stopColor="#e3c27e" /><stop offset="1" stopColor="#9a6c2c" /></linearGradient>
    <radialGradient id="gmBlush" cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#ffe7ec" /><stop offset=".5" stopColor="#e9a9b8" /><stop offset="1" stopColor="#a65468" /></radialGradient>
    <radialGradient id="gmRuby" cx="35%" cy="28%" r="85%"><stop offset="0" stopColor="#ff8a9c" /><stop offset=".35" stopColor="#d81d3f" /><stop offset=".75" stopColor="#8e0a24" /><stop offset="1" stopColor="#4f0413" /></radialGradient>
    <radialGradient id="gmNavy" cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#3d5cab" /><stop offset=".6" stopColor="#17264f" /><stop offset="1" stopColor="#0a1230" /></radialGradient>
  </defs>
);

export const HeartGem = ({ size = 22, empty = false }) => (
  <svg viewBox="0 0 24 22" width={size} height={size * 0.92} aria-hidden="true" className="gm-icon">
    <Gold />
    <path d="M12 20.5S2 14.2 2 7.6C2 4.5 4.4 2 7.3 2c2 0 3.7 1.1 4.7 2.8C13 3.1 14.7 2 16.7 2 19.6 2 22 4.5 22 7.6c0 6.6-10 12.9-10 12.9z"
      fill={empty ? 'rgba(10,18,48,.55)' : 'url(#gmRuby)'} stroke="url(#gmGold)" strokeWidth={empty ? 1.4 : 1} strokeDasharray={empty ? '2.2 2' : undefined} />
    {!empty && <ellipse cx="7.6" cy="6.6" rx="2.4" ry="1.4" fill="rgba(255,255,255,.6)" transform="rotate(-30 7.6 6.6)" />}
  </svg>
);

export const BallIcon = ({ size = 34 }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="gm-icon">
    <Gold />
    <circle cx="20" cy="20" r="16" fill="#fbf6ec" stroke="url(#gmGold)" strokeWidth="2" />
    <path d="M20 12.5l6.4 4.6-2.4 7.5h-8l-2.4-7.5z" fill="#16244f" />
    <path d="M20 12.5V5M26.4 17.1l7-2.4M24 24.6l4.5 6.2M16 24.6l-4.5 6.2M13.6 17.1l-7-2.4" stroke="#16244f" strokeWidth="1.6" strokeLinecap="round" />
    <ellipse cx="14" cy="11" rx="4" ry="2.2" fill="rgba(255,255,255,.7)" transform="rotate(-35 14 11)" />
  </svg>
);

// two medallion faces leaning together, a question mark between
export const QuizIcon = ({ size = 34 }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="gm-icon">
    <Gold />
    <circle cx="13" cy="21" r="9" fill="url(#gmNavy)" stroke="url(#gmGold)" strokeWidth="2" />
    <circle cx="27" cy="21" r="9" fill="url(#gmNavy)" stroke="url(#gmGold)" strokeWidth="2" />
    <path d="M17.2 9.5a3 3 0 1 1 4.3 2.7c-1 .5-1.5 1.2-1.5 2.3" fill="none" stroke="url(#gmGold)" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="20" cy="17.6" r="1.3" fill="#f1d6a5" />
    <path d="M20 33.5s-4-2.5-4-5.1c0-1.3 1-2.3 2.1-2.3.8 0 1.5.4 1.9 1.1.4-.7 1.1-1.1 1.9-1.1 1.2 0 2.1 1 2.1 2.3 0 2.6-4 5.1-4 5.1z" fill="url(#gmBlush)" />
  </svg>
);

// a sky lantern rising from an open book
export const WishIcon = ({ size = 34 }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="gm-icon">
    <Gold />
    <path d="M14 6h12l-2 12h-8z" fill="#ffd08a" stroke="url(#gmGold)" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="20" cy="15" r="2" fill="#fff4d6" />
    <path d="M5 30c5-3 10-3 15 0 5-3 10-3 15 0v4c-5-3-10-3-15 0-5-3-10-3-15 0z" fill="#fffaf0" stroke="url(#gmGold)" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M20 30v4" stroke="#c99a4b" strokeWidth="1.2" />
    <path d="M20 21v5M17.5 23.5l-1 2M22.5 23.5l1 2" stroke="#f1d6a5" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const CompassIcon = ({ size = 26 }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="gm-icon">
    <Gold />
    <circle cx="16" cy="16" r="12" fill="none" stroke="url(#gmGold)" strokeWidth="1.8" />
    <path d="M16 6.5l3 9.5-3 9.5-3-9.5z" fill="url(#gmGold)" />
    <path d="M16 6.5l3 9.5h-6z" fill="#fff4d6" />
    <path d="M6 16h3M23 16h3" stroke="url(#gmGold)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// a gift with a star above: the games & surprises
export const GiftIcon = ({ size = 26 }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="gm-icon">
    <Gold />
    <rect x="6" y="14" width="20" height="13" rx="2" fill="url(#gmNavy)" stroke="url(#gmGold)" strokeWidth="1.6" />
    <rect x="5" y="11" width="22" height="5" rx="1.6" fill="url(#gmGold)" />
    <path d="M16 11v16" stroke="#f1d6a5" strokeWidth="2.4" />
    <path d="M16 11c-2-4-7-5-7-2s5 2 7 2zM16 11c2-4 7-5 7-2s-5 2-7 2z" fill="url(#gmBlush)" stroke="#7c5622" strokeWidth=".6" />
    <path d="M24.5 2.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#fff4d6" />
  </svg>
);

export const Back = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Turn = ({ to }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d={to === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Replay = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="#13204a" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M6.5 2.8 6.9 7.4 11.4 6.8" fill="none" stroke="#13204a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// a goalkeeper's glove — a save
export const Glove = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="gm-icon">
    <Gold />
    <path d="M7 21v-3L4.5 12.5c-.6-1.2.9-2.2 1.8-1.2L8 13V5.5a1.4 1.4 0 0 1 2.8 0V11V4.2a1.4 1.4 0 0 1 2.8 0V11V5a1.4 1.4 0 0 1 2.8 0v6.5-4.3a1.4 1.4 0 0 1 2.8 0V15c0 3-1.8 4.6-3.2 6z" fill="#fffaf0" stroke="url(#gmGold)" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M7 18h9.2" stroke="#c99a4b" strokeWidth="1.4" />
  </svg>
);
// a ball in the net — a goal
export const NetBall = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="gm-icon">
    <path d="M3 21V4h18v17" fill="none" stroke="#f4eadd" strokeWidth="1.6" />
    <path d="M3 9h18M3 14h18M8 4v17M13 4v17M18 4v17" stroke="rgba(244,234,221,.35)" strokeWidth=".8" />
    <circle cx="14" cy="15" r="4.2" fill="#fbf6ec" stroke="#e9b5c1" strokeWidth="1.2" />
    <path d="M14 13l1.6 1.2-.6 1.9h-2l-.6-1.9z" fill="#16244f" />
  </svg>
);
