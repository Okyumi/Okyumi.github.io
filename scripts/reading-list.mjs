// The public list contains book metadata and years, never account or download details.
export function readingList(entries) {
  if (!Array.isArray(entries)) throw new Error('The reading list must be an array.');
  const works = new Map();
  for (const entry of entries) {
    const {id, title, author, year, language = 'en', englishTitle, englishAuthor} = entry;
    if (!id || !title || !author || !Number.isInteger(year) || year < 1900 || year > new Date().getUTCFullYear()) {
      throw new Error(`Invalid book metadata: ${id || title || 'unnamed book'}`);
    }
    if (['ja', 'zh'].includes(language) && !englishTitle) {
      throw new Error(`An English title is required for ${title}.`);
    }
    const previous = works.get(id);
    works.set(id, {...entry, language, year: Math.min(year, previous?.year ?? year)});
  }
  const books = [...works.values()].sort((a, b) =>
    b.year - a.year || (a.englishTitle || a.title).localeCompare(b.englishTitle || b.title, 'en')
  );
  return [...new Set(books.map(book => book.year))].map(year => ({
    year, books: books.filter(book => book.year === year)
  }));
}
