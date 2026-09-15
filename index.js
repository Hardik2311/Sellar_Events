import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static assets from the Vite build directory. Filenames are
// content-hashed by Vite, so once a hash is served its contents never
// change — safe to cache for a year. This middleware also auto-serves
// dist/index.html for directory-style requests (e.g. "/"), so index.html
// is special-cased back to no-cache in setHeaders — it must always
// revalidate, or a visitor can get stuck on a copy referencing JS chunks
// a later deploy has already deleted.
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    if (path.basename(filePath) === 'index.html') {
      res.set('Cache-Control', 'no-cache');
    }
  },
}));

// SPA Catch-all: Route all other requests to index.html
app.get('/*splat', (req, res) => {
  // Guard against missing static assets
  // If the request path looks like a file (has an extension), return 404 instead of index.html
  if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
    return res.status(404).send('Not Found');
  }

  // Always revalidate the HTML shell so a new deploy's asset hashes are
  // picked up immediately — a stale cached copy here would reference JS
  // chunks that no longer exist post-deploy and 404 on load.
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
