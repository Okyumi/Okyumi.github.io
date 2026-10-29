import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from './vendor/marked.mjs';
import {readingList, bookCategories} from './reading-list.mjs';
import {writeEntrance} from './entrance.mjs';
import {arenaHTML} from './arena.mjs';
import {arrow, hand, toPNG, toSVG} from './pixel-art.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs');
const read = async p => fs.readFile(path.join(root, p), 'utf8');
const site = JSON.parse(await read('content/site.json'));
const papers = JSON.parse(await read('content/papers.json'));
const bookYears = readingList(JSON.parse(await read('content/books.json')));
const catalogueCount = bookYears.reduce((n, y) => n + y.books.length, 0);
const travelSource = await read('content/travel.html');
const [, placeCount = '138', countryCount = '45'] = travelSource.match(/visited (\d+) places in (\d+) countries/) || [];

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
// JetBrains Mono for interface and short text, Cabinet Grotesk for titles, Source Serif 4 for long reading.
// The Google families share one stylesheet; Fontshare is contacted only on pages that use Cabinet Grotesk.
const googleFonts = {
  mono: 'family=JetBrains+Mono:wght@400;500;600',
  text: 'family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400;1,8..60,600'
};
const fontLinks = (fonts, indent = '') => {
  const google = fonts.filter(font => googleFonts[font]).map(font => googleFonts[font]);
  const display = fonts.includes('display');
  return [
    ...(google.length ? ['<link rel="preconnect" href="https://fonts.googleapis.com">', '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'] : []),
    ...(display ? ['<link rel="preconnect" href="https://api.fontshare.com">', '<link rel="preconnect" href="https://cdn.fontshare.com" crossorigin>'] : []),
    ...(google.length ? [`<link rel="stylesheet" href="${esc(`https://fonts.googleapis.com/css2?${google.join('&')}&display=swap`)}">`] : []),
    ...(display ? [`<link rel="stylesheet" href="${esc('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,900&display=swap')}">`] : [])
  ].map(line => indent + line).join('\n');
};
const mathHead = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.querySelector('.article-body'),{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\\\[',right:'\\\\]',display:true},{left:'\\\\(',right:'\\\\)',display:false},{left:'$',right:'$',display:false}],throwOnError:false})"></script>`;
const head = ({title, description, base, canonical, fonts = ['mono', 'display'], math = false, extra = ''}) => `<!doctype html>
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
<script defer src="${base}assets/site.js"></script>${math ? '\n' + mathHead : ''}${extra ? '\n' + extra : ''}
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
// Tabs across the personal pages. The personal index itself uses its sentence as the menu instead.
const personalTabs = (active, base, current = 'page') => `<nav class="personal-tabs" aria-label="Personal pages">
${[['writing', 'personal/'], ['reading', 'read/'], ['travel', 'travel/'], ['games', 'games/']].map(([name, path]) =>
  `<a href="${base}${path}"${active === name ? ` aria-current="${current}"` : ''}>${name}</a>`).join('\n')}
</nav>`;

await writeEntrance({write, site, esc, menuHand, fontLinks});

/* Research. */
const paperHTML = papers.map(p => `<li class="paper-item"><div>
<h3>${esc(p.title)}</h3>
${p.authors ? `<p class="paper-authors">${esc(p.authors)}</p>` : ''}
${p.venue ? `<p>${esc(p.venue)}</p>` : ''}
${p.url ? `<p class="paper-links"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Paper <span aria-hidden="true">↗</span></a></p>` : ''}
</div></li>`).join('\n');
// The Dino arena's formula sits in a closed <details>, so KaTeX's stylesheet loads without blocking the page.
const arenaHead = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" media="print" onload="this.media='all'">
<script defer src="../assets/dino-core.js"></script>
<script defer src="../assets/dino.js"></script>`;
await write('research/index.html', head({title: 'Research · Yumi Omori', description: site.introduction, base: '../', canonical: '/research/', extra: arenaHead}) + `
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
${arenaHTML}
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
// Each entry is one big link (the title's link stretches over the card); the excerpt shows three lines.
const cards = m => posts.filter(p => p.date.startsWith(m)).map(p => `<article class="post-card${p.cover ? ' has-cover' : ''}"><span class="pointer-hand" aria-hidden="true"></span>
${p.cover ? `<span class="card-cover"><img class="post-cover" src="${asset(p.cover, '../')}" alt="" loading="lazy" decoding="async" width="144" height="144"></span>` : ''}
<div class="card-copy"><p class="card-date"><time datetime="${p.date}">${date(p.date, {month: 'long', day: 'numeric', year: 'numeric'})}</time><span class="card-time">${p.readingTime} min read</span><span class="card-go" aria-hidden="true">read <span>→</span></span></p>
<h4 class="card-title"${vt('post-' + p.slug)}><a class="card-link" href="../${href(p)}">${esc(p.title)}</a></h4>
${p.excerpt ? `<p class="excerpt">${esc(p.excerpt.split(/\n\s*\n/).map(part => part.trim()).join(' '))}</p>` : ''}</div>
</article>`).join('\n');
const timeline = months.map((m, i) => `<a class="timeline-link" href="#${monthId(m)}"${i === 0 ? ' aria-current="true"' : ''}><span>${date(m + '-01', {month: 'short', year: 'numeric'})}</span><span class="tick" aria-hidden="true"></span></a>`).join('\n');
// The opening sentence is the menu: four verbs, four doors. Pointing at one says what's behind it.
const doors = {
  travel: {href: '../travel/', note: `${countryCount} countries, ${placeCount} places, and tips for travelers under 30`},
  read: {href: '../read/', note: `${catalogueCount} books, sorted by year and theme`},
  write: {href: '#writing', note: `${posts.length} essays, starting right below`},
  play: {href: '../games/', note: 'Final Fantasy XIV, Zelda, and an RL gym for I Wanna Be The Guy'}
};
const door = verb => `<a class="door" href="${doors[verb].href}" data-note="${esc(doors[verb].note)}" aria-describedby="door-${verb}">${verb}</a>`;
await write('personal/index.html', head({title: 'Personal · Yumi Omori', description: 'Travel, reading, writing and video games. Below is a subset of the things I write.', base: '../', canonical: '/personal/', fonts: reading}) + `
<body class="personal-page"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
${header('personal', '../')}
<main id="main">
<div class="page-heading doors">
<p class="doors-kicker personal-title">personal</p>
<h1 class="doors-sentence">I ${door('travel')}, ${door('read')}, ${door('write')} a&nbsp;lot. I also ${door('play')} a&nbsp;lot of video games.</h1>
<p class="door-hint" aria-hidden="true"><span class="door-hand"></span><span class="door-note"><span class="hint-pointer">Four doors. Point at one to peek inside.</span><span class="hint-touch">Four doors. Tap one to go inside.</span></span></p>
<div hidden>${Object.entries(doors).map(([verb, d]) => `<span id="door-${verb}">${esc(d.note)}</span>`).join('')}</div>
</div>
<section class="writing" id="writing" aria-labelledby="writing-heading">
<div class="writing-head"><h2 class="writing-title" id="writing-heading">Writing</h2><p class="page-detail">${posts.length} entries<span aria-hidden="true">/</span>${months.length} save points</p></div>
<p class="writing-intro">Below is a subset of the things I write.</p>
<div class="archive-layout">
<div class="post-list">
${months.map(m => `<section class="month-group" id="${monthId(m)}" aria-labelledby="heading-${m}">
<h3 class="month-heading" id="heading-${m}"><span class="save-marker" aria-hidden="true"></span>${date(m + '-01', {month: 'long', year: 'numeric'})}</h3>
${cards(m)}
</section>`).join('\n')}
</div>
<nav class="timeline save-points" aria-label="Browse posts by month">
<p class="timeline-label">Save points</p>
${timeline}
${trackKeys}
</nav>
</div>
</section>
</main>
${footer}
</div><script src="../assets/timeline.js" defer></script></body></html>`);

/* Articles. A centered reading column; each post ends with "level complete" and a door on each side
   (previous = older, next = newer, also on ← / →). */
for (let i = 0; i < posts.length; i++) {
  const p = posts[i], older = posts[i + 1], newer = posts[i - 1];
  const levelDoor = (item, direction) => {
    const previous = direction === 'previous';
    if (!item) return `<p class="level-note ${direction}-note">${previous ? 'This is the first level. Everything after it is newer.' : 'This is the newest level. More are on the way.'}</p>`;
    const label = previous ? '<kbd aria-hidden="true">←</kbd> Previous level' : 'Next level <kbd aria-hidden="true">→</kbd>';
    return `<a class="${direction}" href="../${item.slug}/" rel="${previous ? 'prev' : 'next'}">${item.cover ? `<img class="level-cover" src="${asset(item.cover, '../../')}" alt="" loading="lazy" decoding="async" width="64" height="64">` : ''}<span class="level-copy"><span class="nav-label">${label}</span><span class="nav-title"${vt('post-' + item.slug)}>${esc(item.title)}</span></span></a>`;
  };
  await write(href(p) + 'index.html', head({title: p.title + ' · Yumi Omori', description: p.excerpt || p.title, base: '../../', canonical: '/' + href(p), fonts: reading, math: true}) + `
<body class="reading-page"><a class="skip-link" href="#article">Skip to article</a>
<div class="reading-progress" aria-hidden="true" hidden><span></span></div>
<div class="shell">
${header('personal', '../../')}
${personalTabs('writing', '../../', 'true')}
<main class="reading-main" id="article">
<article>
<header class="article-header"><h1${vt('post-' + p.slug)}>${esc(p.title)}</h1><ul class="article-meta"><li><a href="../../">Yumi Omori</a></li><li><time datetime="${p.date}">${date(p.date, {month: 'long', year: 'numeric'})}</time></li><li>${p.readingTime} min read</li></ul></header>
<div class="article-body">${p.html}</div>
</article>
<section class="level-complete" aria-labelledby="level-heading">
<p class="level-count"><span class="level-marker" aria-hidden="true"></span>Level ${posts.length - i} of ${posts.length}</p>
<h2 class="level-title" id="level-heading">Level complete</h2>
<nav class="post-navigation" aria-label="Article navigation">${levelDoor(older, 'previous')}${levelDoor(newer, 'next')}</nav>
</section>
<a class="back-to-blog" href="../../personal/#${monthId(p.date.slice(0, 7))}"><span aria-hidden="true">↶</span> Back to blog</a>
</main>
${footer}
</div></body></html>`);
}

/* Travel: content/travel.html, with "waypoints" on the side track and a passport stamp on each section. */
let travelContent = externalLinks(travelSource);
// The counter: edit only the sentence in content/travel.html; the big numbers (and the note on the personal page) follow it.
const countNumber = (n, label) => `<span class="count"><span class="count-number" data-count="${n}">${n}</span><span class="count-label">${label}</span></span>`;
travelContent = travelContent.replace(/<p class="travel-count">([^<]*?visited (\d+) places in (\d+) countries[^<]*)<\/p>/, (_, sentence, places, countries) =>
  `<p class="travel-count"><span class="sr-only">${sentence}</span><span class="count-pair" aria-hidden="true">${countNumber(countries, 'countries')}${countNumber(places, 'places')}</span></p>`);
const waypoints = (travelContent.match(/class="travel-section"/g) || []).length;
const waypointLabels = Object.fromEntries([...travelContent.matchAll(/class="timeline-link" href="#([^"]+)"[^>]*><span>([^<]+)<\/span>/g)].map(m => [m[1], m[2]]));
let stampNumber = 0;
travelContent = travelContent.replace(/(<section class="travel-section" id="([^"]+)"[^>]*>\s*)(<h2)/g, (_, open, id, h2) =>
  `${open}<p class="stamp" aria-hidden="true"><span class="stamp-number">${String(++stampNumber).padStart(2, '0')}/${String(waypoints).padStart(2, '0')}</span><span class="stamp-label">${esc(waypointLabels[id] || id)}</span></p>\n      ${h2}`);
travelContent = travelContent.replace(/(<nav class="timeline travel-contents"[^>]*>)([\s\S]*?)(\s*<\/nav>)/,
  (_, open, links, close) => `${open}\n    <p class="timeline-label">Waypoints</p>${links}\n    ${trackKeys}${close}`);
await write('travel/index.html', head({title: 'Travel · Yumi Omori', description: 'Travel notes, youth discounts, exchanges, and ideas for longer journeys.', base: '../', canonical: '/travel/', fonts: reading}) + `
<body class="travel-body"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
${header('personal', '../')}
${personalTabs('travel', '../')}
<main id="main" class="travel-page">
${pageHeading('Travel', `${waypoints} waypoints`)}
${travelContent}
</main>
${footer}
</div><script src="../assets/timeline.js" defer></script></body></html>`);

/* Reading list: an inventory. */
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
${personalTabs('reading', '../')}
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

/* Games: a load screen with three save files. */
const saveFiles = [
  {title: 'Final Fantasy XIV', status: 'Ultimates: 5', line: 'Five Ultimate raids cleared, the hardest fights in the game.', meter: '<span class="save-pips" aria-hidden="true">' + '<span></span>'.repeat(5) + '</span>'},
  {title: 'The Legend of Zelda: Tears of the Kingdom', status: 'Completion: 100%', line: '100% complete, every last percent.', meter: '<span class="save-bar" aria-hidden="true"><span></span></span>'},
  {title: 'I Wanna Be The Guy', status: 'Deaths: many', line: 'I built <a href="https://github.com/Okyumi/iwanna-gym" target="_blank" rel="noopener noreferrer">iwanna-gym</a>, a reinforcement-learning environment with exact I Wanna fangame physics: a C core that runs about 5.8 million steps a second, ready for PufferLib, with goal-conditioned (HER) support. Its question: how efficiently can an agent use what a failure reveals to improve its next attempt?', meter: '<a class="save-link" href="https://github.com/Okyumi/iwanna-gym" target="_blank" rel="noopener noreferrer">iwanna-gym on GitHub <span aria-hidden="true">↗</span></a>'}
];
await write('games/index.html', head({title: 'Games · Yumi Omori', description: 'Video games I keep coming back to: Final Fantasy XIV, Tears of the Kingdom and I Wanna Be The Guy.', base: '../', canonical: '/games/'}) + `
<body class="games-body"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
${header('personal', '../')}
${personalTabs('games', '../')}
<main id="main" class="games-page">
${pageHeading('Games', `${saveFiles.length} save files`)}
<p class="games-intro">I also play a lot of video games. Here are the save files I keep coming back to.</p>
<ol class="save-files">
${saveFiles.map((f, i) => `<li class="save-file">
<p class="save-meta"><span class="save-slot">File ${String(i + 1).padStart(2, '0')}</span><span class="save-status">${esc(f.status)}</span></p>
<h2 class="save-title">${esc(f.title)}</h2>
<p class="save-line">${f.line}</p>
${f.meter}
</li>`).join('\n')}
</ol>
<p class="games-more">Want to race a reinforcement-learning agent? <a href="../research/#dino-arena">Play the Dino arena</a> on my research page.</p>
<a class="books-back" href="../personal/"><span aria-hidden="true">↶</span> back to writing</a>
</main>
${footer}
</div></body></html>`);

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
await write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ['/', '/research/', '/personal/', '/travel/', '/read/', '/games/', ...posts.map(p => '/' + href(p))].map(p => `<url><loc>${esc(site.origin + p)}</loc></url>`).join('') + '</urlset>');
console.log(`Built entrance, research (with the Dino arena), personal, travel, reading, games, 404 and ${posts.length} complete articles in docs/.`);
