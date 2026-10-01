# Yumi Omori's personal website

A quiet research homepage and a chronological featured-writing archive, built for GitHub Pages. All articles are real pages, readable without JavaScript. The blog reading layout follows the typography and dimensions of seohong.me: Source Sans 3, 18px body type, a 690px column, and 1.42857143 line height. The accent is a slightly deeper blue: `#3568bf`.

## Add a blog post

Create **one Markdown file** in `content/posts/`, for example `your-post.md`:

```markdown
---
title: "Your post title"
date: "2026-09-30"
excerpt: "A short preview of your post."
featured: true
---

Write your article here in Markdown.
```

Commit it to `main` and it appears automatically. The filename becomes the address, and the date places it in the timeline. No separate index needs editing. The preview, reading page, previous/next navigation, and sitemap update together. The optional `excerpt` can be omitted to use the opening text. An optional `cover` points to a file in `public/assets/`, such as `"assets/my-cover.jpg"`. No cover means a clean text-only row. Set `featured` to `false` to exclude a draft from the build.

## Edit the homepage

Update `content/site.json`. Replace `public/assets/profile.jpeg` to change your photo. Add papers to `content/papers.json` using `title`, `authors`, `venue`, and optional `url` fields. The initial papers list is intentionally empty.

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
