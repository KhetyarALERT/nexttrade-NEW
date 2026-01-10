import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Mail, Phone, FileText } from "lucide-react";

const EFFECTIVE_DATE_ISO = "2026-01-10";

function formatEffectiveDate(language) {
  const date = new Date(EFFECTIVE_DATE_ISO + "T00:00:00Z");
  try {
    return date.toLocaleDateString(language === "ar" ? "ar" : undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return EFFECTIVE_DATE_ISO;
  }
}

export default function PrivacyPolicy({ language = "en" }) {
  const isRTL = language === "ar";

  const t = {
    en: {
      badge: "Privacy Policy",
      title: "Privacy Policy",
      subtitle:
        "This Privacy Policy explains how NextTrade collects, uses, shares, and protects your information when you use our website and applications.",
      effective: `Effective date: ${formatEffectiveDate("en")}`,
      contactTitle: "Contact",
      contactText:
        "If you have questions about privacy, data requests, or this policy, contact us:",
      sections: [
        {
          title: "1. Who We Are",
          body: [
            "NextTrade (\"we\", \"us\", \"our\") provides a crypto trading and portfolio experience through our website and applications (the \"Service\").",
          ],
        },
        {
          title: "2. Information We Collect",
          body: [
            "We collect information in the following categories:",
            "• Account & profile data: name, email, and other details you provide.",
            "• Authentication data: login/session tokens and security-related signals.",
            "• Wallet data: public wallet addresses and connection status when you connect a Web3 wallet (we do not collect your private keys or seed phrase).",
            "• Transaction & usage data: interactions with the Service, such as pages viewed, feature usage, and order/transaction metadata you submit.",
            "• Device & log data: IP address, device identifiers, browser type, app version, timestamps, and diagnostic logs.",
            "• Support communications: information you share when contacting support.",
          ],
        },
        {
          title: "3. How We Use Information",
          body: [
            "We use information to:",
            "• Provide, operate, and maintain the Service.",
            "• Authenticate users and secure accounts.",
            "• Process your requests and actions within the Service.",
            "• Improve performance, reliability, and user experience.",
            "• Communicate with you about updates, security, and support.",
            "• Detect, prevent, and investigate fraud, abuse, and security incidents.",
            "• Comply with legal obligations (where applicable).",
          ],
        },
        {
          title: "4. How We Share Information",
          body: [
            "We may share information:",
            "• With service providers that help us operate the Service (hosting, analytics, customer support, security).",
            "• With integrated partners you choose to use (e.g., wallet connection providers) to enable the Service features.",
            "• For legal reasons if required to comply with law, enforce agreements, or protect rights and safety.",
            "• In connection with a business transaction (e.g., merger, acquisition) subject to appropriate safeguards.",
            "We do not sell your personal information.",
          ],
        },
        {
          title: "5. Cookies & Similar Technologies",
          body: [
            "We use cookies and similar technologies to keep you signed in, remember preferences, and understand how the Service is used.",
            "You can control cookies through your browser settings. Some features may not work properly if cookies are disabled.",
          ],
        },
        {
          title: "6. Data Retention",
          body: [
            "We retain information for as long as needed to provide the Service and for legitimate business purposes (such as security, dispute resolution, and compliance), unless a longer retention period is required by law.",
          ],
        },
        {
          title: "7. Security",
          body: [
            "We use administrative, technical, and physical safeguards designed to protect information.",
            "No system is 100% secure. You are responsible for maintaining the confidentiality of your credentials and device security.",
          ],
        },
        {
          title: "8. Your Rights & Choices",
          body: [
            "Depending on your location, you may have rights to access, correct, delete, or obtain a copy of your personal information, or object/restrict certain processing.",
            "To make a request, contact us using the details below.",
          ],
        },
        {
          title: "9. International Transfers",
          body: [
            "Your information may be processed in countries other than your own. Where required, we use appropriate safeguards for international transfers.",
          ],
        },
        {
          title: "10. Children’s Privacy",
          body: [
            "The Service is not intended for children. We do not knowingly collect personal information from children.",
          ],
        },
        {
          title: "11. Changes to This Policy",
          body: [
            "We may update this Privacy Policy from time to time. We will post the updated policy and update the effective date above.",
          ],
        },
      ],
      email: "support@nexttrade.app",
      phone: "+963940632191",
    },
    ar: {
      badge: "سياسة الخصوصية",
      title: "سياسة الخصوصية",
      subtitle:
        "توضح سياسة الخصوصية هذه كيف تقوم NextTrade بجمع معلوماتك واستخدامها ومشاركتها وحمايتها عند استخدام موقعنا وتطبيقاتنا.",
      effective: `تاريخ السريان: ${formatEffectiveDate("ar")}`,
      contactTitle: "التواصل",
      contactText:
        "لأي استفسارات حول الخصوصية أو طلبات البيانات أو هذه السياسة، تواصل معنا:",
      sections: [
        {
          title: "1. من نحن",
          body: [
            "تقدم NextTrade (\"نحن\" / \"لنا\") تجربة تداول وإدارة أصول العملات الرقمية عبر الموقع والتطبيقات (\"الخدمة\").",
          ],
        },
        {
          title: "2. المعلومات التي نجمعها",
          body: [
            "نجمع معلومات ضمن الفئات التالية:",
            "• بيانات الحساب والملف الشخصي: الاسم والبريد الإلكتروني وأي بيانات تقدمها.",
            "• بيانات المصادقة: رموز تسجيل الدخول/الجلسات وإشارات مرتبطة بالأمان.",
            "• بيانات المحفظة: عناوين المحافظ العامة وحالة الاتصال عند ربط محفظة Web3 (لا نجمع المفاتيح الخاصة أو عبارة الاسترداد).",
            "• بيانات الاستخدام والمعاملات: تفاعلاتك مع الخدمة مثل الصفحات التي تزورها وبيانات الأوامر/المعاملات التي ترسلها.",
            "• بيانات الجهاز والسجلات: عنوان IP ومعرّفات الجهاز ونوع المتصفح وإصدار التطبيق والطوابع الزمنية وسجلات التشخيص.",
            "• مراسلات الدعم: المعلومات التي تشاركها عند التواصل مع الدعم.",
          ],
        },
        {
          title: "3. كيفية استخدام المعلومات",
          body: [
            "نستخدم المعلومات من أجل:",
            "• تقديم الخدمة وتشغيلها وصيانتها.",
            "• مصادقة المستخدمين وتأمين الحسابات.",
            "• تنفيذ طلباتك وإجراءاتك داخل الخدمة.",
            "• تحسين الأداء والموثوقية وتجربة الاستخدام.",
            "• التواصل معك بشأن التحديثات والأمان والدعم.",
            "• اكتشاف ومنع والتحقيق في الاحتيال وسوء الاستخدام والحوادث الأمنية.",
            "• الامتثال للالتزامات القانونية (عند الانطباق).",
          ],
        },
        {
          title: "4. كيفية مشاركة المعلومات",
          body: [
            "قد نشارك المعلومات:",
            "• مع مزودي خدمات يساعدوننا على تشغيل الخدمة (الاستضافة، التحليلات، الدعم، الأمان).",
            "• مع الشركاء الذين تختار استخدامهم (مثل مزودي ربط المحافظ) لتمكين ميزات الخدمة.",
            "• لأسباب قانونية للامتثال للقانون أو إنفاذ الاتفاقيات أو حماية الحقوق والسلامة.",
            "• ضمن معاملة تجارية (مثل دمج/استحواذ) مع تطبيق ضمانات مناسبة.",
            "نحن لا نبيع معلوماتك الشخصية.",
          ],
        },
        {
          title: "5. ملفات تعريف الارتباط والتقنيات المشابهة",
          body: [
            "نستخدم ملفات تعريف الارتباط وتقنيات مشابهة للحفاظ على تسجيل الدخول وتذكر التفضيلات وفهم كيفية استخدام الخدمة.",
            "يمكنك التحكم بذلك من إعدادات المتصفح. قد لا تعمل بعض الميزات بشكل صحيح عند تعطيلها.",
          ],
        },
        {
          title: "6. الاحتفاظ بالبيانات",
          body: [
            "نحتفظ بالمعلومات للمدة اللازمة لتقديم الخدمة ولأغراض تجارية مشروعة (مثل الأمان وحل النزاعات والامتثال)، ما لم يتطلب القانون مدة أطول.",
          ],
        },
        {
          title: "7. الأمان",
          body: [
            "نستخدم ضمانات إدارية وتقنية ومادية لحماية المعلومات.",
            "لا يوجد نظام آمن بنسبة 100%. أنت مسؤول عن حماية بيانات الدخول وأمان جهازك.",
          ],
        },
        {
          title: "8. حقوقك وخياراتك",
          body: [
            "بحسب موقعك، قد تكون لديك حقوق للوصول إلى معلوماتك أو تصحيحها أو حذفها أو الحصول على نسخة منها أو الاعتراض/تقييد بعض المعالجة.",
            "لتقديم طلب، تواصل معنا باستخدام معلومات الاتصال أدناه.",
          ],
        },
        {
          title: "9. نقل البيانات دولياً",
          body: [
            "قد تتم معالجة معلوماتك في دول أخرى. عند الحاجة، نستخدم ضمانات مناسبة لعمليات النقل الدولية.",
          ],
        },
        {
          title: "10. خصوصية الأطفال",
          body: [
            "الخدمة غير مخصصة للأطفال، ولا نجمع عن قصد معلومات شخصية من الأطفال.",
          ],
        },
        {
          title: "11. التغييرات على هذه السياسة",
          body: [
            "قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سننشر النسخة المحدثة ونقوم بتحديث تاريخ السريان أعلاه.",
          ],
        },
      ],
      email: "support@nexttrade.app",
      phone: "+963940632191",
    },
  }[language];

  return (
    <div className={`min-h-screen bg-background text-foreground ${isRTL ? "rtl" : "ltr"}`} dir={isRTL ? "rtl" : "ltr"}>
      <section className="relative py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute w-96 h-96 bg-blue-500 rounded-full blur-3xl -top-24 -left-24" />
          <div className="absolute w-96 h-96 bg-cyan-500 rounded-full blur-3xl -bottom-24 -right-24" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-6 border border-white/20">
            <Shield className="w-8 h-8 text-cyan-200" />
          </div>
          <Badge className="mb-5 bg-white/10 text-white border-white/20 backdrop-blur-sm px-4 py-2">
            {t.badge}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.title}</h1>
          <p className="text-base md:text-lg text-gray-300 max-w-3xl mx-auto">{t.subtitle}</p>
          <p className="mt-4 text-sm text-gray-400">{t.effective}</p>
        </div>
      </section>

      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {t.sections.map((section, idx) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(idx * 0.03, 0.2) }}
            >
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-primary mt-1" />
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-foreground mb-3">{section.title}</h2>
                      <div className="space-y-2 text-sm md:text-base text-muted-foreground leading-relaxed">
                        {section.body.map((p) => (
                          <p key={p}>{p}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-3">{t.contactTitle}</h2>
                <p className="text-sm md:text-base text-muted-foreground mb-4">{t.contactText}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 hover:bg-muted/40 transition"
                    href={`mailto:${t.email}`}
                  >
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{t.email}</span>
                  </a>
                  <a
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 hover:bg-muted/40 transition"
                    href={`tel:${t.phone.replace(/\s/g, "")}`}
                  >
                    <Phone className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{t.phone}</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

PrivacyPolicy.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};
