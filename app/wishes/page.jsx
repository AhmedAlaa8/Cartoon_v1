import WishesReader from './WishesReader';
import './wishes.css';

/* The couple's private page for reading the wishes. The page itself holds nothing:
   the wishes are fetched only with the key (WISHES_KEY on the server). */

export const metadata = {
  title: 'أمنيات الضيوف — خاص',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function WishesPage() {
  return <WishesReader />;
}
