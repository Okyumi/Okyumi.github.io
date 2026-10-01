// Public book metadata only. Source reconciliation is kept outside the site.
export const bookCategories = [
  {id:'science', label:'Science'},
  {id:'philosophy', label:'Philosophy'},
  {id:'history', label:'History & Society'},
  {id:'literature', label:'Fiction & Literature'},
  {id:'memoir', label:'Biography & Memoir'},
  {id:'travel', label:'Travel & Reportage'},
  {id:'art', label:'Art & Design'},
  {id:'learning', label:'Learning & Life'},
  {id:'languages', label:'Languages & Reference'},
  {id:'others', label:'Others', description:'Manga, web fiction & games'}
];
export function readingList(entries) {
  if (!Array.isArray(entries)) throw new Error('The reading list must be an array.');
  const works = new Map();
  for (const entry of entries) {
    const {id, title, author, year, language = 'en', category} = entry;
    if (!id || !title || (!author && entry.metadataStatus !== 'author-unconfirmed') || (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getUTCFullYear()))) {
      throw new Error(`Invalid book metadata: ${id || title || 'unnamed book'}`);
    }
    if (['ja', 'zh'].includes(language) && !entry.englishTitle) {
      throw new Error(`An English title is required for ${title}.`);
    }
    if (!bookCategories.some(c => c.id === category)) throw new Error(`Missing category for ${title}.`);
    const previous = works.get(id);
    const years = [year, previous?.year].filter(Number.isInteger);
    works.set(id, {...entry, language, year: years.length ? Math.min(...years) : null});
  }
  const books = [...works.values()].sort((a, b) =>
    (b.year ?? 0) - (a.year ?? 0) || (a.englishTitle || a.title).localeCompare(b.englishTitle || b.title, 'en')
  );
  return [...new Set(books.map(book => book.year))].map(year => ({
    year, books: books.filter(book => book.year === year)
  }));
}
