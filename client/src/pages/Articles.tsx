import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import {
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  PiggyBank,
  Zap,
  ShieldCheck,
  Sun,
  Phone,
  Lightbulb,
  CheckCircle2,
  Newspaper,
} from "lucide-react";
import {
  SiteHeader,
  SiteFooter,
  WhatsAppButton,
  AIChatWidget,
  useFrenchPageMeta,
} from "./site-chrome";
import { ARTICLES, type Article, type ContentBlock } from "./articles-data";

// Rubrique « Conseils & actus » : /conseils (liste) et /conseils/:slug (article).
export const SECTION_NAME = "Conseils & actus";
export const SECTION_PATH = "/conseils";
const SITE = "https://ip5energie.fr";

const CATEGORY_ICONS: Record<string, typeof PiggyBank> = {
  Actualités: Newspaper,
  "Aides & subventions": PiggyBank,
  "Pompe à chaleur": Zap,
  Solaire: Sun,
  "Certification & confiance": ShieldCheck,
};

const CategoryBadge = ({ category, light }: { category: string; light?: boolean }) => {
  const Icon = CATEGORY_ICONS[category] ?? PiggyBank;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider ${
        light ? "text-orange-200" : "text-[#e8590c]"
      }`}
    >
      <Icon size={13} /> {category}
    </span>
  );
};

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const sortedArticles = () => [...ARTICLES].sort((a, b) => (a.date < b.date ? 1 : -1));

// Description, partage (Open Graph) et données structurées pour Google, posés le temps de la page.
function useSeo(opts: { description: string; image?: string; jsonLd?: object[]; type?: string }) {
  useEffect(() => {
    const created: Element[] = [];
    const prev: { el: Element; attr: string; value: string | null }[] = [];
    const setMeta = (sel: string, attrs: Record<string, string>, valueAttr: string, value: string) => {
      let el = document.head.querySelector(sel);
      if (!el) {
        el = document.createElement("meta");
        Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
        document.head.appendChild(el);
        created.push(el);
      } else prev.push({ el, attr: valueAttr, value: el.getAttribute(valueAttr) });
      el.setAttribute(valueAttr, value);
    };
    const url = `${SITE}${window.location.pathname}`;
    setMeta('meta[name="description"]', { name: "description" }, "content", opts.description);
    setMeta('meta[property="og:title"]', { property: "og:title" }, "content", document.title);
    setMeta('meta[property="og:description"]', { property: "og:description" }, "content", opts.description);
    setMeta('meta[property="og:url"]', { property: "og:url" }, "content", url);
    setMeta('meta[property="og:type"]', { property: "og:type" }, "content", opts.type ?? "website");
    if (opts.image) setMeta('meta[property="og:image"]', { property: "og:image" }, "content", `${SITE}${opts.image}`);
    for (const data of opts.jsonLd ?? []) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.textContent = JSON.stringify(data);
      document.head.appendChild(s);
      created.push(s);
    }
    return () => {
      created.forEach((el) => el.remove());
      prev.forEach(({ el, attr, value }) => (value === null ? el.removeAttribute(attr) : el.setAttribute(attr, value)));
    };
  }, [opts.description, opts.image, opts.type, JSON.stringify(opts.jsonLd ?? [])]);
}

// Police des titres façon presse (chargée seulement sur les pages de la rubrique).
function useHeadlineFont() {
  useEffect(() => {
    const id = "font-playfair";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap";
    document.head.appendChild(l);
  }, []);
}

const Cover = ({ article, className = "" }: { article: Article; className?: string }) =>
  article.image ? (
    <img src={article.image} alt={article.imageAlt ?? ""} className={`object-cover ${className}`} loading="lazy" />
  ) : (
    <div className={`bg-gradient-to-br from-[#0f2b4a] via-[#2b5a8f] to-[#ff8a00] ${className}`} />
  );

const Meta = ({ article, light }: { article: Article; light?: boolean }) => (
  <div className={`flex items-center gap-3 text-xs ${light ? "text-white/80" : "text-gray-500 dark:text-slate-400"}`}>
    <span className="flex items-center gap-1">
      <Calendar size={13} /> {formatDate(article.date)}
    </span>
    <span className="flex items-center gap-1">
      <Clock size={13} /> {article.readMinutes} min
    </span>
  </div>
);

export const ArticlesList = () => {
  useFrenchPageMeta(`${SECTION_NAME} : pompe à chaleur, aides et solaire — IP5 Énergie`);
  useHeadlineFont();
  const all = sortedArticles();
  const categories = useMemo(() => Array.from(new Set(all.map((a) => a.category))), [all]);
  const [cat, setCat] = useState("");
  const list = cat ? all.filter((a) => a.category === cat) : all;
  const [hero, ...rest] = list;

  useSeo({
    description:
      "Conseils pratiques et actualités sur la pompe à chaleur, MaPrimeRénov', les primes CEE et le solaire : des articles clairs rédigés par IP5 Énergie, installateur RGE.",
    image: hero?.image,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: `${SECTION_NAME} — IP5 Énergie`,
        url: `${SITE}${SECTION_PATH}`,
        blogPost: all.map((a) => ({
          "@type": "BlogPosting",
          headline: a.title,
          url: `${SITE}${SECTION_PATH}/${a.slug}`,
          datePublished: a.date,
          image: a.image ? `${SITE}${a.image}` : undefined,
        })),
      },
    ],
  });

  return (
    <div dir="ltr" className="font-sans text-gray-900 dark:text-slate-100 bg-[#faf8f5] dark:bg-slate-950 min-h-screen">
      <SiteHeader />

      <header className="pt-36 pb-8 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#e8590c] mb-2">Le magazine d'IP5 Énergie</p>
          <h1 className="font-serif text-4xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight">{SECTION_NAME}</h1>
          <p className="text-lg text-gray-600 dark:text-slate-300 max-w-2xl mt-3">
            Pompe à chaleur, aides de l'État, solaire : nos conseils et les dernières nouveautés de la rénovation
            énergétique, expliqués simplement.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["", ...categories].map((c) => (
              <button
                key={c || "tout"}
                onClick={() => setCat(c)}
                className={`text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                  cat === c
                    ? "bg-[#0f2b4a] text-white border-[#0f2b4a]"
                    : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:border-gray-400"
                }`}
              >
                {c || "Tout"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {hero && (
          <a href={`${SECTION_PATH}/${hero.slug}`} className="group grid md:grid-cols-5 gap-6 md:gap-10 items-center mb-14">
            <div className="md:col-span-3 overflow-hidden rounded-2xl">
              <Cover article={hero} className="w-full aspect-[16/9] group-hover:scale-[1.02] transition-transform duration-500" />
            </div>
            <div className="md:col-span-2">
              <CategoryBadge category={hero.category} />
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mt-3 mb-3 leading-tight group-hover:text-[#2b5a8f]">
                {hero.title}
              </h2>
              <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-4">{hero.excerpt}</p>
              <Meta article={hero} />
            </div>
          </a>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 border-t border-gray-200 dark:border-slate-800 pt-10">
          {rest.map((a) => (
            <a key={a.slug} href={`${SECTION_PATH}/${a.slug}`} className="group flex flex-col">
              <div className="overflow-hidden rounded-xl mb-4">
                <Cover article={a} className="w-full aspect-[16/9] group-hover:scale-[1.03] transition-transform duration-500" />
              </div>
              <CategoryBadge category={a.category} />
              <h3 className="font-serif text-xl font-bold text-gray-900 dark:text-white mt-2 mb-2 leading-snug group-hover:text-[#2b5a8f]">
                {a.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed line-clamp-3 flex-1">{a.excerpt}</p>
              <div className="mt-3">
                <Meta article={a} />
              </div>
            </a>
          ))}
        </div>
      </main>

      <SiteFooter />
      <AIChatWidget />
      <WhatsAppButton />
    </div>
  );
};

const renderBlock = (block: ContentBlock, i: number) => {
  switch (block.type) {
    case "h2":
      return (
        <h2 key={i} className="font-serif text-2xl md:text-[28px] font-bold text-gray-900 dark:text-white mt-10 mb-3 leading-snug">
          {block.text}
        </h2>
      );
    case "list":
      return (
        <ul key={i} className="space-y-2 my-5">
          {block.items.map((item, j) => (
            <li key={j} className="flex items-start gap-3 text-[17px] text-gray-800 dark:text-slate-200 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e8590c] mt-3 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      );
    case "box":
      return (
        <aside key={i} className="my-8 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#2b5a8f] dark:text-blue-300 mb-3">{block.title}</p>
          <ul className="space-y-2.5">
            {block.items.map((item, j) => (
              <li key={j} className="flex items-start gap-2.5 text-[16px] text-gray-800 dark:text-slate-200 leading-relaxed">
                <CheckCircle2 size={18} className="text-[#2b5a8f] dark:text-blue-300 mt-0.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </aside>
      );
    case "tip":
      return (
        <aside key={i} className="my-8 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border-l-4 border-[#ff8a00] p-5">
          <p className="flex items-center gap-2 text-sm font-extrabold text-[#c2410c] dark:text-orange-300 mb-1.5">
            <Lightbulb size={16} /> {block.title ?? "Bon à savoir"}
          </p>
          <p className="text-[16px] text-gray-800 dark:text-slate-200 leading-relaxed">{block.text}</p>
        </aside>
      );
    case "faq":
      return (
        <section key={i} className="my-10">
          <h2 className="font-serif text-2xl font-bold text-gray-900 dark:text-white mb-4">Questions fréquentes</h2>
          <div className="divide-y divide-gray-200 dark:divide-slate-800 border-y border-gray-200 dark:border-slate-800">
            {block.items.map((f, j) => (
              <details key={j} className="group py-4">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-gray-900 dark:text-white">
                  {f.q}
                  <span className="text-[#e8590c] text-xl group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-2 text-gray-700 dark:text-slate-300 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
    default:
      return (
        <p key={i} className="text-[17px] md:text-[18px] text-gray-800 dark:text-slate-200 leading-[1.75] my-5">
          {block.text}
        </p>
      );
  }
};

const NotFoundArticle = () => (
  <div dir="ltr" className="font-sans text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-950 min-h-screen">
    <SiteHeader />
    <div className="pt-40 pb-24 max-w-2xl mx-auto px-4 text-center">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Article introuvable</h1>
      <p className="text-gray-600 dark:text-slate-300 mb-8">Cet article n'existe pas ou plus. Retrouvez tous nos conseils ci-dessous.</p>
      <a
        href={SECTION_PATH}
        className="inline-flex items-center gap-2 bg-[#2b5a8f] text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-800 transition-colors"
      >
        <ArrowLeft size={18} /> {SECTION_NAME}
      </a>
    </div>
    <SiteFooter />
    <AIChatWidget />
    <WhatsAppButton />
  </div>
);

export const ArticleDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = ARTICLES.find((a) => a.slug === slug) as Article | undefined;

  useFrenchPageMeta(article ? `${article.title} — IP5 Énergie` : "Article introuvable — IP5 Énergie");
  useHeadlineFont();
  const faq = article?.content.find((b) => b.type === "faq") as Extract<ContentBlock, { type: "faq" }> | undefined;
  useSeo({
    description: article?.excerpt ?? "",
    image: article?.image,
    type: "article",
    jsonLd: article
      ? [
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.excerpt,
            image: article.image ? [`${SITE}${article.image}`] : undefined,
            datePublished: article.date,
            dateModified: article.date,
            articleSection: article.category,
            mainEntityOfPage: `${SITE}${SECTION_PATH}/${article.slug}`,
            author: { "@type": "Organization", name: "IP5 Énergie", url: SITE },
            publisher: { "@type": "Organization", name: "IP5 Énergie", logo: { "@type": "ImageObject", url: `${SITE}/favicon.png` } },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: SITE },
              { "@type": "ListItem", position: 2, name: SECTION_NAME, item: `${SITE}${SECTION_PATH}` },
              { "@type": "ListItem", position: 3, name: article.title },
            ],
          },
          ...(faq
            ? [
                {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: faq.items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
                },
              ]
            : []),
        ]
      : [],
  });

  if (!article) return <NotFoundArticle />;

  const others = sortedArticles()
    .filter((a) => a.slug !== article.slug)
    .sort((a, b) => Number(b.category === article.category) - Number(a.category === article.category))
    .slice(0, 3);

  return (
    <div dir="ltr" className="font-sans text-gray-900 dark:text-slate-100 bg-[#faf8f5] dark:bg-slate-950 min-h-screen">
      <SiteHeader />

      <article className="pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="text-sm text-gray-500 dark:text-slate-400 mb-6 flex items-center gap-2">
            <a href="/" className="hover:text-[#2b5a8f]">Accueil</a>
            <span>›</span>
            <a href={SECTION_PATH} className="hover:text-[#2b5a8f]">{SECTION_NAME}</a>
          </nav>

          <CategoryBadge category={article.category} />
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mt-3 mb-5 leading-[1.15]">
            {article.title}
          </h1>
          <p className="text-xl md:text-[22px] text-gray-700 dark:text-slate-300 leading-relaxed font-medium mb-6">{article.excerpt}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-slate-400 pb-6 border-b border-gray-200 dark:border-slate-800">
            <span className="font-semibold text-gray-800 dark:text-slate-200">Par la rédaction IP5 Énergie</span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} /> Publié le {formatDate(article.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {article.readMinutes} min de lecture
            </span>
          </div>
        </div>

        {article.image && (
          <figure className="max-w-5xl mx-auto px-0 sm:px-6 lg:px-8 mt-8">
            <Cover article={article} className="w-full aspect-[16/9] sm:rounded-2xl" />
            {article.imageCredit && (
              <figcaption className="text-xs text-gray-500 dark:text-slate-400 mt-2 px-4 sm:px-0">
                {article.imageAlt ? `${article.imageAlt}. ` : ""}© {article.imageCredit}
              </figcaption>
            )}
          </figure>
        )}

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          {article.keyPoints && article.keyPoints.length > 0 && (
            <aside className="rounded-2xl bg-[#0f2b4a] text-white p-6 mb-8">
              <p className="text-xs font-extrabold uppercase tracking-wider text-orange-300 mb-3">L'essentiel</p>
              <ul className="space-y-2">
                {article.keyPoints.map((k, j) => (
                  <li key={j} className="flex items-start gap-2.5 leading-relaxed">
                    <CheckCircle2 size={18} className="text-orange-300 mt-0.5 flex-shrink-0" />
                    {k}
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <div>{article.content.map(renderBlock)}</div>

          <div className="mt-12 rounded-3xl p-8 text-center text-white" style={{ background: "linear-gradient(120deg,#0f2b4a,#2b5a8f 60%,#e8590c)" }}>
            <h3 className="font-serif text-2xl font-bold mb-2">Un projet de pompe à chaleur ou de solaire ?</h3>
            <p className="text-white/85 mb-5">Calculez vos aides en 30 secondes ou parlez directement à un conseiller IP5 Énergie.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/#avantages" className="inline-flex items-center justify-center gap-2 bg-white text-[#0f2b4a] px-6 py-3 rounded-full font-bold hover:bg-orange-50 transition-colors">
                Simuler mes aides <ArrowRight size={18} />
              </a>
              <a href="tel:+33749525267" className="inline-flex items-center justify-center gap-2 border-2 border-white/70 text-white px-6 py-3 rounded-full font-bold hover:bg-white/10 transition-colors">
                <Phone size={18} /> 07 49 52 52 67
              </a>
            </div>
          </div>
        </div>

        {others.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
            <h3 className="font-serif text-2xl font-bold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-200 dark:border-slate-800">
              À lire aussi
            </h3>
            <div className="grid sm:grid-cols-3 gap-8">
              {others.map((o) => (
                <a key={o.slug} href={`${SECTION_PATH}/${o.slug}`} className="group">
                  <div className="overflow-hidden rounded-xl mb-3">
                    <Cover article={o} className="w-full aspect-[16/9] group-hover:scale-[1.03] transition-transform duration-500" />
                  </div>
                  <CategoryBadge category={o.category} />
                  <p className="font-serif text-lg font-bold text-gray-900 dark:text-white leading-snug mt-1 group-hover:text-[#2b5a8f]">{o.title}</p>
                </a>
              ))}
            </div>
          </div>
        )}
      </article>

      <SiteFooter />
      <AIChatWidget />
      <WhatsAppButton />
    </div>
  );
};
