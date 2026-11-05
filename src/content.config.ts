import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Files live in <collection>/<lang>/<slug>.md, so entry ids look like "en/groco".
const papers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/papers' }),
  schema: z.object({
    title: z.string(),
    venue: z.string(),
    year: z.number(),
    award: z.string().optional(),
    authors: z.string(),
    tldr: z.string(),
    thumb: z.enum(['sob', 'groco']),
    arxiv: z.string().url().optional(),
    pdf: z.string().optional(),
    code: z.string().url().optional(),
    video: z.string().optional(),
    bibtex: z.string(),
    order: z.number(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    thumb: z.string(),
    tags: z.array(z.string()),
    status: z.string().optional(),
    repo: z.string().url().optional(),
    pdf: z.string().optional(),
    order: z.number(),
  }),
});

const learn = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/learn' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    chapter: z.number(),
    order: z.number(),
  }),
});

export const collections = { papers, projects, learn };
