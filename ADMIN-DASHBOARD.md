# ATHEER Admin Dashboard — V7

تم تطوير لوحة الإدارة فوق بنية متجر أثير الحالية دون إعادة بناء الواجهة العامة.

## ما تم تنفيذه
- Dashboard حقيقية مرتبطة بـ Neon PostgreSQL.
- إحصائيات المبيعات والطلبات والمنتجات والعملاء والمخزون.
- إدارة المنتجات CRUD مع SKU/Barcode/SEO/مخزون/صور وروابط صور ورفع صور متعددة.
- Soft Delete وRestore وBulk Actions وDuplicate.
- إدارة المخزون الأساسي والمتغيرات الموجودة.
- الأقسام والشارات.
- الطلبات مع البحث والفلاتر وتغيير الحالة وتفاصيل الطلب.
- العملاء وإحصائيات مشترياتهم.
- إعدادات المتجر والعملات والشحن وSEO وWhatsApp.
- Coupons.
- محتوى الصفحة الرئيسية والصفحات والقائمة وFooter محفوظ في Neon.
- سلايدر الصفحة الرئيسية يمكن إدارته من Content Studio ويظهر عبر API العام.
- Audit Log.
- System Health.
- CSRF token للإجراءات الإدارية.
- جميع عمليات Admin تمر عبر Backend وتستخدم Authorization server-side.
- قاعدة بيانات قابلة للتوسع: settings, content, coupons, badges, variants, inventory movements, audit logs, navigation, backups, admins, wishlists, carts.

## النشر
1. ارفع المشروع إلى GitHub.
2. تأكد من Render Environment Variables، خصوصًا `ADMIN_EMAIL=younesalkiser712@gmail.com`.
3. نفّذ Redeploy للـBackend.
4. عند بدء الخادم، يتم تشغيل migrations تلقائيًا للجداول الجديدة والأعمدة الجديدة.
5. افتح لوحة الإدارة من `admin.html` بعد تسجيل الدخول بحساب المدير.

## ملاحظة النسخ الاحتياطية
النسخ الفعلية لقاعدة Neon يجب أن تُدار عبر آلية Neon/مزود قاعدة البيانات أو خدمة تخزين آمنة. لوحة الإدارة تسجل عمليات النسخ ولا تعرض أسرار الاتصال بالقاعدة.
