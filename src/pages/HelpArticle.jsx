import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Play,
  ExternalLink,
  Compass,
  CheckCircle,
} from "lucide-react";

export default function HelpArticle({ language = "en" }) {
  const [searchParams] = useSearchParams();
  const key = searchParams.get("key");
  
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const isAr = language === "ar";
  
  const t = {
    en: {
      backToHelp: "Back to Help Center",
      steps: "How to do it",
      watchVideo: "Watch Tutorial",
      startTour: "Start Guided Tour",
      goToPage: "Go to",
      notFound: "Article not found",
      notFoundDesc: "The help article you're looking for doesn't exist.",
    },
    ar: {
      backToHelp: "العودة لمركز المساعدة",
      steps: "كيفية القيام بذلك",
      watchVideo: "شاهد الشرح",
      startTour: "ابدأ الجولة الإرشادية",
      goToPage: "اذهب إلى",
      notFound: "المقالة غير موجودة",
      notFoundDesc: "مقالة المساعدة التي تبحث عنها غير موجودة.",
    },
  }[language];

  useEffect(() => {
    const fetchArticle = async () => {
      if (!key) {
        setError("no_key");
        setLoading(false);
        return;
      }
      
      try {
        const result = await base44.entities.HelpArticle.filter(
          { key, is_enabled: true },
          "sort_order",
          1
        );
        
        if (result?.length > 0) {
          setArticle(result[0]);
        } else {
          setError("not_found");
        }
      } catch (err) {
        console.error("Failed to fetch article:", err);
        setError("fetch_error");
      } finally {
        setLoading(false);
      }
    };
    
    fetchArticle();
  }, [key]);

  // Start Product Fruits tour
  const handleStartTour = () => {
    if (article?.pf_tour_key && window.productFruits?.api) {
      // Navigate to target page first if needed
      if (article.route) {
        window.location.href = article.route;
        // Tour will be triggered by PF on that page
      } else {
        window.productFruits.api.tours.tryStartTour(article.pf_tour_key);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-6 w-3/4 mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">{t.notFound}</h1>
          <p className="text-muted-foreground mb-6">{t.notFoundDesc}</p>
          <Button asChild>
            <Link to={createPageUrl("Help")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.backToHelp}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const title = isAr ? article.title_ar : article.title_en;
  const summary = isAr ? article.summary_ar : article.summary_en;
  const steps = isAr ? article.steps_ar : article.steps_en;
  const ctaLabel = isAr ? article.cta_label_ar : article.cta_label_en;
  const hasSteps = steps?.length > 0;
  const hasVideo = !!article.youtube_id;
  const hasTour = !!article.pf_tour_key;
  const hasRoute = !!article.route && !!ctaLabel;

  return (
    <div className={`min-h-screen bg-background ${isAr ? "rtl" : "ltr"}`} dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-muted/30 border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link
            to={createPageUrl("Help")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.backToHelp}
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Title & Summary */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{title}</h1>
            {hasVideo && (
              <Badge variant="secondary">
                <Play className="h-3 w-3 mr-1" />
                Video
              </Badge>
            )}
          </div>
          <p className="text-lg text-muted-foreground">{summary}</p>
        </div>

        {/* Video Embed */}
        {hasVideo && (
          <Card className="mb-8 overflow-hidden">
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${article.youtube_id}?rel=0`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </Card>
        )}

        {/* Steps */}
        {hasSteps && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t.steps}</h2>
              <ol className="space-y-4">
                {steps.map((step, idx) => (
                  <li key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-foreground">{step}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {/* CTA to route */}
          {hasRoute && (
            <Button asChild size="lg">
              <Link to={article.route}>
                <ExternalLink className="h-4 w-4 mr-2" />
                {ctaLabel}
              </Link>
            </Button>
          )}

          {/* Product Fruits Tour */}
          {hasTour && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleStartTour}
            >
              <Compass className="h-4 w-4 mr-2" />
              {t.startTour}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

HelpArticle.propTypes = {
  language: PropTypes.string,
};