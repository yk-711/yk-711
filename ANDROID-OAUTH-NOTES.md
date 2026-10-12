# أثير Android — إعداد المصادقة

## العناوين المعتمدة
- موقع المتجر: https://atheer-store.pages.dev/
- خادم API وGoogle OAuth: https://nesma-store.onrender.com
- Google callback الحالي: https://nesma-store.onrender.com/api/auth/google/callback

## حالة التدفق الحالي
يبدأ تسجيل الدخول من `/api/auth/google`، ثم يعالج الخادم Google callback، وينشئ رمز handoff قصير العمر، ويعيد توجيه المتصفح إلى:
`https://atheer-store.pages.dev/login.html#oauth_token=...`

صفحة `public/login.js` تستبدل رمز handoff برمز جلسة عبر `POST /api/auth/google/exchange` وتحفظ رمز الجلسة في `localStorage`. هذا التدفق مخصص لواجهة الويب؛ تخزين المتصفح الخارجي لا يساوي تخزين WebView داخل تطبيق Android.

## شرط إكمال التطبيق
قبل اعتبار Google Login مكتملًا داخل Android، أضف مسارًا منفصلًا لبدء المصادقة من التطبيق، واسمح بعودة موثوقة عبر deep link مثل `atheer://auth` أو Android App Links. يجب أن يكون خيار العودة للتطبيق مربوطًا بحالة OAuth عشوائية قصيرة العمر، وألا يقبل الخادم عنوان إعادة توجيه يرسله المستخدم دون تحقق. عند وصول الرابط للتطبيق، اقرأ handoff token، واستبدله عبر `/api/auth/google/exchange`، ثم احفظ session token في تخزين مناسب للتطبيق. اختبر الإلغاء والفشل وإعادة استخدام الرمز وانتهاء صلاحيته.

## النشر
أي تعديل في `backend/auth.js` لا يصبح فعالًا على الموقع الحي بمجرد بناء تطبيق Android؛ يجب نشر نسخة الخادم المعدّلة على خدمة Render وضبط إعدادات OAuth المسموح بها. لا تضع أسرار Google أو قاعدة البيانات داخل تطبيق Android.
