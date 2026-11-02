import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parsePost, firstPublishedDate} from './post-metadata.mjs';

test('a plain upload gets its title from the heading and its date from publication history', () => {
  const post = parsePost('\uFEFF# A new essay\r\n\r\nEvery paragraph stays here.\r\n', 'A New Essay.md', {dateForFile: () => '2026-11-02'});
  assert.equal(post.title, 'A new essay');
  assert.equal(post.slug, 'a-new-essay');
  assert.equal(post.date, '2026-11-02');
  assert.equal(post.rawBody.trim(), 'Every paragraph stays here.');
});

test('a dated filename overrides upload time, without becoming part of the URL', () => {
  const post = parsePost('An article without a heading.', '2025-09-21-life-save-point.md', {dateForFile: () => { throw Error('Not needed'); }});
  assert.equal(post.date, '2025-09-21');
  assert.equal(post.slug, 'life-save-point');
  assert.equal(post.title, 'Life save point');
});

test('existing metadata and body are retained, including quotes and full excerpts', () => {
  const post = parsePost('---\ntitle: "An authored title"\ndate: "2024-01-02"\nexcerpt: "The full excerpt.\\n\\nA second paragraph."\nquotes: ["A real quote."]\ncover: "assets/cover.jpeg"\nfeatured: false\n---\n\n# Keep this authored heading\n\nA real quote.\n', 'existing-post.md');
  assert.equal(post.title, 'An authored title');
  assert.equal(post.date, '2024-01-02');
  assert.equal(post.excerpt, 'The full excerpt.\n\nA second paragraph.');
  assert.deepEqual(post.quotes, ['A real quote.']);
  assert.equal(post.featured, false);
  assert.ok(post.rawBody.includes('# Keep this authored heading'));
});

test('invalid calendar dates fail with a useful message', () => {
  assert.throws(() => parsePost('# Essay\n\nBody', '2026-02-31-essay.md'), /real YYYY-MM-DD date/);
});

test('the first upload date survives edits and a rename', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yumi-post-date-'));
  const git = (args, date) => execFileSync('git', args, {cwd: root, stdio: 'pipe', env: {...process.env,
    GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
    ...(date ? {GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date} : {})}});
  try {
    git(['init']);
    fs.mkdirSync(path.join(root, 'content/posts'), {recursive: true});
    fs.writeFileSync(path.join(root, 'content/posts/essay.md'), '# Essay\n\nFirst version.\n');
    git(['add', '.']); git(['commit', '-m', 'First upload'], '2024-05-06T12:00:00Z');
    fs.appendFileSync(path.join(root, 'content/posts/essay.md'), '\nA later paragraph.\n');
    git(['add', '.']); git(['commit', '-m', 'Edit'], '2026-11-02T12:00:00Z');
    assert.equal(firstPublishedDate('essay.md', root), '2024-05-06');
    git(['mv', 'content/posts/essay.md', 'content/posts/renamed.md']);
    git(['commit', '-m', 'Rename'], '2026-11-03T12:00:00Z');
    assert.equal(firstPublishedDate('renamed.md', root), '2024-05-06');
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
