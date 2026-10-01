const tools = document.querySelector('.book-tools');
const query = document.querySelector('#book-search');
const theme = document.querySelector('#book-theme');
const status = document.querySelector('#book-results');
const books = [...document.querySelectorAll('.book')];
const categories = [...document.querySelectorAll('.book-category')];
const years = [...document.querySelectorAll('.book-year')];
const links = [...document.querySelectorAll('.book-years a')];
const normalize = s => s.normalize('NFKC').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const text = new Map(books.map(book => [book, normalize(book.dataset.search)]));
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
  let count = 0;
  for (const category of categories) {
    const matchesTheme = theme.value === 'all' || category.dataset.category === theme.value;
    let visible = 0;
    for (const book of category.querySelectorAll('.book')) {
      book.hidden = !matchesTheme || !terms.every(term => text.get(book).includes(term));
      if (!book.hidden) visible++;
    }
    category.hidden = visible === 0;
    category.querySelector('.category-count').textContent = visible;
    count += visible;
  }
  for (const year of years) {
    const visible = [...year.querySelectorAll('.book')].filter(book => !book.hidden).length;
    year.hidden = visible === 0;
    year.querySelector('.year-count').textContent = `${visible} entries`;
    links.find(link => link.hash.slice(1) === year.id).hidden = year.hidden;
  }
  const filtered = terms.length > 0 || theme.value !== 'all';
  status.textContent = `${count} ${filtered ? (count === 1 ? 'match' : 'matches') : 'entries'}`;
  document.querySelector('.books-empty').hidden = count !== 0;
  lockedUntil = 0;
  updateYear();
}
query.addEventListener('input', filter);
theme.addEventListener('change', filter);
for (const link of links) link.addEventListener('click', () => {
  activate(link.hash.slice(1));
  lockedUntil = performance.now() + 1000;
  setTimeout(updateYear, 1050);
});
addEventListener('scroll', () => {
  if (!pending) { pending = true; requestAnimationFrame(updateYear); }
}, {passive:true});
addEventListener('resize', updateYear);
addEventListener('hashchange', () => {
  if (location.hash) activate(location.hash.slice(1));
});
tools.hidden = false;
filter();
if (location.hash && years.some(year => '#' + year.id === location.hash)) activate(location.hash.slice(1));
