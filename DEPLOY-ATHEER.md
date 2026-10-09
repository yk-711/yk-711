# إعداد نشر متجر أثير | ATHEER

## عنوان الواجهة الأساسي

`https://atheer-store.pages.dev`

## Cloudflare Pages

- Framework preset: `None`
- Build command: اتركه فارغًا لموقع الواجهة الثابتة الحالي.
- Build output directory: `public`
- Root directory: المجلد الذي يحتوي مجلد `public` و`backend` وملف `README.md`؛ اتركه جذر المستودع إذا كانت هذه الملفات في جذر GitHub.
- لا تضع `public` في Build command أو Deploy command.

## Render (الخادم الخلفي)

يبقى عنوان Render الحالي هو عنوان الـ API والخادم الخلفي، لأنه ليس جزءًا من نطاق Pages: `https://nesma-store.onrender.com`. لا تستبدل هذا العنوان بعنوان Pages في طلبات API أو رابط Google OAuth callback ما دام الخادم ما زال منشورًا على Render بهذا العنوان.

في Render → Environment، حدّث أو أضف:

- `FRONTEND_URL=https://atheer-store.pages.dev`
- أبقِ `GOOGLE_CALLBACK_URL=https://nesma-store.onrender.com/api/auth/google/callback` إذا كان هذا هو عنوان خدمة Render الحالية.
- لا تغيّر `DATABASE_URL` أو `JWT_SECRET` أو أسرار Google؛ احتفظ بالقيم الحالية.

بعد تحديث متغيرات البيئة، أعد نشر خدمة Render التي تشغّل مجلد `backend`. يجب نشر تغييرات `backend` أيضًا، لأن هذا الإصدار يحدّث روابط الإحالة وقيم العلامة التجارية الافتراضية وترحيل إعدادات الاسم المخزنة.

## Google OAuth

في Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID:

1. أضف `https://atheer-store.pages.dev` إلى **Authorized JavaScript origins** (إن ظهر هذا الحقل لنوع عميلك).
2. احتفظ بعنوان **Authorized redirect URI** للخادم الخلفي: `https://nesma-store.onrender.com/api/auth/google/callback`. يجب أن يطابق `GOOGLE_CALLBACK_URL` في Render حرفيًا. لا تجعل callback عنوان Pages، لأن callback ينفذه الخادم الخلفي.
3. اختبر تسجيل الدخول العادي وتسجيل الدخول عبر Google، ثم اختبر الانتقال إلى `account.html` أو `admin.html`.

## الحفاظ على البيانات وتسجيل الدخول

- لا تنشئ قاعدة بيانات جديدة ولا تغيّر `DATABASE_URL` بسبب تغيير اسم الواجهة فقط.
- تبقى رموز الإحالة القديمة التي تبدأ بـ `NESMA-` صالحة؛ الرموز الجديدة تبدأ بـ `ATHEER-`.
- تبقى مفاتيح التخزين المحلية القديمة للجلسة كما هي لتفادي فقدان الجلسات المحفوظة في المتصفح.
- عند فشل تسجيل الدخول بعد تغيير العنوان، تحقق أولًا من `FRONTEND_URL` في Render وإعدادات OAuth أعلاه، ولا تحذف المشروع القديم.
