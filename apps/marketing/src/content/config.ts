import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().max(160),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['announcement', 'tutorial', 'wrapup', 'guide']),
    tags: z.array(z.string()).default([]),
    author: z.string().default('Harry Phan'),
    heroImage: z.string().optional(),
    youtubeId: z.string().optional(),
    draft: z.boolean().default(false),
    // Sections for scroll progress tracking
    sections: z.array(z.object({
      id: z.string(),
      title: z.string(),
    })).optional(),
  }),
});

export const collections = { posts };
