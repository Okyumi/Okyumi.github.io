import {execFileSync} from 'node:child_process';

// Keep the date of the first upload stable when a plain Markdown post is edited
// or the rest of the site is rebuilt. Actions checks out the complete history.
export function firstPublishedDate(file, root) {
  try {
    const history = execFileSync('git', [
      'log', '--follow', '--diff-filter=A', '--format=%cs', '--', `content/posts/${file}`
    ], {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
    const first = history.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (first) return first;
  } catch { /* An uncommitted local preview has no publication history yet. */ }
  return new Date().toISOString().slice(0, 10);
}

const slugify = value => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function parsePost(input, file, {dateForFile = () => new Date().toISOString().slice(0, 10)} = {}) {
  const raw = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = raw.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  const filename = file.replace(/\.md$/i, '');
  const datedName = filename.match(/^(\d{4}-\d{2}-\d{2})[-_](.+)$/);
  const stem = datedName ? datedName[2] : filename;
  const p = {file, slug: slugify(stem)};
  let rawBody = match ? match[2] : raw;

  // Existing one-line front matter remains supported, including authored
  // excerpts, covers, quote arrays, and draft visibility.
  if (match) for (const line of match[1].split('\n')) {
    const pair = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (!pair || line.startsWith('#')) continue;
    try { p[pair[1]] = JSON.parse(pair[2]); }
    catch { p[pair[1]] = pair[2]; }
  }

  if (!p.title) {
    const heading = rawBody.match(/^\s*#\s+(.+?)(?:\s+#+)?\s*(?:\n|$)/);
    p.title = heading ? heading[1] : stem.replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
    // The reading template already prints the title above the article.
    if (heading) rawBody = rawBody.slice(heading[0].length);
  }
  p.date = p.date || datedName?.[1] || dateForFile(file);
  const validDate = typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)
    && !Number.isNaN(Date.parse(p.date)) && new Date(p.date).toISOString().slice(0, 10) === p.date;
  if (typeof p.title !== 'string' || !p.title.trim() || !validDate) {
    throw new Error(`Invalid title/date in ${file}. Use a title and a real YYYY-MM-DD date.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) {
    throw new Error(`Invalid post filename: ${file}. Use an English filename such as my-new-essay.md.`);
  }
  return {...p, rawBody};
}
