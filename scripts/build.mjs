import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from './vendor/marked.mjs';
import {readingList, bookCategories} from './reading-list.mjs';
import {writeEntrance} from './entrance.mjs';
import {arrow, hand, toPNG, toSVG} from './pixel-art.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs');
const read = async p => fs.readFile(path.join(root, p), 'utf8');
const site = JSON.parse(await read('content/site.json'));
const papers = JSON.parse(await read('content/papers.json'));
const bookYears = readingList(JSON.parse(await read('content/books.json')));

/* Posts. */
const parsePost = (raw, file) => {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`Missing metadata in ${file}`);
  const p = {file, slug: file.replace(/\.md$/, '')};
  for (const line of match[1].split('\n')) {
    const pair = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (!pair || line.startsWith('#')) continue;
    try { p[pair[1]] = JSON.parse(pair[2]); }
    catch { p[pair[1]] = pair[2]; }
  }
  if (!p.title || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || Number.isNaN(new Date(p.date).getTime())) {
    throw new Error(`Invalid title/date in ${file}`);
  }
  return {...p, rawBody: match[2]};
};
const meta = [];
for (const file of await fs.readdir(path.join(root, 'content/posts'))) {
  if (file.endsWith('.md')) meta.push(parsePost(await read('content/posts/' + file), file));
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const text = s => s.replace(/<[^>]*>/g, ' ').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
const date = (d, opts) => new Intl.DateTimeFormat('en-US', {timeZone: 'UTC', ...opts}).format(new Date(d + 'T12:00:00Z'));
const href = p => `blog/${p.slug}/`;
const cleanBody = md => {
  const match = md.match(/^\*\*\d{4}-\d{2}-\d{2}\*\*[^\n]*\n\s*---\s*\n([\s\S]*)/m);
  let body = match ? match[1] : md;
  body = body.split(/\n---\s*\n\s*<p align="center">/)[0];
  return body.trim();
};
// Links that leave the site open in a new tab.
const externalLinks = html => html.replace(/<a\s+([^>]*href="https?:\/\/[^>]+)>/g, (tag, attrs) =>
  /\btarget=/.test(attrs) ? tag : `<a ${attrs} target="_blank" rel="noopener noreferrer">`);
const posts = [];
for (const p of meta) {
  if (p.featured === false) continue;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) throw new Error('Invalid post slug: ' + p.slug);
  const body = cleanBody(p.rawBody);
  let html = marked.parse(body, {gfm: true, breaks: false});
  html = html.replace(/href="([^"/]+)\.md(?:#[^"]*)?"/g, (_, slug) => `href="../${esc(slug)}/"`);
  const words = text(body).split(/\s+/).length;
  posts.push({...p, body, html: externalLinks(html), readingTime: Math.max(1, Math.ceil(words / 220)), excerpt: p.excerpt || ''});
}
posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

/* Output folder: public/ is copied as is, then every page is written. */
await fs.rm(out, {recursive: true, force: true});
await fs.mkdir(out, {recursive: true});
await fs.cp(path.join(root, 'public'), out, {recursive: true});
const write = async (p, s) => {
  const dest = path.join(out, p);
  await fs.mkdir(path.dirname(dest), {recursive: true});
  await fs.writeFile(dest, s);
};
// Pixel art (scripts/pixel-art.mjs): the game-screen cursor and the menu pointer.
await write('assets/cursor.png', toPNG(arrow, 2));
await write('assets/cursor@2x.png', toPNG(arrow, 4));
await write('assets/pixel-hand.svg', toSVG(hand));
const menuHand = toSVG(hand);

/* Shared page parts. */
// JetBrains Mono for interface and short text, Cabinet Grotesk for titles, Switzer for long reading.
const fontURLs = {
  mono: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap',
  display: 'https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,900&display=swap',
  text: 'https://api.fontshare.com/v2/css?f[]=switzer@400,401,600,601&display=swap'
};
const fontLinks = (fonts, indent = '') => [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  ...(fonts.some(font => font !== 'mono') ? [
    '<link rel="preconnect" href="https://api.fontshare.com">',
    '<link rel="preconnect" href="https://cdn.fontshare.com" crossorigin>'
  ] : []),
  ...fonts.map(font => `<link rel="stylesheet" href="${esc(fontURLs[font])}">`)
].map(line => indent + line).join('\n');
const mathHead = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.querySelector('.article-body'),{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\\\[',right:'\\\\]',display:true},{left:'\\\\(',right:'\\\\)',display:false},{left:'$',right:'$',display:false}],throwOnError:false})"></script>`;
const head = ({title, description, base, canonical, fonts = ['mono', 'display'], math = false}) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${site.origin}${canonical}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" type="image/svg+xml" href="${base}assets/favicon.svg">
${fontLinks(fonts)}
<link rel="stylesheet" href="${base}assets/site.css">
<script>document.documentElement.classList.add('js')</script>
<script defer src="${base}assets/site.js"></script>${math ? '\n' + mathHead : ''}
</head>`;
const reading = ['mono', 'display', 'text'];
// Research-side Personal links go through the Bayesian detour (personal/hello/) until the visitor says yes.
const header = (active, base = '', gate = false) => `<header class="site-header">
<a class="wordmark" href="${base || './'}">Yumi Omori</a>
<nav class="main-nav" aria-label="Main navigation">
<a href="${base}research/"${active === 'research' ? ' aria-current="page"' : ''}>Research</a>
<a href="${base}personal/${gate ? 'hello/' : ''}"${gate ? ` data-personal-gate data-personal-direct="${base}personal/"` : ''}${active === 'personal' ? ' aria-current="page"' : ''}>Personal</a>
</nav>
</header>`;
const footer = '<div class="site-footer"></div>';
const pageHeading = (title, detail = '', className = '') => `<div class="page-heading"><h1${className ? ` class="${className}"` : ''}>${title}</h1>${detail ? `<p class="page-detail">${detail}</p>` : ''}</div>`;
const trackKeys = '<span class="timeline-keys" aria-hidden="true"><kbd>j</kbd><kbd>k</kbd><span>to browse</span></span>';
const vt = name => ` style="view-transition-name: ${name}"`;

await writeEntrance({write, site, esc, menuHand, fontLinks});

/* Research. */
const paperHTML = papers.map(p => `<li class="paper-item"><div>
<h3>${esc(p.title)}</h3>
${p.authors ? `<p class="paper-authors">${esc(p.authors)}</p>` : ''}
${p.venue ? `<p>${esc(p.venue)}</p>` : ''}
${p.url ? `<p class="paper-links"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Paper <span aria-hidden="true">↗</span></a></p>` : ''}
</div></li>`).join('\n');
await write('research/index.html', head({title: 'Research · Yumi Omori', description: site.introduction, base: '../', canonical: '/research/'}) + `
<body class="research-page"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
${header('research', '../', true)}
<main id="main">
<div class="page-heading research-hero">
<div><h1 class="research-title">Research</h1><p class="lede">${esc(site.title)} ${esc(site.introduction)} ${esc(site.note)}</p></div>
<img class="profile" src="${esc(site.photo)}" alt="Yumi Omori" width="148" height="148" decoding="async">
</div>
<section class="papers" aria-labelledby="works-heading">
<h2 class="works-heading" id="works-heading">Here are my works:${papers.length ? '' : '<span class="works-caret" aria-hidden="true"></span>'}</h2>
${papers.length ? `<ol class="paper-list">\n${paperHTML}\n</ol>` : ''}
</section>
<nav class="side-door" aria-label="Personal">
<a class="personal-choice" href="../personal/hello/" data-personal-gate data-personal-direct="../personal/">go to Yumi’s personal</a>
</nav>
</main>
${footer}
</div></body></html>`);

/* Personal: the blog, grouped by month ("save points"). */
const months = [...new Set(posts.map(p => p.date.slice(0, 7)))];
const monthId = m => 'month-' + m;
const asset = (p, base) => /^https?:\/\//.test(p) ? esc(p) : base + esc(p);
const cards = m => posts.filter(p => p.date.startsWith(m)).map(p => `<article class="post-card${p.cover ? ' has-cover' : ''}"><span class="pointer-hand" aria-hidden="true"></span>
${p.cover ? `<a class="card-cover" href="../${href(p)}" tabindex="-1" aria-hidden="true"><img class="post-cover" src="${asset(p.cover, '../')}" alt="" loading="lazy" decoding="async" width="144" height="144"></a>` : ''}
<div class="card-copy"><p class="card-date"><time datetime="${p.date}">${date(p.date, {month: 'long', day: 'numeric', year: 'numeric'})}</time></p>
<h3${vt('post-' + p.slug)}><a href="../${href(p)}">${esc(p.title)}</a></h3>
${p.excerpt ? p.excerpt.split(/\n\s*\n/).map(paragraph => `<p class="excerpt">${esc(paragraph)}</p>`).join('') : ''}</div>
</article>`).join('\n');
const timeline = months.map((m, i) => `<a class="timeline-link" href="#${monthId(m)}"${i === 0 ? ' aria-current="true"' : ''}><span>${date(m + '-01', {month: 'short', year: 'numeric'})}</span><span class="tick" aria-hidden="true"></span></a>`).join('\n');
await write('personal/index.html', head({title: 'Personal · Yumi Omori', description: 'A subset of the things I write.', base: '../', canonical: '/personal/', fonts: reading}) + `
<body class="personal-page"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
${header('personal', '../')}
<main id="main">
${pageHeading('Personal', `${posts.length} entries<span aria-hidden="true">/</span>${months.length} save points`, 'personal-title')}
<div class="lede personal-intro"><p>I <a href="../travel/">travel</a>, <a href="../read/">read</a>, write a lot. I also played a lot of video games.</p><p>Below is a subset of the things I write.</p></div>
<div class="archive-layout">
<div class="post-list">
${months.map(m => `<section class="month-group" id="${monthId(m)}" aria-labelledby="heading-${m}">
<h2 class="month-heading" id="heading-${m}"><span class="save-marker" aria-hidden="true"></span>${date(m + '-01', {month: 'long', year: 'numeric'})}</h2>
${cards(m)}
</section>`).join('\n')}
</div>
<nav class="timeline save-points" aria-label="Browse posts by month">
<p class="timeline-label">Save points</p>
${timeline}
${trackKeys}
</nav>
</div>
</main>
${footer}
</div><script src="../assets/timeline.js" defer></script></body></html>`);

/* Articles. */
for (let i = 0; i < posts.length; i++) {
  const p = posts[i], older = posts[i + 1], newer = posts[i - 1];
  const nav = (item, direction) => {
    if (!item) return '<span aria-hidden="true"></span>';
    const previous = direction === 'previous';
    const label = previous ? '<kbd aria-hidden="true">←</kbd> Previous post' : 'Next post <kbd aria-hidden="true">→</kbd>';
    return `<a class="${direction}" href="../${item.slug}/" rel="${previous ? 'prev' : 'next'}"><span class="nav-label">${label}</span><span class="nav-title"${vt('post-' + item.slug)}>${esc(item.title)}</span></a>`;
  };
  await write(href(p) + 'index.html', head({title: p.title + ' · Yumi Omori', description: p.excerpt || p.title, base: '../../', canonical: '/' + href(p), fonts: reading, math: true}) + `
<body class="reading-page"><a class="skip-link" href="#article">Skip to article</a>
<div class="reading-progress" aria-hidden="true" hidden><span></span></div>
<div class="shell">
${header('personal', '../../')}
<main class="reading-main" id="article">
<article>
<header class="article-header"><h1${vt('post-' + p.slug)}>${esc(p.title)}</h1><ul class="article-meta"><li><a href="../../">Yumi Omori</a></li><li><time datetime="${p.date}">${date(p.date, {month: 'long', year: 'numeric'})}</time></li><li>${p.readingTime} min read</li></ul></header>
<div class="article-body">${p.html}</div>
</article>
<nav class="post-navigation" aria-label="Article navigation">${nav(older, 'previous')}${nav(newer, 'next')}</nav>
<a class="back-to-blog" href="../../personal/#${monthId(p.date.slice(0, 7))}"><span aria-hidden="true">↶</span> Back to blog</a>
</main>
${footer}
</div></body></html>`);
}

/* Travel: content/travel.html, with "waypoints" on the side track. */
let travelContent = externalLinks(await read('content/travel.html'));
const waypoints = (travelContent.match(/class="travel-section"/g) || []).length;
travelContent = travelContent.replace(/(<nav class="timeline travel-contents"[^>]*>)([\s\S]*?)(\s*<\/nav>)/,
  (_, open, links, close) => `${open}\n    <p class="timeline-label">Waypoints</p>${links}\n    ${trackKeys}${close}`);
await write('travel/index.html', head({title: 'Travel · Yumi Omori', description: 'Travel notes, youth discounts, exchanges, and ideas for longer journeys.', base: '../', canonical: '/travel/', fonts: reading}) + `
<body class="travel-body"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
${header('personal', '../')}
<main id="main" class="travel-page">
${pageHeading('Travel', `${waypoints} waypoints`)}
${travelContent}
</main>
${footer}
</div><script src="../assets/timeline.js" defer></script></body></html>`);

/* Reading list: an inventory. */
const catalogueCount = bookYears.reduce((n, y) => n + y.books.length, 0);
const categoryCounts = Object.fromEntries(bookCategories.map(c => [c.id, bookYears.reduce((n, y) => n + y.books.filter(b => b.category === c.id).length, 0)]));
const bookHTML = book => `<li class="book" data-id="${esc(book.id)}" data-search="${esc([book.title, book.englishTitle, book.author, book.englishAuthor].filter(Boolean).join(' '))}">
<p class="book-title" lang="${esc(book.language)}">${esc(book.title)}</p>
${book.englishTitle && book.englishTitle !== book.title ? `<p class="book-translation" lang="en">${esc(book.englishTitle)}</p>` : ''}
${book.author ? `<p class="book-author"><span lang="${esc(book.language)}">${esc(book.author)}</span>${book.englishAuthor && book.englishAuthor !== book.author ? ` <span lang="en">· ${esc(book.englishAuthor)}</span>` : ''}</p>` : ''}
</li>`;
const shelfHTML = ({year, books}) => `<section class="book-year" id="year-${year}" aria-labelledby="heading-${year}">
<div class="year-heading"><h2 id="heading-${year}">${year ?? 'Undated'}</h2><span class="year-count">${books.length} books</span></div>
${bookCategories.map(category => {
  const entries = books.filter(b => b.category === category.id);
  return entries.length ? `<section class="book-category" data-category="${category.id}" aria-labelledby="category-${year}-${category.id}"><div class="category-heading"><h3 id="category-${year}-${category.id}">${esc(category.label)}</h3>${category.description ? `<span class="category-description">${esc(category.description)}</span>` : ''}<span class="category-count">${entries.length}</span></div><ul class="book-list">${entries.map(bookHTML).join('')}</ul></section>` : '';
}).join('')}
</section>`;
const chip = (value, label, count, checked = false) => `<label class="chip"><input type="radio" name="theme" value="${value}"${checked ? ' checked' : ''}><span>${esc(label)}</span><span class="chip-count">${count}</span></label>`;
await write('read/index.html', head({title: 'Reading · Yumi Omori', description: 'My reading list, organized by year.', base: '../', canonical: '/read/'}) + `
<body class="library-page"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell library-shell">
${header('personal', '../')}
<main id="main" class="books-page">
${pageHeading('Reading list', `${catalogueCount} items in inventory`)}
<header class="library-intro"><div><p class="books-intro">My reading list, organized by year.</p><p class="books-intro">In general, I read widely and am always interested in exploring books from unfamiliar fields. If you have any suggestions or would like to discuss a book on this list that you found interesting, please feel free to email me at <a href="mailto:yd2247@nyu.edu">yd2247@nyu.edu</a>.</p></div><a class="books-back" href="../personal/"><span aria-hidden="true">↶</span> back to writing</a></header>
<div class="book-tools" hidden>
<div class="book-search-row"><label class="book-search"><span class="sr-only">Find a title or author</span><input id="book-search" type="search" placeholder="Find a title or author" autocomplete="off"><kbd aria-hidden="true">/</kbd></label><span id="book-results" role="status" aria-live="polite">${catalogueCount} books</span></div>
<fieldset class="theme-chips"><legend class="sr-only">Filter by theme</legend>${chip('all', 'All', catalogueCount, true)}${bookCategories.map(c => chip(c.id, c.label, categoryCounts[c.id])).join('')}</fieldset>
</div>
<div class="archive-layout library-layout">
<div class="book-shelves">
${bookYears.map(shelfHTML).join('\n')}
<div class="books-empty" hidden><p>No books match your search.</p><button type="button" class="reset-search text-link">Show all books</button></div>
</div>
<nav class="timeline book-years" aria-label="Browse books by year">
<p class="timeline-label">By year</p>
${bookYears.map(({year}, i) => `<a class="timeline-link" href="#year-${year}"${i === 0 ? ' aria-current="true"' : ''}><span>${year ?? 'Undated'}</span><span class="tick" aria-hidden="true"></span></a>`).join('\n')}
${trackKeys}
</nav>
</div>
<a class="books-back" href="../personal/"><span aria-hidden="true">↶</span> back to writing</a>
</main>
${footer}
</div><script src="../assets/books.js" defer></script></body></html>`);

/* 404: game over. Served for any missing path, so every link is absolute. */
await write('404.html', head({title: 'Page not found · Yumi Omori', description: 'Page not found.', base: '/', canonical: '/404.html'}) + `
<body class="gameover-page game-cursor"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
<main id="main" class="gameover">
<p class="gameover-kicker">404 · page not found</p>
<h1>Game over</h1>
<p class="gameover-copy">You fell off the map. This page doesn’t exist, or it moved.</p>
<p class="continue" aria-hidden="true" hidden>Continue? <span class="continue-count">9</span></p>
<div class="gameover-actions">
<a class="respawn" href="/">Respawn <kbd aria-hidden="true">Enter</kbd></a>
<nav class="gameover-paths" aria-label="Other paths"><a href="/research/">Research</a><a href="/personal/">Personal</a></nav>
</div>
</main>
</div></body></html>`);

await write('.nojekyll', '');
await write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.origin}/sitemap.xml\n`);
await write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ['/', '/research/', '/personal/', '/travel/', '/read/', ...posts.map(p => '/' + href(p))].map(p => `<url><loc>${esc(site.origin + p)}</loc></url>`).join('') + '</urlset>');
console.log(`Built entrance, research, personal, travel, reading, 404 and ${posts.length} complete articles in docs/.`);
