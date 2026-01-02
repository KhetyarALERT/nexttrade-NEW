import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Clock,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import PropTypes from "prop-types";

export default function Contact({ language = "en" }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    accountType: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const phoneNumber = "+963940632191";
  const emailAddress = "support@nexttrade.app";

  const content = {
    en: {
      hero: {
        title: "Get Started with NextTrade",
        subtitle: "Open your NextTrade account today and access intelligent trading with zero commission",
      },
      form: {
        title: "Open Your Trading Account",
        subtitle: "Fill in the form below and our team will contact you within 24 hours",
        name: "Full Name",
        namePlaceholder: "John Doe",
        email: "Email Address",
        emailPlaceholder: "john@example.com",
        phone: "Phone Number",
        phonePlaceholder: "+963 XXX XXX XXX",
        accountType: "Account Type",
        accountTypePlaceholder: "Select account type",
        accountTypes: {
          demo: "Demo Account",
          live: "Live Account",
          islamic: "Islamic Account",
        },
        message: "Message (Optional)",
        messagePlaceholder: "Tell us about your trading experience...",
        submit: "Open Account",
        submitting: "Processing...",
      },
      info: [
        {
          icon: Phone,
          title: "Phone",
          content: phoneNumber,
          desc: "Mon-Fri: 9AM - 6PM (GMT+3)",
        },
        {
          icon: Mail,
          title: "Email",
          content: emailAddress,
          desc: "We'll respond within 24 hours",
        },
        {
          icon: MapPin,
          title: "Office",
          content: "Istanbul, Turkey",
          desc: "Multiple branches across Turkey",
        },
        {
          icon: Clock,
          title: "Trading Hours",
          content: "24/5 Market Access",
          desc: "Sunday 10PM - Friday 10PM GMT",
        },
      ],
      benefits: {
        title: "Why Open an Account with Us?",
        items: [
          "Zero commission on all trades",
          "Ultra-low spreads from 0.1 pips",
          "Islamic swap-free accounts",
          "Instant deposits and withdrawals",
          "Dedicated account manager",
          "Free educational resources",
        ],
      },
      success: "Thank you! We'll contact you within 24 hours.",
      error: "Please fill in all required fields.",
    },
    ar: {
      hero: {
        title: "ابدأ مع NextTrade",
        subtitle: "افتح حساب NextTrade اليوم وتمتع بتداول ذكي بدون عمولة",
      },
      form: {
        title: "افتح حساب التداول الخاص بك",
        subtitle: "املأ النموذج أدناه وسيتصل بك فريقنا خلال 24 ساعة",
        name: "الاسم الكامل",
        namePlaceholder: "أحمد محمد",
        email: "البريد الإلكتروني",
        emailPlaceholder: "ahmad@example.com",
        phone: "رقم الهاتف",
        phonePlaceholder: "+963 XXX XXX XXX",
        accountType: "نوع الحساب",
        accountTypePlaceholder: "اختر نوع الحساب",
        accountTypes: {
          demo: "حساب تجريبي",
          live: "حساب حقيقي",
          islamic: "حساب إسلامي",
        },
        message: "رسالة (اختياري)",
        messagePlaceholder: "أخبرنا عن خبرتك في التداول...",
        submit: "فتح حساب",
        submitting: "جاري المعالجة...",
      },
      info: [
        {
          icon: Phone,
          title: "الهاتف",
          content: phoneNumber,
          desc: "الإثنين-الجمعة: 9 صباحاً - 6 مساءً (GMT+3)",
        },
        {
          icon: Mail,
          title: "البريد الإلكتروني",
          content: emailAddress,
          desc: "سنرد عليك خلال 24 ساعة",
        },
        {
          icon: MapPin,
          title: "المكتب",
          content: "اسطنبول، تركيا",
          desc: "فروع متعددة في أنحاء تركيا",
        },
        {
          icon: Clock,
          title: "ساعات التداول",
          content: "الوصول إلى السوق 24/5",
          desc: "الأحد 10 مساءً - الجمعة 10 مساءً GMT",
        },
      ],
      benefits: {
        title: "لماذا تفتح حساباً معنا؟",
        items: [
          "بدون عمولة على جميع الصفقات",
          "فروقات أسعار منخفضة جداً من 0.1 نقطة",
          "حسابات إسلامية خالية من الفوائد",
          "إيداعات وسحوبات فورية",
          "مدير حساب متخصص",
          "موارد تعليمية مجانية",
        ],
      },
      success: "شكراً لك! سنتصل بك خلال 24 ساعة.",
      error: "يرجى ملء جميع الحقول المطلوبة.",
    },
  };

  const t = content[language];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone || !formData.accountType) {
      toast.error(t.error);
      return;
    }

    setIsSubmitting(true);

    try {
      // Send email with form data
      await base44.integrations.Core.SendEmail({
        to: emailAddress,
        subject: `New Account Request - ${formData.name}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 24px; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: white;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700;">NextTrade</h1>
              <p style="margin: 8px 0 0; font-size: 16px;">New Account Request</p>
            </div>
            <div style="padding: 30px; background: #f9fafb;">
              <h2 style="color: #1f2937; margin-bottom: 20px;">Client Information</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px 0; font-weight: bold; color: #4b5563;">Name:</td>
                  <td style="padding: 12px 0; color: #1f2937;">${formData.name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px 0; font-weight: bold; color: #4b5563;">Email:</td>
                  <td style="padding: 12px 0; color: #1f2937;">${formData.email}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px 0; font-weight: bold; color: #4b5563;">Phone:</td>
                  <td style="padding: 12px 0; color: #1f2937;">${formData.phone}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px 0; font-weight: bold; color: #4b5563;">Account Type:</td>
                  <td style="padding: 12px 0; color: #1f2937;">${formData.accountType}</td>
                </tr>
                ${formData.message ? `
                <tr>
                  <td style="padding: 12px 0; font-weight: bold; color: #4b5563; vertical-align: top;">Message:</td>
                  <td style="padding: 12px 0; color: #1f2937;">${formData.message}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            <div style="text-align: center; padding: 20px; background: #f3f4f6; color: #6b7280; font-size: 12px;">
              <p>This email was sent from the NextTrade contact form.</p>
            </div>
          </div>
        `
      });

      toast.success(t.success);
      setFormData({
        name: "",
        email: "",
        phone: "",
        accountType: "",
        message: "",
      });
    } catch (err) {
      toast.error(err?.message || "Failed to submit form. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute w-96 h-96 bg-blue-500 rounded-full blur-3xl top-0 left-0 animate-pulse" />
          <div className="absolute w-96 h-96 bg-cyan-500 rounded-full blur-3xl bottom-0 right-0 animate-pulse" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">{t.hero.title}</h1>
          <p className="text-xl text-gray-300">{t.hero.subtitle}</p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border-0 shadow-2xl">
                <CardContent className="p-8">
                  <h2 className="text-3xl font-bold mb-2 text-gray-900">{t.form.title}</h2>
                  <p className="text-gray-600 mb-8">{t.form.subtitle}</p>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <Label htmlFor="name" className="text-base font-medium">
                        {t.form.name} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t.form.namePlaceholder}
                        className="mt-2 h-12"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="email" className="text-base font-medium">
                        {t.form.email} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder={t.form.emailPlaceholder}
                        className="mt-2 h-12"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone" className="text-base font-medium">
                        {t.form.phone} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder={t.form.phonePlaceholder}
                        className="mt-2 h-12"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="accountType" className="text-base font-medium">
                        {t.form.accountType} <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.accountType}
                        onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                      >
                        <SelectTrigger className="mt-2 h-12">
                          <SelectValue placeholder={t.form.accountTypePlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="demo">{t.form.accountTypes.demo}</SelectItem>
                          <SelectItem value="live">{t.form.accountTypes.live}</SelectItem>
                          <SelectItem value="islamic">{t.form.accountTypes.islamic}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="message" className="text-base font-medium">
                        {t.form.message}
                      </Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder={t.form.messagePlaceholder}
                        className="mt-2 min-h-[120px]"
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      {isSubmitting ? (
                        t.form.submitting
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          {t.form.submit}
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Contact Info & Benefits */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Contact Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {t.info.map((item, idx) => {
                  const Icon = item.icon;
                  const isPhone = item.icon === Phone;
                  const isEmail = item.icon === Mail;
                  
                  return (
                    <Card key={idx} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                      <CardContent className="p-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center mb-4">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                        
                        {isPhone ? (
                          <div className="space-y-2">
                            <p className="text-blue-600 font-medium mb-1">{item.content}</p>
                            <div className="flex gap-2">
                              <a 
                                href={`tel:${phoneNumber}`}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                              >
                                <Phone className="w-4 h-4" />
                                {language === "en" ? "Call" : "اتصل"}
                              </a>
                              <a 
                                href={`https://wa.me/${phoneNumber.replace(/\+/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                                WhatsApp
                              </a>
                            </div>
                          </div>
                        ) : isEmail ? (
                          <div>
                            <a href={`mailto:${emailAddress}`} className="text-blue-600 font-medium mb-1 hover:underline">
                              {item.content}
                            </a>
                          </div>
                        ) : (
                          <p className="text-blue-600 font-medium mb-1">{item.content}</p>
                        )}
                        
                        <p className="text-sm text-gray-600">{item.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Benefits */}
              <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-50 to-blue-50">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-6 text-gray-900">{t.benefits.title}</h3>
                  <div className="space-y-4">
                    {t.benefits.items.map((benefit, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center gap-3"
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-gray-700 font-medium">{benefit}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}