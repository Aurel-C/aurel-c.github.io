# aurel-c.github.io

Personal site of Aurélien Cecille, built with [Astro](https://astro.build) and deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Where things live

| Path | Content |
|---|---|
| `src/content/papers/{en,fr}/*.md` | one page per paper (front matter feeds the home page list) |
| `src/content/projects/{en,fr}/*.md` | one page per side project |
| `src/content/learn/{en,fr}/*.md` | explainers adapted from thesis chapters 2 and 3 |
| `src/components/Home.astro` | home page (hero, experience timeline, contact) |
| `src/components/Thesis.astro`, `src/data/thesis.ts` | thesis page and its abstract / popular summary |
| `src/i18n.ts` | interface strings in English and French |
| `public/js/site.js` | point cloud viewer, concept figures, theme toggle |
| `public/figures`, `public/files`, `public/media` | images, PDFs, video |

English pages live at `/`, French at `/fr/`. To add a paper or project, copy an existing `.md` in both languages and change the front matter.

Pages setting: Settings → Pages → Source: **GitHub Actions**.
