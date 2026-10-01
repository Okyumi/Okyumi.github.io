// The public list contains book metadata and years, never account or download details.
export function readingList(entries) {
  if (!Array.isArray(entries)) throw new Error('The reading list must be an array.');
  const works = new Map();
  for (const entry of entries) {
    const {id, title, author, year, language = 'en', englishTitle, englishAuthor} = entry;
    if (!id || !title || !author || (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getUTCFullYear()))) {
      throw new Error(`Invalid book metadata: ${id || title || 'unnamed book'}`);
    }
    if (['ja', 'zh'].includes(language) && !englishTitle) {
      throw new Error(`An English title is required for ${title}.`);
    }
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
