// Reading list: search, theme chips and the year track. Without JavaScript the full list stays readable.
const tools = document.querySelector('.book-tools');
const query = document.querySelector('#book-search');
const chips = [...document.querySelectorAll('.theme-chips input')];
const status = document.querySelector('#book-results');
const empty = document.querySelector('.books-empty');
const books = [...document.querySelectorAll('.book')];
const categories = [...document.querySelectorAll('.book-category')];
const years = [...document.querySelectorAll('.book-year')];
const track = document.querySelector('.book-years');
const links = [...track.querySelectorAll('a')];
const normalize = s => s.normalize('NFKC').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const text = new Map(books.map(book => [book, normalize(book.dataset.search)]));
const plural = n => `${n} ${n === 1 ? 'book' : 'books'}`;
let lockedUntil = 0;
let pending = false;

function activate(id) {
  for (const link of links) {
    if (link.hash.slice(1) === id) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
}
function updateYear() {
  pending = false;
  if (performance.now() < lockedUntil) return;
  const visible = years.filter(year => !year.hidden);
  let current = visible[0];
  for (const year of visible) {
    if (year.getBoundingClientRect().top <= 140) current = year;
    else break;
  }
  if (current) activate(current.id);
  else for (const link of links) link.removeAttribute('aria-current');
}
function filter() {
  const terms = normalize(query.value.trim()).split(/\s+/).filter(Boolean);
  const theme = chips.find(chip => chip.checked)?.value || 'all';
  const matches = new Map();
  let count = 0;
  for (const category of categories) {
    const id = category.dataset.category;
    let visible = 0;
    for (const book of category.querySelectorAll('.book')) {
      const found = terms.every(term => text.get(book).includes(term));
      if (found) matches.set(id, (matches.get(id) || 0) + 1);
      book.hidden = !found || (theme !== 'all' && id !== theme);
      if (!book.hidden) visible++;
    }
    category.hidden = visible === 0;
    category.querySelector('.category-count').textContent = visible;
    count += visible;
  }
  for (const year of years) {
    const visible = [...year.querySelectorAll('.book')].filter(book => !book.hidden).length;
    year.hidden = visible === 0;
    year.querySelector('.year-count').textContent = plural(visible);
    links.find(link => link.hash.slice(1) === year.id).hidden = year.hidden;
  }
  // Each chip counts the matches for the current search.
  const total = [...matches.values()].reduce((sum, n) => sum + n, 0);
  for (const chip of chips) {
    const n = chip.value === 'all' ? total : matches.get(chip.value) || 0;
    const label = chip.closest('.chip');
    label.querySelector('.chip-count').textContent = n;
    label.classList.toggle('is-empty', n === 0);
  }
  status.textContent = plural(count);
  empty.hidden = count !== 0;
  track.hidden = count === 0; // no years to browse
  lockedUntil = 0;
  updateYear();
}
query.addEventListener('input', filter);
query.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  if (query.value) {
    query.value = '';
    filter();
  } else query.blur();
});
for (const chip of chips) chip.addEventListener('change', filter);
document.querySelector('.reset-search').addEventListener('click', () => {
  query.value = '';
  chips[0].checked = true;
  filter();
  query.focus();
});
for (const link of links) link.addEventListener('click', () => {
  activate(link.hash.slice(1));
  lockedUntil = performance.now() + 1000;
  setTimeout(updateYear, 1050);
});
addEventListener('scroll', () => {
  if (!pending) {
    pending = true;
    requestAnimationFrame(updateYear);
  }
}, {passive: true});
addEventListener('resize', updateYear);
addEventListener('hashchange', () => {
  if (location.hash) activate(location.hash.slice(1));
});
tools.hidden = false;
filter();
if (location.hash && years.some(year => '#' + year.id === location.hash)) activate(location.hash.slice(1));
