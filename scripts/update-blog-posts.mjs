import { readFile, writeFile } from 'node:fs/promises';

const API_URL = process.env.BLOG_POSTS_API_URL ?? 'https://blog.rczajka.me/api/posts';
const BLOG_URL = process.env.BLOG_URL ?? 'https://blog.rczajka.me';
const README_PATH = process.env.README_PATH ?? 'README.md';
const POST_LIMIT = Number.parseInt(process.env.BLOG_POSTS_LIMIT ?? '5', 10);

const START_MARKER = '<!-- BLOG-POSTS:START -->';
const END_MARKER = '<!-- BLOG-POSTS:END -->';

if (!Number.isInteger(POST_LIMIT) || POST_LIMIT < 1) {
  throw new Error('BLOG_POSTS_LIMIT must be a positive integer.');
}

const posts = await fetchPosts();
const readme = await readFile(README_PATH, 'utf8');
const nextReadme = replaceBlogPostsBlock(readme, buildBlogPostsBlock(posts));

if (nextReadme === readme) {
  console.log('README.md is already up to date.');
} else {
  await writeFile(README_PATH, nextReadme, 'utf8');
  console.log(`Updated README.md with ${posts.length} blog post(s).`);
}

async function fetchPosts() {
  const response = await fetch(API_URL, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch blog posts: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();

  if (!payload || !Array.isArray(payload.items)) {
    throw new Error('Blog posts API response must include an items array.');
  }

  return payload.items.slice(0, POST_LIMIT).map(normalizePost);
}

function normalizePost(post, index) {
  if (!post || typeof post.title !== 'string' || post.title.trim() === '') {
    throw new Error(`Blog post at index ${index} is missing a title.`);
  }

  if (!post.href || typeof post.href !== 'string') {
    throw new Error(`Blog post ${post.title} is missing an href.`);
  }

  return {
    title: post.title.trim(),
    href: new URL(post.href, BLOG_URL).toString(),
    date: typeof post.date === 'string' ? post.date.trim() : '',
  };
}

function buildBlogPostsBlock(posts) {
  const postLines = posts.length > 0 ? posts.map(formatPostLine) : ['_No blog posts found._'];

  return `${START_MARKER}
${postLines.join('\n')}

[See all posts](${BLOG_URL})
${END_MARKER}`;
}

function formatPostLine(post) {
  const dateSuffix = post.date ? ` - ${escapeMarkdownText(post.date)}` : '';

  return `- [${escapeMarkdownText(post.title)}](${post.href})${dateSuffix}`;
}

function replaceBlogPostsBlock(readme, blogPostsBlock) {
  const startIndex = readme.indexOf(START_MARKER);
  const endIndex = readme.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`README.md must include ${START_MARKER} and ${END_MARKER} markers.`);
  }

  return [
    readme.slice(0, startIndex),
    blogPostsBlock,
    readme.slice(endIndex + END_MARKER.length),
  ].join('');
}

function escapeMarkdownText(value) {
  return value.replace(/([\\[\]])/g, '\\$1');
}
