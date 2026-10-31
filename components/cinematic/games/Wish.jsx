'use client';
import { WishIcon } from './icons';
export default function Wish() {
  return (
    <div className="gm-wish" role="status">
      <WishIcon size={66} />
      <h2 className="gm-title">أمنياتكم تسعدنا</h2>
      <p className="gm-sub">إرسال الأمنيات غير متاح حاليًا. يمكنكم مشاركة أمنياتكم مع أحمد وعبير مباشرةً 💛</p>
    </div>
  );
}
