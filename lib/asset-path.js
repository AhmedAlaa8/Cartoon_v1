// Public assets need the repository prefix on GitHub Pages project sites.
export function assetPath(path) {
  return (process.env.NEXT_PUBLIC_BASE_PATH || '') + path;
}
