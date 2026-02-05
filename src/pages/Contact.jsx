import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Headphones,
  Send,
  CheckCircle,
  MessageCircle,
  Users,
  Mail,
  Briefcase,
  HelpCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

// Telegram links
const TELEGRAM_SUPPORT = "https://t.me/NextTradeSupport";
const TELEGRAM_COMMUNITY = "https://t.me/NextTradeCommunity";

export default function Contact({ language = "en" }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  
  // Support ticket form state
  const [supportForm, setSupportForm] = useState({
    category: "",
    message: "",
  });
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [ticketCreated, setTicketCreated] = useState(null); // { reference: "#ABC123" }

  // Business form state
  const [businessForm, setBusinessForm] = useState({
    name: "",
    email: "",
    company: "",
    type: "",
    message: "",
  });
  const [businessSubmitting, setBusinessSubmitting] = useState(false);
  const [businessSuccess, setBusinessSuccess] = useState(false);

  const isAr = language === "ar";

  const t = {
    en: {
      hero: {
        title: "Support & Contact",
        subtitle: "Get help with your account or reach out for partnerships",
      },
      support: {
        title: "Need Help?",
        subtitle: "Create a support ticket and we'll respond within 24 hours",
        category: "Category",
        categoryPlaceholder: "Select category",
        categories: {
          kyc: "KYC / Verification",
          deposit: "Deposits",
          withdraw: "Withdrawals",
          trading: "Trading",
          copy_trading: "Copy Trading",
          staking: "Staking",
          rewards: "Rewards",
          general: "General Question",
        },
        message: "Message",
        messagePlaceholder: "Describe your issue in detail...",
        submit: "Submit Ticket",
        submitting: "Submitting...",
        loginRequired: "Please login to submit a support ticket",
        loginButton: "Login",
        success: "Ticket Created!",
        successDesc: "Your ticket has been created. We'll respond within 24 hours.",
        reference: "Reference",
        viewTickets: "View My Tickets",
        newTicket: "New Ticket",
      },
      telegram: {
        title: "Quick Support",
        subtitle: "Get faster help via Telegram",
        supportBot: "Support Bot",
        supportDesc: "Direct chat with our support team",
        community: "Community",
        communityDesc: "Join our trading community",
      },
      business: {
        title: "Business & Partnerships",
        subtitle: "For enterprise inquiries, partnerships, and media",
        name: "Full Name",
        namePlaceholder: "John Doe",
        email: "Email Address",
        emailPlaceholder: "john@company.com",
        company: "Company",
        companyPlaceholder: "Company name",
        type: "Inquiry Type",
        typePlaceholder: "Select type",
        types: {
          partnership: "Partnership",
          enterprise: "Enterprise Solutions",
          media: "Media Inquiry",
          listing: "Token Listing",
          other: "Other",
        },
        message: "Message",
        messagePlaceholder: "Tell us about your inquiry...",
        submit: "Send Message",
        submitting: "Sending...",
        success: "Message sent! We'll be in touch soon.",
        error: "Please fill in all required fields.",
      },
      helpCenter: {
        title: "Self-Service",
        subtitle: "Find answers in our Help Center",
        button: "Visit Help Center",
      },
    },
    ar: {
      hero: {
        title: "الدعم والتواصل",
        subtitle: "احصل على مساعدة بحسابك أو تواصل معنا للشراكات",
      },
      support: {
        title: "تحتاج مساعدة؟",
        subtitle: "أنشئ تذكرة دعم وسنرد خلال 24 ساعة",
        category: "التصنيف",
        categoryPlaceholder: "اختر التصنيف",
        categories: {
          kyc: "التوثيق / KYC",
          deposit: "الإيداعات",
          withdraw: "السحوبات",
          trading: "التداول",
          copy_trading: "نسخ التداول",
          staking: "الستيكينغ",
          rewards: "المكافآت",
          general: "سؤال عام",
        },
        message: "الرسالة",
        messagePlaceholder: "اشرح مشكلتك بالتفصيل...",
        submit: "إرسال التذكرة",
        submitting: "جاري الإرسال...",
        loginRequired: "يرجى تسجيل الدخول لإرسال تذكرة دعم",
        loginButton: "تسجيل الدخول",
        success: "تم إنشاء التذكرة!",
        successDesc: "تم إنشاء تذكرتك. سنرد خلال 24 ساعة.",
        reference: "الرقم المرجعي",
        viewTickets: "عرض تذاكري",
        newTicket: "تذكرة جديدة",
      },
      telegram: {
        title: "دعم سريع",
        subtitle: "احصل على مساعدة أسرع عبر تيليجرام",
        supportBot: "بوت الدعم",
        supportDesc: "محادثة مباشرة مع فريق الدعم",
        community: "المجتمع",
        communityDesc: "انضم لمجتمع التداول",
      },
      business: {
        title: "الأعمال والشراكات",
        subtitle: "للاستفسارات المؤسسية والشراكات والإعلام",
        name: "الاسم الكامل",
        namePlaceholder: "أحمد محمد",
        email: "البريد الإلكتروني",
        emailPlaceholder: "ahmad@company.com",
        company: "الشركة",
        companyPlaceholder: "اسم الشركة",
        type: "نوع الاستفسار",
        typePlaceholder: "اختر النوع",
        types: {
          partnership: "شراكة",
          enterprise: "حلول المؤسسات",
          media: "استفسار إعلامي",
          listing: "إدراج عملة",
          other: "أخرى",
        },
        message: "الرسالة",
        messagePlaceholder: "أخبرنا عن استفسارك...",
        submit: "إرسال",
        submitting: "جاري الإرسال...",
        success: "تم إرسال الرسالة! سنتواصل معك قريباً.",
        error: "يرجى ملء جميع الحقول المطلوبة.",
      },
      helpCenter: {
        title: "الخدمة الذاتية",
        subtitle: "ابحث عن إجابات في مركز المساعدة",
        button: "زيارة مركز المساعدة",
      },
    },
  }[language];

  // Handle support ticket submission
  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    
    if (!supportForm.category || !supportForm.message.trim()) {
      toast.error(language === "ar" ? "يرجى ملء جميع الحقول" : "Please fill in all fields");
      return;
    }

    setSupportSubmitting(true);
    
    try {
      const res = await base44.functions.invoke("createSupportTicket", {
        category: supportForm.category,
        user_message: supportForm.message.trim(),
        source_route: "/Contact",
        language,
      });
      
      if (res.data?.ok) {
        setTicketCreated({ reference: res.data.reference });
        setSupportForm({ category: "", message: "" });
        toast.success(t.support.success);
      } else {
        throw new Error(res.data?.error || "Failed to create ticket");
      }
    } catch (err) {
      toast.error(err.message || "Failed to submit ticket");
    } finally {
      setSupportSubmitting(false);
    }
  };

  // Handle business form submission
  const handleBusinessSubmit = async (e) => {
    e.preventDefault();
    
    if (!businessForm.name || !businessForm.email || !businessForm.type || !businessForm.message) {
      toast.error(t.business.error);
      return;
    }

    setBusinessSubmitting(true);

    try {
      await base44.integrations.Core.SendEmail({
        to: "partnerships@nexttrade.exchange",
        subject: `[Business Inquiry] ${businessForm.type} - ${businessForm.company || businessForm.name}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Business Inquiry</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Name:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${businessForm.name}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${businessForm.email}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Company:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${businessForm.company || "-"}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Type:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${businessForm.type}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">Message:</td><td style="padding: 8px;">${businessForm.message}</td></tr>
            </table>
          </div>
        `,
      });

      toast.success(t.business.success);
      setBusinessSuccess(true);
      setBusinessForm({ name: "", email: "", company: "", type: "", message: "" });
    } catch (err) {
      toast.error(err?.message || "Failed to send message");
    } finally {
      setBusinessSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-background ${isAr ? "rtl" : "ltr"}`} dir={isAr ? "rtl" : "ltr"}>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.hero.title}</h1>
          <p className="text-lg text-white/70">{t.hero.subtitle}</p>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Left Column - Support */}
          <div className="space-y-6">
            {/* Help Center Quick Link */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold text-foreground">{t.helpCenter.title}</h3>
                    <p className="text-sm text-muted-foreground">{t.helpCenter.subtitle}</p>
                  </div>
                </div>
                <Button asChild variant="outline">
                  <Link to={createPageUrl("Help")}>
                    {t.helpCenter.button}
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Support Ticket Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-primary" />
                  {t.support.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t.support.subtitle}</p>
              </CardHeader>
              <CardContent>
                {!isAuthenticated && !isLoadingAuth ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">{t.support.loginRequired}</p>
                    <Button onClick={() => base44.auth.redirectToLogin()}>
                      {t.support.loginButton}
                    </Button>
                  </div>
                ) : ticketCreated ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{t.support.success}</h3>
                    <p className="text-muted-foreground mb-4">{t.support.successDesc}</p>
                    <Badge variant="outline" className="text-lg px-4 py-2 mb-6">
                      {t.support.reference}: {ticketCreated.reference}
                    </Badge>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button asChild variant="outline">
                        <Link to={`${createPageUrl("Profile")}?tab=support`}>
                          {t.support.viewTickets}
                        </Link>
                      </Button>
                      <Button onClick={() => setTicketCreated(null)}>
                        {t.support.newTicket}
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSupportSubmit} className="space-y-4">
                    <div>
                      <Label>{t.support.category} *</Label>
                      <Select
                        value={supportForm.category}
                        onValueChange={(v) => setSupportForm({ ...supportForm, category: v })}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder={t.support.categoryPlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(t.support.categories).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>{t.support.message} *</Label>
                      <Textarea
                        value={supportForm.message}
                        onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })}
                        placeholder={t.support.messagePlaceholder}
                        className="mt-1.5 min-h-[120px]"
                        style={{ fontSize: "16px" }}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={supportSubmitting}>
                      {supportSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.support.submitting}
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          {t.support.submit}
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Telegram Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-[#0088cc]" />
                  {t.telegram.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t.telegram.subtitle}</p>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <a
                  href={TELEGRAM_SUPPORT}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-[#0088cc]/50 hover:bg-[#0088cc]/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-[#0088cc]/10 flex items-center justify-center">
                    <Headphones className="h-5 w-5 text-[#0088cc]" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{t.telegram.supportBot}</div>
                    <div className="text-sm text-muted-foreground">{t.telegram.supportDesc}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>

                <a
                  href={TELEGRAM_COMMUNITY}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-[#0088cc]/50 hover:bg-[#0088cc]/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-[#0088cc]/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-[#0088cc]" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{t.telegram.community}</div>
                    <div className="text-sm text-muted-foreground">{t.telegram.communityDesc}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Business */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  {t.business.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t.business.subtitle}</p>
              </CardHeader>
              <CardContent>
                {businessSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-12"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{t.business.success}</h3>
                    <Button onClick={() => setBusinessSuccess(false)} variant="outline" className="mt-4">
                      {language === "ar" ? "إرسال استفسار آخر" : "Send Another Inquiry"}
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleBusinessSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label>{t.business.name} *</Label>
                        <Input
                          value={businessForm.name}
                          onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
                          placeholder={t.business.namePlaceholder}
                          className="mt-1.5"
                          style={{ fontSize: "16px" }}
                        />
                      </div>
                      <div>
                        <Label>{t.business.email} *</Label>
                        <Input
                          type="email"
                          value={businessForm.email}
                          onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })}
                          placeholder={t.business.emailPlaceholder}
                          className="mt-1.5"
                          style={{ fontSize: "16px" }}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>{t.business.company}</Label>
                      <Input
                        value={businessForm.company}
                        onChange={(e) => setBusinessForm({ ...businessForm, company: e.target.value })}
                        placeholder={t.business.companyPlaceholder}
                        className="mt-1.5"
                        style={{ fontSize: "16px" }}
                      />
                    </div>

                    <div>
                      <Label>{t.business.type} *</Label>
                      <Select
                        value={businessForm.type}
                        onValueChange={(v) => setBusinessForm({ ...businessForm, type: v })}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder={t.business.typePlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(t.business.types).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>{t.business.message} *</Label>
                      <Textarea
                        value={businessForm.message}
                        onChange={(e) => setBusinessForm({ ...businessForm, message: e.target.value })}
                        placeholder={t.business.messagePlaceholder}
                        className="mt-1.5 min-h-[120px]"
                        style={{ fontSize: "16px" }}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={businessSubmitting}>
                      {businessSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.business.submitting}
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          {t.business.submit}
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

Contact.propTypes = {
  language: PropTypes.string,
};