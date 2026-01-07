import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Wallet, ArrowDownToLine, ShieldAlert } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function OnChainDeposit({ language = "en" }) {
  const t = language === "ar"
    ? {
        title: "إيداع على السلسلة",
        subtitle: "أضف رصيداً إلى حسابك عبر إيداع USDT أو عملات أخرى من محفظتك الخارجية.",
        step1: "اختر العملة والشبكة من صفحة الأصول",
        step2: "انسخ عنوان الإيداع وأرسل إليه من محفظتك",
        step3: "تأكد من الشبكة الصحيحة لتجنب فقدان الأموال",
        openAssets: "افتح صفحة الإيداع",
        assets: "الأصول",
        warning: "تحذير: إرسال العملة على شبكة خاطئة قد يؤدي لفقدانها نهائياً.",
      }
    : {
        title: "On-chain Deposit",
        subtitle: "Add funds by depositing USDT (or other supported assets) from your external wallet.",
        step1: "Pick the asset and network from the Assets page",
        step2: "Copy the deposit address and send from your wallet",
        step3: "Double-check the network to avoid permanent loss",
        openAssets: "Open deposit page",
        assets: "Assets",
        warning: "Warning: sending via the wrong network may permanently lose funds.",
      };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 pt-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-3xl font-bold text-foreground">{t.title}</h1>
          <Badge variant="outline" className="border-border text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 mr-1" />
            {language === "ar" ? "الإيداع" : "Deposit"}
          </Badge>
        </div>
        <p className="text-muted-foreground mb-8">{t.subtitle}</p>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">{language === "ar" ? "الخطوات" : "Steps"}</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
              <li>{t.step1}</li>
              <li>{t.step2}</li>
              <li>{t.step3}</li>
            </ol>

            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <ShieldAlert className="h-4 w-4 mt-0.5" />
              <span>{t.warning}</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link to={createPageUrl("Profile") + "?tab=assets&assetTab=main&modal=deposit"}>
                  <ArrowDownToLine className="h-4 w-4 mr-2" />
                  {t.openAssets}
                </Link>
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

OnChainDeposit.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};
