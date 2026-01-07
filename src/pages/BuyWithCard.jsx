import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function BuyWithCard({ language = "en" }) {
  const t = language === "ar"
    ? {
        title: "شراء بالبطاقة",
        subtitle: "اشترِ USDT ببطاقة بنكية (قريباً)",
        note: "سيتم تفعيل الشراء بالبطاقة بعد اكتمال مزود الدفع ومتطلبات الامتثال.",
        action: "استخدم الإيداع على السلسلة الآن",
        assets: "الأصول",
        safety: "نصيحة أمان: لا تشارك بيانات بطاقتك خارج الصفحات الرسمية.",
      }
    : {
        title: "Buy with Card",
        subtitle: "Buy USDT with a bank card (coming soon)",
        note: "Card purchases will be enabled after the payment provider and compliance checks are finalized.",
        action: "Use on-chain deposit now",
        assets: "Assets",
        safety: "Safety tip: never share your card details outside official pages.",
      };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-3xl font-bold text-foreground">{t.title}</h1>
          <Badge variant="outline" className="border-border text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5 mr-1" />
            {language === "ar" ? "قريباً" : "Coming soon"}
          </Badge>
        </div>
        <p className="text-muted-foreground mb-8">{t.subtitle}</p>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              {language === "ar" ? "معلومات" : "Info"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t.note}</p>
            <p className="text-xs text-muted-foreground">{t.safety}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <a href={createPageUrl("OnChainDeposit")}>{t.action}</a>
              </Button>
              <Button asChild variant="outline">
                <Link to={createPageUrl("Profile") + "?tab=assets&assetTab=main"}>{t.assets}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

BuyWithCard.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};
