import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Scale, Mail, Phone, FileText, AlertTriangle } from "lucide-react";

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

export default function TermsOfService({ language = "en" }) {
  const isRTL = language === "ar";

  const t = {
    en: {
      badge: "Terms of Service",
      title: "Terms of Service",
      subtitle:
        "These Terms govern your access to and use of the NextTrade website and applications. Please read them carefully.",
      effective: `Effective date: ${formatEffectiveDate("en")}`,
      contactTitle: "Contact",
      contactText:
        "Questions about these Terms? Contact us:",
      warningTitle: "Important Risk Notice",
      warningText:
        "Crypto assets are volatile and trading involves risk, including possible loss of principal. Nothing in the Service is financial, investment, or legal advice.",
      sections: [
        {
          title: "1. Acceptance of Terms",
          body: [
            "By accessing or using the Service, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the Service.",
          ],
        },
        {
          title: "2. Eligibility",
          body: [
            "You must be legally capable of entering into a binding agreement and comply with all applicable laws in your jurisdiction.",
            "The Service is not intended for children.",
          ],
        },
        {
          title: "3. The Service",
          body: [
            "NextTrade provides tools and interfaces that may include market information, portfolio views, and integrations with third-party providers.",
            "Certain features may require creating an account or connecting a supported wallet.",
          ],
        },
        {
          title: "4. Third-Party Services & Wallets",
          body: [
            "The Service may integrate with third-party platforms (including wallet connection providers and blockchain networks).",
            "Your use of third-party services is subject to their terms and privacy practices. We are not responsible for third-party services.",
            "You are solely responsible for safeguarding your wallet credentials, private keys, and seed phrases.",
          ],
        },
        {
          title: "5. User Responsibilities",
          body: [
            "You agree to:",
            "• Provide accurate information when requested.",
            "• Keep your account credentials secure.",
            "• Use the Service only for lawful purposes.",
            "• Understand that blockchain transactions are typically irreversible.",
          ],
        },
        {
          title: "6. Prohibited Activities",
          body: [
            "You may not:",
            "• Use the Service for illegal activities (including fraud, money laundering, or sanctions violations).",
            "• Interfere with or disrupt the Service, systems, or security.",
            "• Attempt to gain unauthorized access to any accounts, data, or networks.",
            "• Reverse engineer, scrape, or misuse the Service in a way that violates applicable law.",
          ],
        },
        {
          title: "7. Fees",
          body: [
            "Some features may involve fees (e.g., network fees on blockchain transactions). Fees, if any, may be presented within the Service.",
          ],
        },
        {
          title: "8. Disclaimers",
          body: [
            "THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.",
            "We do not guarantee that the Service will be uninterrupted, error-free, or secure.",
            "Market data, prices, and other information may be delayed or inaccurate.",
          ],
        },
        {
          title: "9. Limitation of Liability",
          body: [
            "TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEXTTRADE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, OR DIGITAL ASSETS.",
            "Some jurisdictions do not allow certain limitations; in that case, the limitation applies to the fullest extent permitted.",
          ],
        },
        {
          title: "10. Suspension & Termination",
          body: [
            "We may suspend or terminate access to the Service if we reasonably believe you have violated these Terms or if needed for security or legal reasons.",
          ],
        },
        {
          title: "11. Changes to the Service or Terms",
          body: [
            "We may modify the Service or these Terms from time to time. We will post updated Terms and update the effective date.",
            "Your continued use of the Service after changes become effective constitutes acceptance of the updated Terms.",
          ],
        },
        {
          title: "12. Governing Law",
          body: [
            "These Terms are governed by applicable laws, subject to any mandatory consumer protection laws that apply in your jurisdiction.",
          ],
        },
      ],
      email: "support@nexttrade.app",
      phone: "+963940632191",
    },
    ar: {
      badge: "شروط الخدمة",
      title: "شروط الخدمة",
      subtitle:
        "تحكم هذه الشروط وصولك إلى موقع وتطبيقات NextTrade واستخدامك لها. يرجى قراءتها بعناية.",
      effective: `تاريخ السريان: ${formatEffectiveDate("ar")}`,
      contactTitle: "التواصل",
      contactText: "هل لديك أسئلة حول هذه الشروط؟ تواصل معنا:",
      warningTitle: "تنبيه مهم حول المخاطر",
      warningText:
        "الأصول الرقمية شديدة التقلب، والتداول ينطوي على مخاطر بما في ذلك احتمال خسارة رأس المال. لا تشكّل أي معلومات داخل الخدمة نصيحة مالية أو استثمارية أو قانونية.",
      sections: [
        {
          title: "1. قبول الشروط",
          body: [
            "باستخدامك للخدمة، فإنك توافق على هذه الشروط وعلى سياسة الخصوصية. إذا لم توافق، فلا تستخدم الخدمة.",
          ],
        },
        {
          title: "2. الأهلية",
          body: [
            "يجب أن تكون قادرًا قانونيًا على إبرام اتفاق ملزم وأن تلتزم بجميع القوانين المعمول بها في نطاقك القضائي.",
            "الخدمة غير مخصصة للأطفال.",
          ],
        },
        {
          title: "3. الخدمة",
          body: [
            "تقدم NextTrade أدوات وواجهات قد تتضمن بيانات سوقية وعرض المحفظة وتكاملات مع مزودين من طرف ثالث.",
            "قد تتطلب بعض الميزات إنشاء حساب أو ربط محفظة مدعومة.",
          ],
        },
        {
          title: "4. خدمات الطرف الثالث والمحافظ",
          body: [
            "قد تتكامل الخدمة مع منصات طرف ثالث (بما في ذلك مزودي ربط المحافظ وشبكات البلوكتشين).",
            "يخضع استخدامك لخدمات الطرف الثالث لشروطهم وسياسات الخصوصية الخاصة بهم. لسنا مسؤولين عن خدمات الطرف الثالث.",
            "أنت وحدك المسؤول عن حماية بيانات محفظتك والمفاتيح الخاصة وعبارات الاسترداد.",
          ],
        },
        {
          title: "5. مسؤوليات المستخدم",
          body: [
            "توافق على:",
            "• تقديم معلومات دقيقة عند الطلب.",
            "• حماية بيانات الدخول الخاصة بك.",
            "• استخدام الخدمة لأغراض قانونية فقط.",
            "• فهم أن معاملات البلوكتشين غالبًا غير قابلة للإلغاء.",
          ],
        },
        {
          title: "6. أنشطة محظورة",
          body: [
            "لا يجوز لك:",
            "• استخدام الخدمة في أنشطة غير قانونية (بما في ذلك الاحتيال أو غسل الأموال أو مخالفة العقوبات).",
            "• تعطيل الخدمة أو الأنظمة أو الأمان.",
            "• محاولة الوصول غير المصرح به إلى الحسابات أو البيانات أو الشبكات.",
            "• الهندسة العكسية أو جمع البيانات أو إساءة استخدام الخدمة بشكل يخالف القانون.",
          ],
        },
        {
          title: "7. الرسوم",
          body: [
            "قد تتضمن بعض الميزات رسومًا (مثل رسوم الشبكة لمعاملات البلوكتشين). سيتم عرض الرسوم -إن وجدت- داخل الخدمة.",
          ],
        },
        {
          title: "8. إخلاء المسؤولية",
          body: [
            "تُقدَّم الخدمة \"كما هي\" و\"حسب التوفر\" دون أي ضمانات صريحة أو ضمنية.",
            "لا نضمن أن الخدمة ستكون دون انقطاع أو خالية من الأخطاء أو آمنة تمامًا.",
            "قد تكون بيانات الأسعار والمعلومات السوقية متأخرة أو غير دقيقة.",
          ],
        },
        {
          title: "9. حدود المسؤولية",
          body: [
            "إلى أقصى حد يسمح به القانون، لن تكون NextTrade مسؤولة عن الأضرار غير المباشرة أو العرضية أو الخاصة أو التبعية أو فقدان الأرباح أو البيانات أو الأصول الرقمية.",
            "قد لا تسمح بعض الأنظمة القانونية ببعض القيود؛ وفي هذه الحالة تُطبق القيود إلى أقصى حد مسموح.",
          ],
        },
        {
          title: "10. التعليق أو الإنهاء",
          body: [
            "قد نقوم بتعليق أو إنهاء الوصول للخدمة إذا اعتقدنا بشكل معقول أنك خالفت هذه الشروط أو لأسباب أمنية أو قانونية.",
          ],
        },
        {
          title: "11. تغييرات على الخدمة أو الشروط",
          body: [
            "قد نعدّل الخدمة أو هذه الشروط من وقت لآخر. سننشر الشروط المحدثة ونحدّث تاريخ السريان.",
            "استمرارك باستخدام الخدمة بعد سريان التغييرات يعني موافقتك على الشروط المحدثة.",
          ],
        },
        {
          title: "12. القانون الحاكم",
          body: [
            "تخضع هذه الشروط للقوانين المعمول بها، مع مراعاة أي قوانين حماية مستهلك إلزامية تنطبق في نطاقك القضائي.",
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
          <div className="absolute w-96 h-96 bg-purple-500 rounded-full blur-3xl -top-24 -left-24" />
          <div className="absolute w-96 h-96 bg-cyan-500 rounded-full blur-3xl -bottom-24 -right-24" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-6 border border-white/20">
            <Scale className="w-8 h-8 text-cyan-200" />
          </div>
          <Badge className="mb-5 bg-white/10 text-white border-white/20 backdrop-blur-sm px-4 py-2">
            {t.badge}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.title}</h1>
          <p className="text-base md:text-lg text-gray-300 max-w-3xl mx-auto">{t.subtitle}</p>
          <p className="mt-4 text-sm text-gray-400">{t.effective}</p>
        </div>
      </section>

      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-1" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">{t.warningTitle}</h2>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{t.warningText}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="pb-12 px-4 sm:px-6 lg:px-8">
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

TermsOfService.propTypes = {
  language: PropTypes.oneOf(["en", "ar"]),
};
