import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static assets from the Vite build directory
app.use(express.static(path.join(__dirname, 'dist')));

// SPA Catch-all: Route all other requests to index.html
app.get('/*', (req, res) => {
  // Guard against missing static assets
  // If the request path looks like a file (has an extension), return 404 instead of index.html
  if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
    return res.status(404).send('Not Found');
  }
  
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
