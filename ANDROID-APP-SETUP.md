# تجهيز تطبيق أثير لنظام Android (Capacitor)

هذا المجلد يضيف إعداد Capacitor الأساسي إلى مشروع متجر أثير مع الإبقاء على صفحات الموقع الحالية داخل `public/` والواجهة الخلفية داخل `backend/`.

## الهوية
- اسم التطبيق: أثير
- Android application ID: `com.atheer.store`
- واجهات الويب: `public/`
- الخادم وقاعدة البيانات: تبقى خارج التطبيق كما هي، ولا تُضمّن بيانات الاتصال السرية داخل التطبيق.

## متطلبات البناء
- Node.js 20 أو أحدث
- Android Studio وAndroid SDK
- Java/JDK المتوافق مع إصدار Android Gradle Plugin الذي ينشئه Capacitor

## إنشاء مشروع Android محلياً
من مجلد المشروع:

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

بعد فتح المشروع في Android Studio، اختبره على جهاز حقيقي قبل تجهيز نسخة Google Play.

## قبل اعتماد التطبيق النهائي
1. **عنوان API المعتمد:** `https://nesma-store.onrender.com`، وهو خادم تسجيل الدخول وGoogle OAuth وواجهات API. لا تستبدله بعنوان Cloudflare Pages.
2. **واجهة المتجر:** `https://atheer-store.pages.dev/`، وهي وجهة العودة الحالية بعد نجاح تسجيل الدخول على الويب.
3. **Google OAuth داخل التطبيق:** الكود الحالي يعيد المستخدم إلى `https://atheer-store.pages.dev/login.html#oauth_token=...`. هذا مناسب لمسار الويب، لكنه لا يعيد الجلسة تلقائيًا إلى مساحة تخزين تطبيق Capacitor. يلزم تنفيذ مسار deep link للتطبيق وتحديث `backend/auth.js` ثم نشر الخادم المحدّث، مع تسجيل callback الأصلي في إعدادات Google عند الحاجة.
4. تنفيذ ربط JavaScript مع إضافات Capacitor للإشعارات الفورية، وحالة الشبكة، والمشاركة، والتعامل مع روابط الإحالة. وجود الإضافات في `package.json` وحده لا يعني أن هذه الميزات مفعّلة بعد.
5. إعداد خدمة إرسال Push Notifications ومفاتيحها في الخادم؛ التطبيق وحده لا يستطيع إرسال إشعارات عن بُعد دون خدمة إرسال.
6. إنشاء أيقونات Android وشاشة البداية، وإعداد روابط التطبيق والتحقق من الروابط.
7. إنشاء توقيع إصدار Android App Bundle (`.aab`) واختباره قبل رفعه إلى Google Play.

## تنبيه أمني
لا تضع مفاتيح قاعدة البيانات أو أسرار OAuth أو مفاتيح الخادم داخل تطبيق Android. يجب أن تمر عمليات الطلبات والحسابات عبر API الخادم.
