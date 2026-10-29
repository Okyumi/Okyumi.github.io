import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from './vendor/marked.mjs';
import {readingList, bookCategories} from './reading-list.mjs';
import {writeEntrance} from './entrance.mjs';
import {arenaHTML} from './arena.mjs';
import {arrow, hand, icons, pointDown, toPNG, toSVG} from './pixel-art.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs');
const read = async p => fs.readFile(path.join(root, p), 'utf8');
const site = JSON.parse(await read('content/site.json'));
const papers = JSON.parse(await read('content/papers.json'));
const bookYears = readingList(JSON.parse(await read('content/books.json')));
const catalogueCount = bookYears.reduce((n, y) => n + y.books.length, 0);
const travelSource = await read('content/travel.html');

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
// The lines that come up when you point at a post on Writing. Each one is copied word for word from the post.
for (const p of posts) {
  p.quotes = Array.isArray(p.quotes) ? p.quotes : [];
  const words = text(p.body);
  for (const quote of p.quotes) if (!words.includes(text(quote))) throw new Error(`Quote not in ${p.file}: ${quote}`);
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
// Pixel art (scripts/pixel-art.mjs): the mouse cursor (every page), the menu pointer and the down arrow.
await write('assets/cursor.png', toPNG(arrow, 2));
await write('assets/cursor@2x.png', toPNG(arrow, 4));
await write('assets/pixel-hand.svg', toSVG(hand));
await write('assets/pixel-down.svg', toSVG(pointDown));
for (const [name, sprite] of Object.entries(icons)) await write(`assets/icon-${name}.svg`, toSVG(sprite));
const menuHand = toSVG(hand);

/* Shared page parts. */
// JetBrains Mono everywhere, Source Serif 4 for the text of the articles (blog posts), Fraunces for post titles
// (in the writing list and at the top of each article).
// Cabinet Grotesk is used once, for the punchline on the Bayesian detour; only that page contacts Fontshare.
const googleFonts = {
  mono: 'family=JetBrains+Mono:wght@400;500;600;700',
  text: 'family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400;1,8..60,600',
  title: 'family=Fraunces:opsz,wght,SOFT@9..144,600,50'
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
const head = ({title, description, base, canonical, fonts = ['mono'], math = false, extra = ''}) => `<!doctype html>
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
const articleFonts = ['mono', 'text', 'title'];
// Links in running text are bold blue words that pop out when you point at them (.pop-link in site.css).
// Long ones stay inline so they can wrap, and lift instead of tilting.
// Short words tilt and grow; longer names tilt less (is-mid); long ones stay inline and only lift (is-long).
const popSize = label => label.length > 16 ? ' is-long' : label.length > 8 ? ' is-mid' : '';
const popLink = (attrs, inner) => `<a class="pop-link${popSize(text(inner))}" ${attrs.trim()}>${inner}</a>`;
const popLinks = html => html.replace(/<a\s([^>]*)>([\s\S]*?)<\/a>/g, (tag, attrs, inner) => /\bclass=/.test(attrs) ? tag : popLink(attrs, inner));
// Research-side Personal links go through the Bayesian detour (personal/hello/) until the visitor says yes.
const header = (active, base = '', gate = false) => `<header class="site-header">
<a class="wordmark" href="${base || './'}">Yumi Omori</a>
<nav class="main-nav" aria-label="Main navigation">
<a href="${base}research/"${active === 'research' ? ' aria-current="page"' : ''}>Research</a>
<a href="${base}personal/${gate ? 'hello/' : ''}"${gate ? ` data-personal-gate data-personal-direct="${base}personal/"` : ''}${active === 'personal' ? ' aria-current="page"' : ''}>Personal</a>
</nav>
</header>`;
const footer = '<div class="site-footer"></div>';
// Page names are for screen readers; the menu and the tabs already say where you are.
const pageTitle = title => `<h1 class="sr-only">${esc(title)}</h1>`;
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
// The research field pops like the words on Personal, and its window says what most of the work is about.
const field = 'Deep Reinforcement Learning';
const fieldSay = 'In most of my past work, I focused on sparse-reward settings.';
const fieldIntro = esc(site.introduction).replace(`${field}.`, `<span class="nowrap"><button type="button" class="pop-link is-mid is-phrase" data-say="${esc(fieldSay)}" aria-describedby="say-field">${field}</button>.</span>`);
const fieldSayHTML = fieldIntro.includes('data-say') ? `<div hidden><span id="say-field">${esc(fieldSay)}</span></div>` : '';
const arenaHead = `<script defer src="../assets/dino-core.js"></script>
<script defer src="../assets/dino.js"></script>`;
await write('research/index.html', head({title: 'Research · Yumi Omori', description: site.introduction, base: '../', canonical: '/research/', extra: arenaHead}) + `
<body class="research-page"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
${header('research', '../', true)}
<main id="main">
<div class="research-hero">
<div>${pageTitle('Research')}<p class="lede">${esc(site.title)} ${fieldIntro} ${esc(site.note)}</p>${fieldSayHTML}
<h2 class="works-heading" id="works-heading">Here are my works:${papers.length ? '' : '<span class="works-caret" aria-hidden="true"></span>'}</h2></div>
<img class="profile" src="${esc(site.photo)}" alt="Yumi Omori" width="148" height="148" decoding="async">
</div>
${papers.length ? `<section class="papers" aria-labelledby="works-heading">\n<ol class="paper-list">\n${paperHTML}\n</ol>\n</section>` : ''}
${arenaHTML}
<nav class="side-door" aria-label="Personal">
<a class="personal-choice" href="../personal/hello/" data-personal-gate data-personal-direct="../personal/">go to Yumi’s personal</a>
</nav>
</main>
${footer}
</div></body></html>`);

/* Personal: the blog, grouped by month. */
const months = [...new Set(posts.map(p => p.date.slice(0, 7)))];
const monthId = m => 'month-' + m;
const asset = (p, base) => /^https?:\/\//.test(p) ? esc(p) : base + esc(p);
// Each entry is one big link (the title's link stretches over the card). Excerpts are shown in full.
const excerptHTML = p => (p.excerpt || '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)
  .map(part => `<p class="excerpt">${esc(part)}</p>`).join('\n');
// A post you have read gets a blue pixel star after its title, like a cleared level. The star is there on every
// card and only takes a colour on :visited (the browser's own history; nothing is stored), so it is kept with
// the last word to never wrap alone.
const starred = title => {
  const at = title.trimEnd().lastIndexOf(' ');
  return `${esc(title.slice(0, at + 1))}<span class="nowrap">${esc(title.slice(at + 1))}<span class="card-star" aria-hidden="true"></span></span>`;
};
const cards = m => posts.filter(p => p.date.startsWith(m)).map(p => `<article class="post-card${p.cover ? ' has-cover' : ''}"${p.quotes.length ? ` data-quotes="${esc(JSON.stringify(p.quotes))}"` : ''}><span class="pointer-hand" aria-hidden="true"></span>
${p.cover ? `<span class="card-cover"><img class="post-cover" src="${asset(p.cover, '../')}" alt="" loading="lazy" decoding="async" width="144" height="144"></span>` : ''}
<div class="card-copy"><p class="card-date"><time datetime="${p.date}">${date(p.date, {month: 'long', day: 'numeric', year: 'numeric'})}</time></p>
<h2 class="card-title"${vt('post-' + p.slug)}><a class="card-link" href="../${href(p)}">${starred(p.title)}</a></h2>
${excerptHTML(p)}</div>
</article>`).join('\n');
const timeline = months.map((m, i) => `<a class="timeline-link" href="#${monthId(m)}"${i === 0 ? ' aria-current="true"' : ''}><span>${date(m + '-01', {month: 'short', year: 'numeric'})}</span><span class="tick" aria-hidden="true"></span></a>`).join('\n');
// The opening sentence is the menu: travel, read, write and played. Pointing at one of them shows a line
// about it (site.js types it into a small window over the word); screen readers get it as the description.
const travelCount = travelSource.match(/visited (\d+) places in (\d+) countries/);
const sayings = {
  travel: travelCount ? `I have visited ${travelCount[1]} places in ${travelCount[2]} countries.` : '',
  read: `${catalogueCount} books in the inventory.`,
  write: 'Well, here I have a subset of the things I write.',
  played: 'A small subset of games I play D:'
};
const pop = (path, word) => `<a class="pop-link" href="${path}"${sayings[word] ? ` data-say="${esc(sayings[word])}" aria-describedby="say-${word}"` : ''}>${word}</a>`;
const sayHTML = Object.entries(sayings).filter(([, line]) => line).map(([word, line]) => `<span id="say-${word}">${esc(line)}</span>`).join('');
await write('personal/index.html', head({title: 'Personal · Yumi Omori', description: 'I travel, read, write a lot. I also played a lot of video games. Below is a subset of the things I write.', base: '../', canonical: '/personal/', fonts: ['mono', 'title']}) + `
<body class="personal-page"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
${header('personal', '../')}
<main id="main">
${pageTitle('Personal')}
<div class="personal-intro">
<p>I ${pop('../travel/', 'travel')}, ${pop('../read/', 'read')}, ${pop('#writing', 'write')} a lot. I also ${pop('../games/', 'played')} a lot of video games.</p>
<p>Below is a subset of the things I write.</p>
</div>
<div hidden>${sayHTML}</div>
<div class="archive-layout">
<div class="post-list" id="writing">
${months.map(m => `<section class="month-group" id="${monthId(m)}" aria-label="${date(m + '-01', {month: 'long', year: 'numeric'})}">
${cards(m)}
</section>`).join('\n')}
</div>
<nav class="timeline" aria-label="Browse posts by month">
${timeline}
</nav>
</div>
</main>
${footer}
</div><script src="../assets/timeline.js" defer></script></body></html>`);

/* Articles: one centered reading column, and a game menu at the end: previous (older) post, next (newer)
   post and back to the blog. The hand points at the selected option; ↑ / ↓ move it, ← / → / b also work. */
for (let i = 0; i < posts.length; i++) {
  const p = posts[i], older = posts[i + 1], newer = posts[i - 1];
  const option = (className, link, label, extra = '') => `<a class="menu-option ${className}" href="${link}"${extra}><span class="menu-hand" aria-hidden="true"></span><span class="nav-label">${label}</span>`;
  const postOption = (item, direction) => {
    if (!item) return '';
    const previous = direction === 'previous';
    return option(direction, `../${item.slug}/`, `<span aria-hidden="true">${previous ? '←' : '→'}</span> ${previous ? 'Previous' : 'Next'} post`, ` rel="${previous ? 'prev' : 'next'}"`)
      + `<span class="nav-title"${vt('post-' + item.slug)}>${esc(item.title)}</span></a>`;
  };
  const menu = [postOption(older, 'previous'), postOption(newer, 'next'),
    option('back-to-blog', `../../personal/#${monthId(p.date.slice(0, 7))}`, '<span aria-hidden="true">↶</span> Back to blog') + '</a>']
    .filter(Boolean).map((item, n) => n ? item : item.replace('class="menu-option ', 'class="menu-option is-current '));
  await write(href(p) + 'index.html', head({title: p.title + ' · Yumi Omori', description: p.excerpt || p.title, base: '../../', canonical: '/' + href(p), fonts: articleFonts, math: true}) + `
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
<nav class="post-navigation game-window" aria-label="Article navigation">
${menu.join('\n')}
</nav>
</main>
${footer}
</div></body></html>`);
}

/* Travel: content/travel.html as written, with its sections on the side track. */
const travelContent = popLinks(externalLinks(travelSource));
await write('travel/index.html', head({title: 'Travel · Yumi Omori', description: 'Travel notes, youth discounts, exchanges, and ideas for longer journeys.', base: '../', canonical: '/travel/'}) + `
<body class="travel-body"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
${header('personal', '../')}
${personalTabs('travel', '../')}
<main id="main" class="travel-page">
${pageTitle('Travel')}
${travelContent}
</main>
${footer}
</div><script src="../assets/timeline.js" defer></script></body></html>`);

/* Reading list. */
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
const chip = (value, label, count, checked = false) => `<label class="game-button is-small chip"><input type="radio" name="theme" value="${value}"${checked ? ' checked' : ''}><span>${esc(label)}</span><span class="chip-count">${count}</span></label>`;
await write('read/index.html', head({title: 'Reading · Yumi Omori', description: 'My reading list, organized by year.', base: '../', canonical: '/read/'}) + `
<body class="library-page"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell library-shell">
${header('personal', '../')}
${personalTabs('reading', '../')}
<main id="main" class="books-page">
${pageTitle('Reading list')}
<header class="library-intro"><div><p class="books-intro">My reading list, organized by year.</p><p class="books-intro">In general, I read widely and am always interested in exploring books from unfamiliar fields. If you have any suggestions or would like to discuss a book on this list that you found interesting, please feel free to email me at ${popLink('href="mailto:yd2247@nyu.edu"', 'yd2247@nyu.edu')}.</p></div><a class="books-back" href="../personal/"><span aria-hidden="true">↶</span> back to writing</a></header>
<div class="book-tools" hidden>
<div class="book-search-row"><label class="book-search"><span class="sr-only">Find a title or author</span><input id="book-search" type="search" placeholder="Find a title or author" autocomplete="off"><kbd aria-hidden="true">/</kbd></label><span id="book-results" role="status" aria-live="polite">${catalogueCount} books</span></div>
<fieldset class="theme-chips"><legend class="sr-only">Filter by theme</legend>${chip('all', 'All', catalogueCount, true)}${bookCategories.map(c => chip(c.id, c.label, categoryCounts[c.id])).join('')}</fieldset>
</div>
<div class="archive-layout library-layout">
<div class="book-shelves">
${bookYears.map(shelfHTML).join('\n')}
<div class="books-empty" hidden><p>No books match your search.</p><button type="button" class="game-button is-small reset-search">Show all books</button></div>
</div>
<nav class="timeline book-years" aria-label="Browse books by year">
${bookYears.map(({year}, i) => `<a class="timeline-link" href="#year-${year}"${i === 0 ? ' aria-current="true"' : ''}><span>${year ?? 'Undated'}</span><span class="tick" aria-hidden="true"></span></a>`).join('\n')}
</nav>
</div>
<a class="books-back" href="../personal/"><span aria-hidden="true">↶</span> back to writing</a>
</main>
${footer}
</div><script src="../assets/books.js" defer></script></body></html>`);

/* Games. The iwanna-gym line is the repository's own description. */
const iwannaGym = popLink('href="https://github.com/Okyumi/iwanna-gym" target="_blank" rel="noopener noreferrer"', 'iwanna-gym');
const games = [
  {title: 'Final Fantasy XIV', note: '5 Ultimates cleared'},
  {title: 'The Legend of Zelda: Tears of the Kingdom', note: '100% completion'},
  {title: 'I Wanna Be The Guy', note: `I built ${iwannaGym}, an RL environment with exact I Wanna fangame physics: 5.8M steps/s C core, PufferLib-ready, goal-conditioned (HER/GCRL) support, 10 levels.`}
];
// The shelf: more games I play, in the order of my list. Each cover opens a small window with the name, the
// studio and the year (site.js); the cover's alt text and a hidden line say the same.
const gameShelf = [
  ['final-fantasy-xvi', 'Final Fantasy XVI', 'Square Enix', 2023],
  ['like-a-dragon-gaiden', 'Like a Dragon Gaiden: The Man Who Erased His Name', 'Ryu Ga Gotoku Studio', 2023],
  ['elden-ring', 'Elden Ring', 'FromSoftware', 2022],
  ['the-last-of-us-remastered', 'The Last of Us Remastered', 'Naughty Dog', 2014],
  ['sekiro', 'Sekiro: Shadows Die Twice', 'FromSoftware', 2019],
  ['resident-evil-4', 'Resident Evil 4', 'Capcom', 2023],
  ['dark-souls-iii', 'Dark Souls III', 'FromSoftware', 2016],
  ['death-stranding', 'Death Stranding Director’s Cut', 'Kojima Productions', 2021],
  ['the-witcher-3', 'The Witcher 3: Wild Hunt', 'CD Projekt Red', 2015],
  ['final-fantasy-xiv', 'Final Fantasy XIV', 'Square Enix', 2013],
  ['ori', 'Ori and the Blind Forest', 'Moon Studios', 2015],
  ['the-last-of-us-part-ii', 'The Last of Us Part II', 'Naughty Dog', 2020],
  ['baldurs-gate-3', 'Baldur’s Gate 3', 'Larian Studios', 2023],
  ['skyrim', 'The Elder Scrolls V: Skyrim', 'Bethesda Game Studios', 2011],
  ['cyberpunk-2077', 'Cyberpunk 2077', 'CD Projekt Red', 2020],
  ['breath-of-the-wild', 'The Legend of Zelda: Breath of the Wild', 'Nintendo', 2017],
  ['tears-of-the-kingdom', 'The Legend of Zelda: Tears of the Kingdom', 'Nintendo', 2023],
  ['red-dead-redemption-2', 'Red Dead Redemption 2', 'Rockstar Games', 2018],
  ['dying-light-2', 'Dying Light 2 Stay Human', 'Techland', 2022],
  ['world-of-warcraft-midnight', 'World of Warcraft: Midnight', 'Blizzard Entertainment', 2026],
  ['terraria', 'Terraria', 'Re-Logic', 2011],
  ['cytus-ii', 'Cytus II', 'Rayark', 2018],
  ['animal-crossing', 'Animal Crossing: New Horizons', 'Nintendo', 2020],
  ['persona-5-royal', 'Persona 5 Royal', 'Atlus', 2019],
  ['spider-man', 'Marvel’s Spider-Man Remastered', 'Insomniac Games', 2020]
];
const gameShelfHTML = gameShelf.map(([slug, name, studio, year]) => `<li class="game-tile" tabindex="0" data-name="${esc(name)}" data-meta="${esc(studio)} · ${year}"><img src="../assets/games/${slug}.webp" alt="${esc(name)}" width="300" height="450" loading="lazy" decoding="async"><span class="sr-only">${esc(studio)}, ${year}</span></li>`).join('\n');
await write('games/index.html', head({title: 'Games · Yumi Omori', description: 'Final Fantasy XIV, Tears of the Kingdom, I Wanna Be The Guy and more games I play.', base: '../', canonical: '/games/'}) + `
<body class="games-body"><a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
${header('personal', '../')}
${personalTabs('games', '../')}
<main id="main" class="games-page">
${pageTitle('Games')}
<ul class="game-list">
${games.map(g => `<li class="game"><h2 class="game-title">${esc(g.title)}</h2><p class="game-note">${g.note}</p></li>`).join('\n')}
</ul>
<ul class="game-shelf" aria-label="More games I play">
${gameShelfHTML}
</ul>
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
<a class="game-button is-primary respawn" href="/">Respawn <kbd aria-hidden="true">Enter</kbd></a>
<nav class="gameover-paths" aria-label="Other paths"><a href="/research/">Research</a><a href="/personal/">Personal</a></nav>
</div>
</main>
</div></body></html>`);

await write('.nojekyll', '');
await write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.origin}/sitemap.xml\n`);
await write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ['/', '/research/', '/personal/', '/travel/', '/read/', '/games/', ...posts.map(p => '/' + href(p))].map(p => `<url><loc>${esc(site.origin + p)}</loc></url>`).join('') + '</urlset>');
console.log(`Built entrance, research (with the Dino arena), personal, travel, reading, games, 404 and ${posts.length} complete articles in docs/.`);
