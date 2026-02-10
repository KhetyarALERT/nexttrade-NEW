import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  BookOpen,
  HelpCircle,
  Play,
  ChevronRight,
  Headphones,
  MessageCircle,
} from "lucide-react";

// Classify article: FAQ if no steps/video/tour, otherwise Guide
function classifyArticle(article) {
  const hasSteps = (article.steps_en?.length > 0) || (article.steps_ar?.length > 0);
  const hasVideo = !!article.youtube_id;
  const hasTour = !!article.pf_tour_key;
  
  if (!hasSteps && !hasVideo && !hasTour) {
    return "faq";
  }
  return "guide";
}

export default function Help({ language = "en" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") || "guides";
  
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const isAr = language === "ar";
  
  const t = {
    en: {
      title: "Help Center",
      subtitle: "Find answers and learn how to use NextTrade",
      searchPlaceholder: "Search guides and FAQs...",
      guides: "Guides",
      faq: "FAQ",
      noResults: "No results found",
      readMore: "Read more",
      watchVideo: "Watch video",
      contactSupport: "Contact Support",
      contactDesc: "Can't find what you're looking for?",
    },
    ar: {
      title: "مركز المساعدة",
      subtitle: "ابحث عن إجابات وتعلم كيفية استخدام NextTrade",
      searchPlaceholder: "ابحث في الأدلة والأسئلة الشائعة...",
      guides: "الأدلة",
      faq: "الأسئلة الشائعة",
      noResults: "لا توجد نتائج",
      readMore: "اقرأ المزيد",
      watchVideo: "شاهد الفيديو",
      contactSupport: "تواصل مع الدعم",
      contactDesc: "لم تجد ما تبحث عنه؟",
    },
  }[language];

  // Fetch articles on mount
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const result = await base44.entities.HelpArticle.filter(
          { is_enabled: true },
          "sort_order",
          100
        );
        setArticles(result || []);
      } catch (err) {
        console.error("Failed to fetch help articles:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  // Filter and classify articles
  const { guides, faqs } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    const filtered = articles.filter((a) => {
      if (!query) return true;
      const titleMatch =
        (a.title_en || "").toLowerCase().includes(query) ||
        (a.title_ar || "").toLowerCase().includes(query);
      const summaryMatch =
        (a.summary_en || "").toLowerCase().includes(query) ||
        (a.summary_ar || "").toLowerCase().includes(query);
      return titleMatch || summaryMatch;
    });

    const g = [];
    const f = [];
    
    for (const article of filtered) {
      if (classifyArticle(article) === "faq") {
        f.push(article);
      } else {
        g.push(article);
      }
    }
    
    return { guides: g, faqs: f };
  }, [articles, searchQuery]);

  const handleTabChange = (value) => {
    setSearchParams({ tab: value });
  };

  const activeTab = tabParam === "faq" ? "faq" : "guides";
  const displayItems = activeTab === "faq" ? faqs : guides;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.title}</h1>
          <p className="text-lg text-white/70 mb-8">{t.subtitle}</p>
          
          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30"
              style={{ fontSize: "16px" }}
            />
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="guides" className="gap-2">
              <BookOpen className="h-4 w-4" />
              {t.guides}
            </TabsTrigger>
            <TabsTrigger value="faq" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              {t.faq}
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : displayItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t.noResults}
            </div>
          ) : (
            <>
              <TabsContent value="guides" className="mt-0">
                <div className="grid gap-4">
                  {guides.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      language={language}
                      t={t}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="faq" className="mt-0">
                <div className="grid gap-4">
                  {faqs.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      language={language}
                      t={t}
                    />
                  ))}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Contact Support CTA */}
        <Card className="mt-12 border-0 bg-muted/50">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Headphones className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t.contactSupport}</h3>
                <p className="text-sm text-muted-foreground">{t.contactDesc}</p>
              </div>
            </div>
            <Button asChild>
              <Link to={createPageUrl("Contact")}>
                <MessageCircle className="h-4 w-4 mr-2" />
                {t.contactSupport}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

Help.propTypes = {
  language: PropTypes.string,
};

function ArticleCard({ article, language, t }) {
  const isAr = language === "ar";
  const title = isAr ? article.title_ar : article.title_en;
  const summary = isAr ? article.summary_ar : article.summary_en;
  const hasVideo = !!article.youtube_id;

  return (
    <Link to={`${createPageUrl("HelpArticle")}?key=${article.key}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
        <CardContent className="flex items-center justify-between p-4 sm:p-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {title}
              </h3>
              {hasVideo && (
                <Badge variant="secondary" className="shrink-0">
                  <Play className="h-3 w-3 mr-1" />
                  Video
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{summary}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 ml-4 group-hover:text-primary transition-colors" />
        </CardContent>
      </Card>
    </Link>
  );
}

ArticleCard.propTypes = {
  article: PropTypes.object.isRequired,
  language: PropTypes.string.isRequired,
  t: PropTypes.object.isRequired,
};