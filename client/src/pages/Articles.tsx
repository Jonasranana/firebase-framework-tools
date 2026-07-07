import { useParams } from "wouter";
import {
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  PiggyBank,
  Zap,
  ShieldCheck,
  Phone,
} from "lucide-react";
import {
  SiteHeader,
  SiteFooter,
  WhatsAppButton,
  AIChatWidget,
  useFrenchPageMeta,
} from "./site-chrome";
import { ARTICLES, type Article, type ContentBlock } from "./articles-data";

const CATEGORY_ICONS: Record<string, typeof PiggyBank> = {
  "Aides & subventions": PiggyBank,
  "Pompe à chaleur": Zap,
  "Certification & confiance": ShieldCheck,
};

const CategoryBadge = ({ category }: { category: string }) => {
  const Icon = CATEGORY_ICONS[category] ?? PiggyBank;
  return (
    <span className="inline-flex items-center gap-1.5 bg-blue-50 text-[#2b5a8f] text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">
      <Icon size={13} /> {category}
    </span>
  );
};

// Illustration de couverture. Si l'article n'a pas d'image (par ex. un
// article ajouté automatiquement sans avoir pu en générer une), on affiche
// un bandeau de secours aux couleurs du site avec l'icône de la catégorie,
// plutôt qu'une image cassée.
const CoverImage = ({
  article,
  className = "",
}: {
  article: Article;
  className?: string;
}) => {
  if (article.image) {
    return (
      <img
        src={article.image}
        alt=""
        className={`object-cover ${className}`}
        loading="lazy"
      />
    );
  }
  const Icon = CATEGORY_ICONS[article.category] ?? PiggyBank;
  return (
    <div
      className={`bg-gradient-to-br from-[#16304f] via-[#1e3f66] to-[#2b5a8f] flex items-center justify-center ${className}`}
    >
      <Icon size={44} className="text-white/70" />
    </div>
  );
};

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const sortedArticles = () =>
  [...ARTICLES].sort((a, b) => (a.date < b.date ? 1 : -1));

export const ArticlesList = () => {
  useFrenchPageMeta("Articles — IP5 Énergie");
  const articles = sortedArticles();

  return (
    <div dir="ltr" className="font-sans text-gray-900 bg-gray-50 min-h-screen">
      <SiteHeader />

      <section className="pt-40 pb-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
            Le blog IP5 Énergie
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Conseils pratiques, aides de l'État et actualités de la rénovation
            énergétique, expliqués simplement.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 gap-6">
            {articles.map((article) => (
              <a
                key={article.slug}
                href={`/articles/${article.slug}`}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col"
              >
                <CoverImage article={article} className="w-full h-44" />
                <div className="p-6 flex flex-col flex-1">
                  <CategoryBadge category={article.category} />
                  <h2 className="text-xl font-bold text-gray-900 mt-4 mb-2 leading-snug">
                    {article.title}
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed flex-1">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={13} /> {formatDate(article.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} /> {article.readMinutes} min
                      </span>
                    </div>
                    <span className="text-[#2b5a8f] font-semibold text-sm flex items-center gap-1">
                      Lire <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
      <AIChatWidget />
      <WhatsAppButton />
    </div>
  );
};

const renderBlock = (block: ContentBlock, i: number) => {
  if (block.type === "h2") {
    return (
      <h2 key={i} className="text-2xl font-bold text-gray-900 mt-8 mb-3">
        {block.text}
      </h2>
    );
  }
  if (block.type === "list") {
    return (
      <ul key={i} className="space-y-2 my-4">
        {block.items.map((item, j) => (
          <li key={j} className="flex items-start gap-3 text-gray-700 leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2b5a8f] mt-2.5 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p key={i} className="text-gray-700 leading-relaxed my-4">
      {block.text}
    </p>
  );
};

const NotFoundArticle = () => (
  <div dir="ltr" className="font-sans text-gray-900 bg-gray-50 min-h-screen">
    <SiteHeader />
    <div className="pt-40 pb-24 max-w-2xl mx-auto px-4 text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Article introuvable
      </h1>
      <p className="text-gray-600 mb-8">
        Cet article n'existe pas ou plus. Retrouvez tous nos articles ci-dessous.
      </p>
      <a
        href="/articles"
        className="inline-flex items-center gap-2 bg-[#2b5a8f] text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-800 transition-colors"
      >
        <ArrowLeft size={18} /> Retour aux articles
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

  useFrenchPageMeta(
    article ? `${article.title} — IP5 Énergie` : "Article introuvable — IP5 Énergie",
  );

  if (!article) return <NotFoundArticle />;

  const others = sortedArticles()
    .filter((a) => a.slug !== article.slug)
    .slice(0, 2);

  return (
    <div dir="ltr" className="font-sans text-gray-900 bg-gray-50 min-h-screen">
      <SiteHeader />

      <article className="pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <a
            href="/articles"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-[#2b5a8f] text-sm font-medium mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Tous les articles
          </a>

          <CoverImage
            article={article}
            className="w-full h-56 md:h-72 rounded-3xl mb-6"
          />

          <CategoryBadge category={article.category} />

          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-4 mb-4 leading-tight">
            {article.title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-gray-400 mb-8 pb-8 border-b border-gray-100">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} /> {formatDate(article.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {article.readMinutes} min de lecture
            </span>
          </div>

          <div>{article.content.map(renderBlock)}</div>

          <div className="mt-12 bg-blue-50 border border-blue-100 rounded-3xl p-8 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Une question sur votre projet ?
            </h3>
            <p className="text-gray-600 mb-5">
              Testez notre simulateur gratuit ou parlez directement à un
              expert IP5 Énergie.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/#avantages"
                className="inline-flex items-center justify-center gap-2 bg-[#2b5a8f] text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-800 transition-colors"
              >
                Simuler mes économies
              </a>
              <a
                href="tel:+33749525267"
                className="inline-flex items-center justify-center gap-2 bg-white text-[#2b5a8f] border-2 border-[#2b5a8f] px-6 py-3 rounded-full font-semibold hover:bg-blue-50 transition-colors"
              >
                <Phone size={18} /> 07 49 52 52 67
              </a>
            </div>
          </div>

          {others.length > 0 && (
            <div className="mt-16">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                À lire aussi
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {others.map((o) => (
                  <a
                    key={o.slug}
                    href={`/articles/${o.slug}`}
                    className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5"
                  >
                    <p className="font-semibold text-gray-900 leading-snug">
                      {o.title}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      <SiteFooter />
      <AIChatWidget />
      <WhatsAppButton />
    </div>
  );
};
