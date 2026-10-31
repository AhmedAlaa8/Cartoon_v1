/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // a second build can live beside the running one (NEXT_DIST_DIR=.next-3004 for the server on port 3004)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: { formats: ['image/avif', 'image/webp'] },
  // public/ files are served with max-age=0, so every visit re-asks for each texture and still.
  // The wood never changes under the same name; the stills are regenerated after a scene edit,
  // so a returning guest keeps an old one for an hour at most. Production only: dev stays fresh.
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      { source: '/cinematic/tex/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      { source: '/cinematic/stills/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }] },
    ];
  },
  // the invitation used to be previewed at /cinematic; old links land on the home page
  async redirects() {
    return [{ source: '/cinematic', destination: '/', permanent: false }];
  },
};

export default nextConfig;
