# Yumi Omori's personal website

A quiet research homepage and a chronological personal blog, built for GitHub Pages. All articles are real pages, readable without JavaScript. The blog reading layout follows the typography and dimensions of seohong.me: Source Sans 3, 18px body type, a 690px column, and 1.42857143 line height. The accent is a slightly deeper blue: `#3568bf`.

## Add a blog post

Create **one Markdown file** in `content/posts/`, for example `your-post.md`:

```markdown
---
title: "Your post title"
date: "2026-09-30"
excerpt: "Your authored excerpt."
featured: true
cover: "assets/my-cover.jpg"
---

Write your article here in Markdown.
```

Commit it to `main` and it appears automatically. The filename becomes the address, and the date places it in the timeline. No separate index needs editing. The preview, reading page, previous/next navigation, and sitemap update together. Use `excerpt` for the full authored summary; the build does not truncate it or invent a summary when it is missing. Each published entry should have a `cover`, either a path in `public/assets/` or an absolute image URL. Set `featured` to `false` to exclude a draft from the build.

## Edit the homepage

Update `content/site.json`. The profile image uses your GitHub avatar URL. Add papers to `content/papers.json` using `title`, `authors`, `venue`, and optional `url` fields. The initial papers list is intentionally empty.

## Edit the reading list

Add book metadata to `content/books.json`. Each entry has a stable work `id`, `title`, `author`, `language`, and `year`. For a Japanese or Chinese original, keep its original title and author, and add `englishTitle` and optionally `englishAuthor`. English originals use their original English title and author, even when the downloaded edition was translated. The `year` is the earliest known download year (use `null` when no reading year is available); repeated work IDs are grouped under the earliest year automatically. The page shows years only, with newest years first and titles alphabetically within each year.

Do not include account details, private download URLs, or full download dates in the public data. The reading list combines verified download-history metadata with additional books from backup metadata and personal additions. Backup upload timestamps are not treated as reading dates. Undated books appear in a separate section. Titles that cannot be reliably identified are held out until clarified.

## Build locally

Node 20 or newer is sufficient. No dependency installation is needed.

```sh
npm run build
npm run dev
```

## GitHub Pages

This repository is intended to be named `Okyumi.github.io` under the `Okyumi` account. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**. The included workflow builds and publishes the site on each push to `main`. Alternatively, publish the committed `docs/` folder directly from the main branch. Do not enable both publication methods at once.

## Imported writing

Posts were imported from Yumi's public `featured-blogs` repository and the current featured sections of omoriyumi.com. The most recent essay, “The Ships of Theseus Rebuilt at Different Rates,” was taken from the original website. The English versions are retained; duplicate Chinese translations are omitted, and the remaining Chinese/Japanese passages are translated into English. Repository-only navigation is replaced with website navigation. Content provenance is recorded in each article’s metadata.

The Markdown parser is Marked 17.0.5 (MIT), included in `scripts/vendor/` with its license. Fonts are loaded from Google Fonts and mathematical typesetting from the versioned KaTeX CDN.
