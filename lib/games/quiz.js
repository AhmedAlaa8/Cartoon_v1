/* «تحدي العروسين» — the questions about Ahmed and Abeer.

   ⚠ NOT APPROVED YET: the questions below are the examples from the brief, and the
   correct answers are deliberately unknown (answer: null) — the bride and groom
   provide or approve them. Until then the quiz records each guest's pick, shows no
   score, and says the couple will reveal the answers.

   To finish it: set each `answer` to 'ahmed' or 'abeer' (or replace the questions),
   then set `approved: true`. Nothing else needs to change. */

export const QUIZ = {
  approved: false,
  questions: [
    { id: 'sleep', q: 'مَن يحبّ النوم أكثر؟', answer: null },
    { id: 'ready', q: 'مَن يتأخّر أكثر في التجهّز للخروج؟', answer: null },
    { id: 'food', q: 'مَن يحبّ الأكل أكثر؟', answer: null },
    { id: 'forget', q: 'مَن ينسى الأشياء أكثر؟', answer: null },
    { id: 'romantic', q: 'مَن الأكثر رومانسية؟', answer: null },
  ],
};

export const CHOICES = [
  { id: 'ahmed', label: 'أحمد' },
  { id: 'abeer', label: 'عبير' },
];

/* the score only counts once every answer is approved; null means "not known yet" */
export function scoreOf(picks, quiz = QUIZ) {
  if (!quiz.approved || quiz.questions.some(q => !q.answer)) return null;
  return quiz.questions.reduce((n, q, i) => n + (picks[i] === q.answer ? 1 : 0), 0);
}

export function verdict(score, total) {
  if (score === total) return 'تعرف العروسين أكثر مما يعرفان نفسيهما!';
  if (score >= total - 1) return 'قلبك قريب جدًا من قلبَي العروسين.';
  if (score >= Math.ceil(total / 2)) return 'ليس سيئًا… تحتاج سهرة واحدة معهما فقط.';
  if (score > 0) return 'يبدو أن أحمد وعبير يخبّئان أسرارًا كثيرة!';
  return 'لا بأس… الحبّ أحيانًا يحتاج دليلًا.';
}
