export type Lang = 'en' | 'fr';

export const ui = {
  en: {
    research: 'Research', thesis: 'Thesis', experience: 'Experience', projects: 'Projects', learn: 'Explainers',
    role: 'PhD · Computer vision', place: 'Albertville, France · open to research roles',
    publications: 'Publications', firstAuthor: 'First-author papers', sideProjects: 'Side projects',
    projectPage: 'project page', paper: 'paper', code: 'code', video: 'video', readMore: 'Read',
    abstract: 'Abstract', bibtex: 'BibTeX', copy: 'Copy', copied: 'Copied',
    back: 'Back to home', cv: 'CV (PDF)', downloadCv: 'Download CV (PDF)',
    manuscript: 'manuscript (PDF)', themeDark: 'Switch to dark theme', themeLight: 'Switch to light theme',
    drag: 'drag to rotate', depth: 'depth', contact: 'Contact', chapter: 'Chapter', onThisPage: 'Explainers from the thesis',
    footer: 'Built with Astro, hosted on GitHub Pages',
  },
  fr: {
    research: 'Recherche', thesis: 'Thèse', experience: 'Parcours', projects: 'Projets', learn: 'Explications',
    role: 'Docteur · Vision par ordinateur', place: 'Albertville, France · ouvert aux postes de recherche',
    publications: 'Publications', firstAuthor: 'Articles en premier auteur', sideProjects: 'Projets personnels',
    projectPage: 'page projet', paper: 'article', code: 'code', video: 'vidéo', readMore: 'Lire',
    abstract: 'Résumé', bibtex: 'BibTeX', copy: 'Copier', copied: 'Copié',
    back: "Retour à l'accueil", cv: 'CV (PDF)', downloadCv: 'Télécharger le CV (PDF)',
    manuscript: 'manuscrit (PDF)', themeDark: 'Passer au thème sombre', themeLight: 'Passer au thème clair',
    drag: 'glisser pour tourner', depth: 'profondeur', contact: 'Contact', chapter: 'Chapitre', onThisPage: 'Explications tirées de la thèse',
    footer: 'Construit avec Astro, hébergé sur GitHub Pages',
  },
} as const;

/** Prefix a site path with the base URL and the language (English has no prefix). */
export function href(lang: Lang, path = '') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return `${base}/${lang === 'fr' ? 'fr/' : ''}${p}`;
}

/** The same page in the other language. */
export function switchPath(lang: Lang, pathname: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let rest = pathname.slice(base.length).replace(/^\/(fr\/|fr$)?/, '');
  return lang === 'fr' ? `${base}/${rest}` : `${base}/fr/${rest}`;
}
