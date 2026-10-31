import fs from 'node:fs';
import path from 'node:path';
import CinematicApp from '@/components/cinematic/CinematicApp';
import './cinematic.css';

/* The invitation: one 3D world in six chapters (components/cinematic). */

function findPhoto(name) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const file = `${name}.${ext}`;
    if (fs.existsSync(path.join(process.cwd(), 'public', 'assets', file))) return `/assets/${file}`;
  }
  return null;
}

export default function CinematicPage() {
  return <CinematicApp photos={{ groom: findPhoto('groom'), bride: findPhoto('bride') }} />;
}
