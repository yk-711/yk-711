import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import path from "path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "url";
import "dotenv/config";

import { query } from "./db.js";
import { register, login, logout, me, forgotPassword, resetPassword, authenticate, googleStart, googleCallback, googleExchange } from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.PORT || 3000);
app.disable("x-powered-by");
app.use(express.json({ limit: "12mb" }));
app.use(cookieParser());
const configuredFrontend = String(process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
const allowedOrigins = new Set([
  "https://atheer-store.pages.dev",
  configuredFrontend,
  `http://localhost:${port}`,
  "http://127.0.0.1:" + port
].filter(Boolean));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || /^https:\/\/([a-z0-9-]+\.)*pages\.dev$/i.test(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed."));
  },
  credentials: true
}));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { message: "محاولات كثيرة. حاول مرة أخرى بعد قليل." } });

async function isAdmin(req) {
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (adminEmail && req.user?.email && String(req.user.email).toLowerCase() === adminEmail) return true;
  if (!req.user?.id) return false;
  try {
    const r = await query(`SELECT 1 FROM admins WHERE user_id=$1 AND active=true LIMIT 1`, [req.user.id]);
    return !!r.rowCount;
  } catch { return false; }
}
async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "يجب تسجيل الدخول أولاً." });
  if (!(await isAdmin(req))) return res.status(403).json({ message: "هذه الصفحة مخصصة لمدير المتجر." });
  let csrf = req.cookies?.admin_csrf;
  if (!csrf) {
    csrf = randomUUID();
    res.cookie('admin_csrf', csrf, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.COOKIE_SAMESITE || 'none', path: '/' });
  }
  if (['POST','PUT','PATCH','DELETE'].includes(req.method) && req.path !== '/me' && !String(req.headers.authorization || '').startsWith('Bearer ')) {
    if (!req.headers['x-csrf-token'] || req.headers['x-csrf-token'] !== csrf) return res.status(403).json({ message: 'رمز الحماية غير صالح. حدّث لوحة الإدارة وحاول مجددًا.' });
  }
  res.on('finish', () => {
    if (['POST','PUT','PATCH','DELETE'].includes(req.method)) {
      query(`INSERT INTO audit_logs(admin_user_id,admin_email,action,resource_type,resource_id,description,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [req.user?.id || null, req.user?.email || '', `${req.method} ${req.path}`, 'api', req.params?.id || null, 'عملية إدارية', req.ip || '', String(req.headers['user-agent'] || '').slice(0,500)]).catch(()=>{});
    }
  });
  next();
}
function arr(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (v == null || v === "") return [];
  if (typeof v === "string") {
    const s = v.trim();
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(x => String(x).trim()).filter(Boolean);
    } catch {}
    return s.split(",").map(x => x.trim()).filter(Boolean);
  }
  return [String(v).trim()].filter(Boolean);
}
function normalizeArrayValue(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (v == null || v === "") return [];
  if (typeof v === "string") {
    const s = v.trim();
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(x => String(x).trim()).filter(Boolean);
    } catch {}
    if (s.startsWith("{") && s.endsWith("}")) return s.slice(1,-1).split(",").map(x => x.replace(/^\"|\"$/g, "").trim()).filter(Boolean);
    return s.split(",").map(x => x.trim()).filter(Boolean);
  }
  return [];
}
let productImagesColumnIsJson = null;
async function productImagesParam(values) {
  const clean = normalizeArrayValue(values);
  if (productImagesColumnIsJson === null) {
    const r = await query(`SELECT data_type,udt_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='products' AND column_name='images' LIMIT 1`);
    const c = r.rows[0] || {};
    productImagesColumnIsJson = String(c.data_type || '').toLowerCase() === 'json' || String(c.data_type || '').toLowerCase() === 'jsonb' || String(c.udt_name || '').toLowerCase() === 'json' || String(c.udt_name || '').toLowerCase() === 'jsonb';
  }
  return productImagesColumnIsJson ? JSON.stringify(clean) : clean;
}
function cleanProduct(body) {
  const categorySlugs = arr(body.category_slugs || body.categories);
  const badges = arr(body.badges || body.badge);
  return {
    title: String(body.title || "").trim().slice(0, 200),
    title_en: String(body.title_en || body.titleEn || "").trim().slice(0, 200),
    description: String(body.description || "").trim(),
    short_description: String(body.short_description || body.shortDescription || "").trim(),
    sku: String(body.sku || "").trim().slice(0, 100),
    barcode: String(body.barcode || "").trim().slice(0, 100),
    seo_title: String(body.seo_title || "").trim().slice(0, 255),
    seo_description: String(body.seo_description || "").trim(),
    slug: String(body.slug || "").trim().slice(0, 180),
    category: String(body.category || categorySlugs[0] || "عام").trim().slice(0, 100),
    category_slugs: categorySlugs.length ? categorySlugs : [String(body.category || "عام").trim()],
    audience: ["women", "kids"].includes(body.audience) ? body.audience : "women",
    image_url: String(body.image_url || "").trim(),
    old_price: body.old_price === "" || body.old_price == null ? null : Number(body.old_price),
    price: Number(body.price || 0), rating: Number(body.rating || 5), reviews: Number(body.reviews || 0),
    tags: String(body.tags || "").trim(), prep_time: Number(body.prep_time || 10),
    badges,
    stock_total: Math.max(0, Number(body.stock_total ?? body.stock ?? 0) || 0),
    sizes: arr(body.sizes || body.available_sizes),
    colors: arr(body.colors || body.available_colors),
    fabrics: arr(body.fabrics || body.fabric || body.available_fabrics),
    images: arr(body.images || body.gallery || body.image_urls),
    active: body.active !== false, selected: body.selected === true, sort_order: Number(body.sort_order || 0)
  };
}
function githubConfig() {
  const token = String(process.env.GITHUB_TOKEN || "").trim();
  const owner = String(process.env.GITHUB_OWNER || "").trim();
  const repo = String(process.env.GITHUB_REPO || "").trim();
  const branch = String(process.env.GITHUB_BRANCH || "main").trim();
  const pathName = String(process.env.GITHUB_PRODUCTS_PATH || "public/data/products.json").trim();
  return { token, owner, repo, branch, pathName, enabled: !!(token && owner && repo) };
}
async function githubRequest(endpoint, options = {}) {
  const cfg = githubConfig();
  if (!cfg.enabled) throw new Error("ربط GitHub غير مكتمل. أضف GITHUB_TOKEN وGITHUB_OWNER وGITHUB_REPO في إعدادات الخادم.");
  const r = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${cfg.token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `GitHub API ${r.status}`);
  return data;
}
function safeFileName(name) {
  return String(name || "product").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "product";
}
async function githubPutFile(filePath, contentBuffer, message, sha = null) {
  const cfg = githubConfig();
  let existingSha = sha;
  if (!existingSha) {
    try { existingSha = (await githubRequest(`/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}?ref=${encodeURIComponent(cfg.branch)}`)).sha; } catch (e) { if (!String(e.message).includes("Not Found")) throw e; }
  }
  const body = { message, content: contentBuffer.toString("base64"), branch: cfg.branch };
  if (existingSha) body.sha = existingSha;
  return githubRequest(`/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`, { method: "PUT", body: JSON.stringify(body) });
}
async function publishToGitHub() {
  const cfg = githubConfig();
  if (!cfg.enabled) throw new Error("GitHub غير مربوط بعد.");
  const result = await query(`SELECT id,title,description,category,category_slugs,audience,image_url,images,sizes,colors,fabrics,old_price,price,rating,reviews,tags,prep_time,badges,active,selected,sort_order,created_at,updated_at FROM products ORDER BY sort_order ASC, created_at DESC`);
  const categories = await query(`SELECT id,name,slug,image_url,active,sort_order FROM categories ORDER BY sort_order ASC, name ASC`);
  const payload = { version: 1, generated_at: new Date().toISOString(), categories: categories.rows, products: result.rows };
  await githubPutFile(cfg.pathName, Buffer.from(JSON.stringify(payload, null, 2), "utf8"), "تحديث منتجات متجر أثير");
  return { path: cfg.pathName, products: result.rows.length, categories: categories.rows.length };
}


function normalizeImageUrl(value) {
  return String(value || '').trim();
}
function uniqueStrings(values) { return [...new Set(arr(values))]; }
async function saveImageListToGitHub(dataUrls, title) {
  const saved = [];
  for (const dataUrl of (Array.isArray(dataUrls) ? dataUrls : [])) {
    saved.push(await saveImageToGitHub(dataUrl, title));
  }
  return saved;
}
function parseCartItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('السلة فارغة.');
  return items.map((x) => ({
    product_id: x.product_id || x.id || null,
    name: String(x.name || x.title || '').trim().slice(0, 200),
    image_url: normalizeImageUrl(x.image_url || x.image),
    price_yer: Number(x.price_yer ?? x.price ?? 0),
    quantity: Math.max(1, Math.min(99, Number(x.quantity ?? x.qty ?? 1))),
    size: String(x.size || '').trim().slice(0, 100),
    color: String(x.color || '').trim().slice(0, 100),
    fabric: String(x.fabric || '').trim().slice(0, 100)
  })).filter(x => x.name && Number.isFinite(x.price_yer) && x.price_yer >= 0);
}
async function awardOrderPoints(orderId) {
  const order = await query(`SELECT id,user_id,total_yer,referral_user_id,status FROM orders WHERE id=$1`, [orderId]);
  if (!order.rowCount || order.rows[0].status !== 'completed') return { buyer: 0, referral: 0 };
  const o = order.rows[0];
  let buyer = 0, referral = 0;
  if (o.user_id) {
    buyer = Math.floor(Number(o.total_yer) / 1000);
    if (buyer > 0) {
      const r = await query(`INSERT INTO points_ledger(user_id,points,reason,order_id,referral_user_id) VALUES($1,$2,'order_purchase',$3,$4) ON CONFLICT DO NOTHING RETURNING points`, [o.user_id, buyer, o.id, o.referral_user_id]);
      if (r.rowCount) await query(`UPDATE users SET points=points+$1,updated_at=NOW() WHERE id=$2`, [buyer, o.user_id]); else buyer = 0;
    }
  }
  if (o.referral_user_id) {
    referral = Math.floor(Number(o.total_yer) / 2000);
    if (referral > 0) {
      const r = await query(`INSERT INTO points_ledger(user_id,points,reason,order_id,referral_user_id) VALUES($1,$2,'referral_purchase',$3,$4) ON CONFLICT DO NOTHING RETURNING points`, [o.referral_user_id, referral, o.id, o.user_id]);
      if (r.rowCount) await query(`UPDATE users SET points=points+$1,updated_at=NOW() WHERE id=$2`, [referral, o.referral_user_id]); else referral = 0;
    }
  }
  return { buyer, referral };
}

app.get("/api/health", async (_req, res) => { try { await query("SELECT 1"); res.json({ ok: true, database: "connected", github: githubConfig().enabled }); } catch { res.status(503).json({ ok: false, database: "unavailable", github: githubConfig().enabled }); } });
app.get("/api/auth/google", googleStart); app.get("/api/auth/google/callback", googleCallback); app.post("/api/auth/google/exchange", authLimiter, googleExchange);
app.post("/api/auth/register", authLimiter, register); app.post("/api/auth/login", authLimiter, login); app.post("/api/auth/logout", logout); app.get("/api/auth/me", authenticate, me); app.post("/api/auth/forgot-password", authLimiter, forgotPassword); app.post("/api/auth/reset-password", authLimiter, resetPassword);
app.get("/api/admin/me", authenticate, async (req, res) => {
  if (!(await isAdmin(req))) return res.status(403).json({ message: "غير مصرح." });
  const csrf = req.cookies?.admin_csrf || randomUUID();
  if (!req.cookies?.admin_csrf) res.cookie('admin_csrf', csrf, { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:process.env.COOKIE_SAMESITE||'none', path:'/' });
  res.json({ ok:true, csrf, user:req.user });
});

app.get("/api/products", async (_req, res, next) => { try { const r = await query(`SELECT id,title,description,category,category_slugs,audience,image_url,images,sizes,colors,fabrics,old_price,price,rating,reviews,tags,prep_time,badges,COALESCE(badges[1], badge) AS badge,active,selected,sort_order,created_at,updated_at FROM products WHERE active=true ORDER BY sort_order ASC,created_at DESC`); res.json({ products: r.rows }); } catch (e) { next(e); } });
app.get("/api/categories", async (_req, res, next) => { try { const r = await query(`SELECT * FROM categories WHERE active=true ORDER BY sort_order ASC,name ASC`); res.json({ categories: r.rows }); } catch (e) { next(e); } });
app.get("/api/notifications", async (_req,res,next)=>{try{const r=await query(`SELECT id,title,message,type,created_at FROM notifications WHERE active=true ORDER BY created_at DESC LIMIT 10`);res.json({notifications:r.rows});}catch(e){next(e)}});
app.get("/api/account/summary", authenticate, async (req,res,next)=>{try{const u=await query(`SELECT id,name,email,provider,email_verified,created_at,referral_code,points FROM users WHERE id=$1`,[req.user.id]);const orders=await query(`SELECT o.id,o.status,o.total_yer,o.currency,o.created_at,COALESCE(json_agg(json_build_object('name',i.name,'quantity',i.quantity,'size',i.size,'color',i.color,'fabric',i.fabric)) FILTER (WHERE i.id IS NOT NULL),'[]') items FROM orders o LEFT JOIN order_items i ON i.order_id=o.id WHERE o.user_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`,[req.user.id]);const code=u.rows[0]?.referral_code||'';res.json({user:u.rows[0],referralLink:`https://atheer-store.pages.dev/?ref=${encodeURIComponent(code)}`,orders:orders.rows});}catch(e){next(e)}});
app.post("/api/orders", async (req,res,next)=>{try{const items=parseCartItems(req.body.items);for(const x of items){if(!x.product_id)throw new Error('بيانات المنتج غير صالحة.');const pr=await query(`SELECT id,title,image_url,price FROM products WHERE id=$1 AND active=true LIMIT 1`,[x.product_id]);if(!pr.rowCount)throw new Error('أحد المنتجات لم يعد متاحاً.');x.price_yer=Number(pr.rows[0].price);x.name=pr.rows[0].title;x.image_url=pr.rows[0].image_url||x.image_url;}const total=items.reduce((sum,x)=>sum+x.price_yer*x.quantity,0);if(!total)return res.status(400).json({message:'إجمالي الطلب غير صالح.'});let referralCode=String(req.body.referral_code||'').trim().toUpperCase()||null;let referralUserId=null;if(referralCode){const rr=await query(`SELECT id FROM users WHERE referral_code=$1 LIMIT 1`,[referralCode]);if(rr.rowCount)referralUserId=rr.rows[0].id;}let userId=null;
try { const authHeader=String(req.headers.authorization||''); const authToken=authHeader.startsWith('Bearer ')?authHeader.slice(7).trim():(req.cookies?.auth_token||''); if(authToken){ const {sub}=jwt.verify(authToken, process.env.JWT_SECRET); userId=sub; } } catch {}
if (!referralUserId && userId) { const ru=await query(`SELECT referred_by_user_id FROM users WHERE id=$1 LIMIT 1`,[userId]); referralUserId=ru.rows[0]?.referred_by_user_id||null; if(referralUserId){ const rc=await query(`SELECT referral_code FROM users WHERE id=$1`,[referralUserId]); referralCode=rc.rows[0]?.referral_code||referralCode; } }try{if(req.headers.cookie){/* JWT remains httpOnly; authenticate middleware is intentionally not required for guest checkout. */}}catch{}
const authToken=req.cookies?.auth_token; if(authToken){try{const jwt=(await import('jsonwebtoken')).default;const payload=jwt.verify(authToken,process.env.JWT_SECRET);userId=payload.sub||null;}catch{}}
const o=await query(`INSERT INTO orders(user_id,status,customer_name,phone,city,address,notes,currency,total_yer,referral_code,referral_user_id) VALUES($1,'pending',$2,$3,$4,$5,$6,'YER',$7,$8,$9) RETURNING id,status,total_yer,created_at`,[userId,String(req.body.name||'').trim().slice(0,150),String(req.body.phone||'').trim().slice(0,50),String(req.body.city||'').trim().slice(0,100),String(req.body.address||'').trim(),String(req.body.notes||'').trim(),total,referralCode,referralUserId]);
if(!o.rows[0].id)throw new Error('تعذر إنشاء الطلب.');for(const x of items) await query(`INSERT INTO order_items(order_id,product_id,name,image_url,price_yer,quantity,size,color,fabric) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[o.rows[0].id,x.product_id,x.name,x.image_url,x.price_yer,x.quantity,x.size,x.color,x.fabric]);res.status(201).json({order:o.rows[0],message:'تم حفظ الطلب بنجاح.'});}catch(e){next(e)}});


app.get("/api/admin/products", authenticate, requireAdmin, async (_req, res, next) => { try { const r = await query(`SELECT * FROM products ORDER BY sort_order ASC,created_at DESC`); res.json({ products: r.rows }); } catch (e) { next(e); } });
app.get("/api/admin/categories", authenticate, requireAdmin, async (_req, res, next) => { try { const r = await query(`SELECT * FROM categories ORDER BY sort_order ASC,name ASC`); res.json({ categories: r.rows }); } catch (e) { next(e); } });
app.post("/api/admin/categories", authenticate, requireAdmin, async (req,res,next)=>{try{const name=String(req.body.name||"").trim();const slug=String(req.body.slug||name).trim().toLowerCase().replace(/\s+/g,"-");if(!name||!slug)return res.status(400).json({message:"أدخل اسم القسم."});const r=await query(`INSERT INTO categories(name,slug,image_url,active,sort_order) VALUES($1,$2,$3,$4,$5) RETURNING *`,[name,slug,String(req.body.image_url||""),req.body.active!==false,Number(req.body.sort_order||0)]);res.status(201).json({category:r.rows[0]});}catch(e){next(e)}});
app.put("/api/admin/categories/:id", authenticate, requireAdmin, async (req,res,next)=>{try{const name=String(req.body.name||"").trim();const slug=String(req.body.slug||name).trim().toLowerCase().replace(/\s+/g,"-");const r=await query(`UPDATE categories SET name=$1,slug=$2,image_url=$3,active=$4,sort_order=$5,updated_at=NOW() WHERE id=$6 RETURNING *`,[name,slug,String(req.body.image_url||""),req.body.active!==false,Number(req.body.sort_order||0),req.params.id]);if(!r.rowCount)return res.status(404).json({message:"القسم غير موجود."});res.json({category:r.rows[0]});}catch(e){next(e)}});
app.delete("/api/admin/categories/:id", authenticate, requireAdmin, async (req,res,next)=>{try{await query("DELETE FROM categories WHERE id=$1",[req.params.id]);res.json({message:"تم حذف القسم."});}catch(e){next(e)}});

app.get("/api/admin/orders", authenticate, requireAdmin, async (_req,res,next)=>{try{const r=await query(`SELECT o.*,COALESCE(json_agg(json_build_object('id',i.id,'product_id',i.product_id,'name',i.name,'price_yer',i.price_yer,'quantity',i.quantity,'size',i.size,'color',i.color,'fabric',i.fabric,'image_url',i.image_url)) FILTER (WHERE i.id IS NOT NULL),'[]') items FROM orders o LEFT JOIN order_items i ON i.order_id=o.id GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`);res.json({orders:r.rows});}catch(e){next(e)}});
app.put("/api/admin/orders/:id/status", authenticate, requireAdmin, async (req,res,next)=>{try{const status=String(req.body.status||'').trim();if(!['pending','confirmed','completed','cancelled'].includes(status))return res.status(400).json({message:'حالة الطلب غير صالحة.'});const old=await query(`SELECT status FROM orders WHERE id=$1`,[req.params.id]);if(!old.rowCount)return res.status(404).json({message:'الطلب غير موجود.'});const r=await query(`UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,[status,req.params.id]);let points={buyer:0,referral:0};if(status==='completed'&&old.rows[0].status!=='completed')points=await awardOrderPoints(req.params.id);res.json({order:r.rows[0],points});}catch(e){next(e)}});
app.get("/api/admin/notifications", authenticate, requireAdmin, async (_req,res,next)=>{try{const r=await query(`SELECT * FROM notifications ORDER BY created_at DESC`);res.json({notifications:r.rows});}catch(e){next(e)}});
app.post("/api/admin/notifications", authenticate, requireAdmin, async (req,res,next)=>{try{const r=await query(`INSERT INTO notifications(title,message,type,active) VALUES($1,$2,$3,$4) RETURNING *`,[String(req.body.title||'').trim(),String(req.body.message||'').trim(),String(req.body.type||'info'),req.body.active!==false]);res.status(201).json({notification:r.rows[0]});}catch(e){next(e)}});
app.put("/api/admin/notifications/:id", authenticate, requireAdmin, async (req,res,next)=>{try{const r=await query(`UPDATE notifications SET title=$1,message=$2,type=$3,active=$4,updated_at=NOW() WHERE id=$5 RETURNING *`,[String(req.body.title||'').trim(),String(req.body.message||'').trim(),String(req.body.type||'info'),req.body.active!==false,req.params.id]);if(!r.rowCount)return res.status(404).json({message:'الإشعار غير موجود.'});res.json({notification:r.rows[0]});}catch(e){next(e)}});
app.delete("/api/admin/notifications/:id", authenticate, requireAdmin, async (req,res,next)=>{try{await query(`DELETE FROM notifications WHERE id=$1`,[req.params.id]);res.json({message:'تم حذف الإشعار.'});}catch(e){next(e)}});
app.post("/api/admin/products/:id/images", authenticate, requireAdmin, async (req,res,next)=>{try{const p=await query(`SELECT id,title,image_url,images FROM products WHERE id=$1`,[req.params.id]);if(!p.rowCount)return res.status(404).json({message:'المنتج غير موجود.'});const urls=await saveImageListToGitHub(req.body.image_data_list||[],p.rows[0].title);if(!urls.length)return res.status(400).json({message:'لم تصل صور جديدة.'});const images=uniqueStrings([...normalizeArrayValue(p.rows[0].images),...urls]);await query(`UPDATE products SET images=$1,updated_at=NOW() WHERE id=$2`,[await productImagesParam(images),req.params.id]);await publishToGitHub();res.json({images});}catch(e){next(e)}});
app.delete("/api/admin/products/:id/images", authenticate, requireAdmin, async (req,res,next)=>{try{const p=await query(`SELECT id,image_url,images FROM products WHERE id=$1`,[req.params.id]);if(!p.rowCount)return res.status(404).json({message:'المنتج غير موجود.'});const target=String(req.body.url||'');if(!target)return res.status(400).json({message:'حدد الصورة.'});let primary=p.rows[0].image_url, images=normalizeArrayValue(p.rows[0].images).filter(x=>x!==target);if(primary===target){primary=images.shift()||'';}if(!primary)return res.status(400).json({message:'يجب أن يبقى للمنتج صورة رئيسية.'});await query(`UPDATE products SET image_url=$1,images=$2,updated_at=NOW() WHERE id=$3`,[primary,await productImagesParam(images),req.params.id]);await publishToGitHub();res.json({image_url:primary,images});}catch(e){next(e)}});
app.post("/api/admin/products/repair-images", authenticate, requireAdmin, async (_req,res,next)=>{try{const r=await query(`SELECT id,title,image_url,images FROM products ORDER BY created_at ASC`);const report=[];for(const p of r.rows){const all=uniqueStrings([p.image_url,...normalizeArrayValue(p.images)]);const replacements=new Map();for(const url of all){if(!/^https?:\/\//i.test(String(url||'')))continue;try{const rr=await fetch(url,{redirect:'follow'});if(!rr.ok)throw new Error(`HTTP ${rr.status}`);const ct=rr.headers.get('content-type')||'image/jpeg';if(!ct.startsWith('image/'))throw new Error('الرابط ليس صورة');const buf=Buffer.from(await rr.arrayBuffer());const ext=(ct.split('/')[1]||'jpeg').replace('jpeg','jpg').split(';')[0];const pathName=`public/images/products/${safeFileName(p.title)}-repair-${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;await githubPutFile(pathName,buf,`إصلاح صورة منتج: ${p.title}`);replacements.set(url,`/images/products/${pathName.split('/').pop()}`);}catch(e){report.push({product_id:p.id,url,status:'failed',error:e.message});}}
if(replacements.size){const primary=replacements.get(p.image_url)||p.image_url;const images=normalizeArrayValue(p.images).map(x=>replacements.get(x)||x);await query(`UPDATE products SET image_url=$1,images=$2,updated_at=NOW() WHERE id=$3`,[primary,await productImagesParam(images),p.id]);report.push({product_id:p.id,status:'repaired',count:replacements.size});}}
await publishToGitHub();res.json({message:'اكتملت محاولة إصلاح الصور.',report});}catch(e){next(e)}});

app.post("/api/admin/products", authenticate, requireAdmin, async (req,res,next)=>{try{const p=cleanProduct(req.body);if(!p.title||!Number.isFinite(p.price)||p.price<0)return res.status(400).json({message:"أدخل اسم المنتج والسعر بشكل صحيح."});if(!p.image_url&&req.body.image_data)p.image_url=await saveImageToGitHub(req.body.image_data,p.title);if(req.body.image_data_list?.length)p.images=uniqueStrings([...normalizeArrayValue(p.images),...(await saveImageListToGitHub(req.body.image_data_list,p.title))]);if(!p.image_url)return res.status(400).json({message:"أضف صورة للمنتج."});const r=await query(`INSERT INTO products(title,title_en,description,short_description,sku,barcode,slug,seo_title,seo_description,category,category_slugs,audience,image_url,images,sizes,colors,fabrics,old_price,price,rating,reviews,tags,prep_time,badges,stock_total,active,selected,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING *`,[p.title,p.title_en,p.description,p.short_description,p.sku||null,p.barcode||null,p.slug||safeFileName(p.title),p.seo_title,p.seo_description,p.category,p.category_slugs,p.audience,p.image_url,await productImagesParam(p.images),p.sizes,p.colors,p.fabrics,p.old_price,p.price,p.rating,p.reviews,p.tags,p.prep_time,p.badges,p.stock_total,p.active,p.selected,p.sort_order]);await audit(req,'product.create','product',r.rows[0].id,'إضافة منتج',null,r.rows[0]);let publish={status:'published',message:'تم نشر المنتج بنجاح.'};try{publish.github=await publishToGitHub()}catch(e){publish={status:'failed',message:'تم حفظ المنتج، لكن تعذر نشره إلى GitHub: '+e.message}}res.status(201).json({product:r.rows[0],message:publish.status==='published'?'تم حفظ المنتج ونشره.':'تم حفظ المنتج، لكنه لم يُنشر بعد.',publish});}catch(e){next(e)}});
app.put("/api/admin/products/:id", authenticate, requireAdmin, async (req,res,next)=>{try{const p=cleanProduct(req.body);if(!p.title||!Number.isFinite(p.price)||p.price<0)return res.status(400).json({message:"أدخل اسم المنتج والسعر بشكل صحيح."});const old=await query(`SELECT * FROM products WHERE id=$1`,[req.params.id]);if(!old.rowCount)return res.status(404).json({message:"المنتج غير موجود."});if(req.body.image_data)p.image_url=await saveImageToGitHub(req.body.image_data,p.title);if(req.body.image_data_list?.length)p.images=uniqueStrings([...normalizeArrayValue(old.rows[0].images),...normalizeArrayValue(p.images),...(await saveImageListToGitHub(req.body.image_data_list,p.title))]);const r=await query(`UPDATE products SET title=$1,title_en=$2,description=$3,short_description=$4,sku=$5,barcode=$6,slug=$7,seo_title=$8,seo_description=$9,category=$10,category_slugs=$11,audience=$12,image_url=COALESCE(NULLIF($13,''),image_url),images=$14,sizes=$15,colors=$16,fabrics=$17,old_price=$18,price=$19,rating=$20,reviews=$21,tags=$22,prep_time=$23,badges=$24,stock_total=$25,active=$26,selected=$27,sort_order=$28,updated_at=NOW() WHERE id=$29 RETURNING *`,[p.title,p.title_en,p.description,p.short_description,p.sku||null,p.barcode||null,p.slug||safeFileName(p.title),p.seo_title,p.seo_description,p.category,p.category_slugs,p.audience,p.image_url,await productImagesParam(p.images),p.sizes,p.colors,p.fabrics,p.old_price,p.price,p.rating,p.reviews,p.tags,p.prep_time,p.badges,p.stock_total,p.active,p.selected,p.sort_order,req.params.id]);if(!r.rowCount)return res.status(404).json({message:"المنتج غير موجود."});await audit(req,'product.update','product',req.params.id,'تعديل منتج',old.rows[0],r.rows[0]);let publish={status:'published',message:'تم نشر التعديل بنجاح.'};try{publish.github=await publishToGitHub()}catch(e){publish={status:'failed',message:'تم حفظ التعديل، لكن تعذر نشره إلى GitHub: '+e.message}}res.json({product:r.rows[0],message:publish.status==='published'?'تم تحديث المنتج ونشره.':'تم تحديث المنتج، لكنه لم يُنشر بعد.',publish});}catch(e){next(e)}});
app.delete("/api/admin/products/:id", authenticate, requireAdmin, async (req,res,next)=>{try{const r=await query("UPDATE products SET deleted_at=NOW(),active=false,updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL RETURNING id",[req.params.id]);if(!r.rowCount)return res.status(404).json({message:"المنتج غير موجود."});await publishToGitHub();res.json({message:"تم نقل المنتج إلى سلة المحذوفات."});}catch(e){next(e)}});
app.post("/api/admin/github/publish", authenticate, requireAdmin, async (_req,res,next)=>{try{res.json({message:"تم نشر البيانات في GitHub.",github:await publishToGitHub()});}catch(e){next(e)}});
app.get("/api/admin/github/status", authenticate, requireAdmin, async (_req,res)=>{const c=githubConfig();res.json({connected:c.enabled,repository:c.enabled?`${c.owner}/${c.repo}`:"",branch:c.branch,path:c.pathName});});

async function saveImageToGitHub(dataUrl,title){const m=String(dataUrl||"").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);if(!m)throw new Error("صورة المنتج غير صالحة.");const ext=m[1].split("/")[1].replace("jpeg","jpg");const filePath=`public/images/products/${safeFileName(title)}-${Date.now()}.${ext}`;await githubPutFile(filePath,Buffer.from(m[2],"base64"),`إضافة صورة المنتج: ${title}`);const c=githubConfig();return `/${filePath.replace(/^public\//,"")}`;}


// ========================= ATHEER ADMIN PLATFORM =========================
async function ensureAdminPlatform(){
  const statements=[
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS title_en VARCHAR(200) NOT NULL DEFAULT ''`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100)`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100)`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS slug VARCHAR(180)`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255) NOT NULL DEFAULT ''`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_total INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
  `CREATE UNIQUE INDEX IF NOT EXISTS products_sku_idx ON products(sku) WHERE sku IS NOT NULL AND sku<>''`,
  `CREATE TABLE IF NOT EXISTS product_variants(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,color VARCHAR(100) NOT NULL DEFAULT '',size VARCHAR(100) NOT NULL DEFAULT '',sku VARCHAR(100),price NUMERIC(12,2),stock INTEGER NOT NULL DEFAULT 0,reserved INTEGER NOT NULL DEFAULT 0,image_url TEXT NOT NULL DEFAULT '',active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS product_variants_product_idx ON product_variants(product_id,color,size)`,
  `CREATE TABLE IF NOT EXISTS badges(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(80) NOT NULL UNIQUE,color VARCHAR(30) NOT NULL DEFAULT '#d9b45c',icon VARCHAR(80) NOT NULL DEFAULT '',sort_order INTEGER NOT NULL DEFAULT 0,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS inventory_movements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID REFERENCES products(id) ON DELETE SET NULL,variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,delta INTEGER NOT NULL,reason VARCHAR(120) NOT NULL,reference_id UUID,created_by UUID REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS store_settings(key VARCHAR(120) PRIMARY KEY,value TEXT NOT NULL DEFAULT '',type VARCHAR(30) NOT NULL DEFAULT 'text',updated_by UUID REFERENCES users(id) ON DELETE SET NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS site_content(key VARCHAR(120) PRIMARY KEY,payload JSONB NOT NULL DEFAULT '{}'::jsonb,status VARCHAR(20) NOT NULL DEFAULT 'published',publish_at TIMESTAMPTZ,unpublish_at TIMESTAMPTZ,updated_by UUID REFERENCES users(id) ON DELETE SET NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS coupons(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code VARCHAR(80) NOT NULL UNIQUE,discount_type VARCHAR(20) NOT NULL DEFAULT 'percent',discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,min_order NUMERIC(12,2) NOT NULL DEFAULT 0,max_discount NUMERIC(12,2),starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ,max_uses INTEGER,max_uses_per_customer INTEGER,used_count INTEGER NOT NULL DEFAULT 0,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS coupon_products(coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,product_id UUID REFERENCES products(id) ON DELETE CASCADE,PRIMARY KEY(coupon_id,product_id))`,
  `CREATE TABLE IF NOT EXISTS audit_logs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,admin_email VARCHAR(255),action VARCHAR(120) NOT NULL,resource_type VARCHAR(80) NOT NULL,resource_id VARCHAR(120),old_value JSONB,new_value JSONB,description TEXT NOT NULL DEFAULT '',ip VARCHAR(80),user_agent TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS navigation_items(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),location VARCHAR(30) NOT NULL DEFAULT 'main',label VARCHAR(120) NOT NULL,href VARCHAR(500) NOT NULL DEFAULT '#',icon VARCHAR(80) NOT NULL DEFAULT '',sort_order INTEGER NOT NULL DEFAULT 0,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS backups(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),kind VARCHAR(30) NOT NULL,location TEXT,created_by UUID REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS admins(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,role VARCHAR(40) NOT NULL DEFAULT 'admin',permissions JSONB NOT NULL DEFAULT '{}'::jsonb,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS popup_notifications(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),title VARCHAR(180) NOT NULL,message TEXT NOT NULL DEFAULT '',image_url TEXT NOT NULL DEFAULT '',link_url TEXT NOT NULL DEFAULT '',position VARCHAR(30) NOT NULL DEFAULT 'bottom-right',max_views INTEGER NOT NULL DEFAULT 0,views_count INTEGER NOT NULL DEFAULT 0,page VARCHAR(30) NOT NULL DEFAULT 'all',starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ,active BOOLEAN NOT NULL DEFAULT TRUE,sort_order INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS admin_invites(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),email VARCHAR(255) NOT NULL UNIQUE,role VARCHAR(40) NOT NULL DEFAULT 'admin',active BOOLEAN NOT NULL DEFAULT TRUE,created_by UUID REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS wishlist_items(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES users(id) ON DELETE CASCADE,product_id UUID REFERENCES products(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,product_id))`,
  `ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1`,
  `CREATE TABLE IF NOT EXISTS cart_items(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES users(id) ON DELETE CASCADE,product_id UUID REFERENCES products(id) ON DELETE CASCADE,quantity INTEGER NOT NULL DEFAULT 1,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,product_id))`,
  `ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1`,
  ];
  for(const sql of statements) await query(sql);
  const defaults={store_name_ar:'أثير',store_name_en:'ATHEER',store_description:'متجر عبايات أثير',default_currency:'YER',rate_sar:'70',rate_usd:'540',shipping_fee:'0',free_shipping_min:'0',shipping_duration:'2-5 أيام',whatsapp_number:'',whatsapp_order_message:'مرحباً، أريد تأكيد طلبي رقم {order_id}',seo_title:'أثير | ATHEER STORE',seo_description:'متجر أثير للعبايات',social_facebook:'',social_instagram:'',social_whatsapp:'',social_tiktok:'',social_x:''};
  for(const [key,value] of Object.entries(defaults)) await query(`INSERT INTO store_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING`,[key,value]);
  // Rename persisted store branding from the previous brand without deleting customer/product data.
  await query(`UPDATE store_settings SET value=replace(replace(value,'نسمة','أثير'),'NESMA','ATHEER') WHERE value LIKE '%نسمة%' OR value LIKE '%NESMA%'`);
  await query(`UPDATE site_content SET payload=replace(replace(payload::text,'نسمة','أثير'),'NESMA','ATHEER')::jsonb,updated_at=NOW() WHERE payload::text LIKE '%نسمة%' OR payload::text LIKE '%NESMA%'`);
  for(const b of [['جديد','#d9b45c','✦'],['الأكثر مبيعاً','#d9b45c','★'],['يباع سريعاً','#b98b35','⚡'],['كمية محدودة','#d77b70','!'],['عرض خاص','#88c77c','%'],['حصري','#d9b45c','◆']]) await query(`INSERT INTO badges(name,color,icon) VALUES($1,$2,$3) ON CONFLICT(name) DO NOTHING`,b);
  const existingPages=await query(`SELECT payload FROM site_content WHERE key='pages' LIMIT 1`);
  if(!existingPages.rowCount){await query(`INSERT INTO site_content(key,payload,status) VALUES('pages',$1,'published')`,[JSON.stringify(contentDefaults.pages)]);}
  else {const current=existingPages.rows[0]?.payload||{};const pages=Array.isArray(current.pages)?current.pages:[...contentDefaults.pages.pages];const required=contentDefaults.pages.pages;let changed=false;for(const base of required){if(!pages.some(x=>String(x.slug||'')===String(base.slug))){pages.push(base);changed=true;}}if(changed)await query(`UPDATE site_content SET payload=$1,status='published',updated_at=NOW() WHERE key='pages'`,[JSON.stringify({...current,pages})]);}
}
async function audit(req,action,type,id,description,oldValue=null,newValue=null){query(`INSERT INTO audit_logs(admin_user_id,admin_email,action,resource_type,resource_id,description,old_value,new_value,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[req.user?.id,req.user?.email,action,type,id,description,oldValue?JSON.stringify(oldValue):null,newValue?JSON.stringify(newValue):null,req.ip||'',String(req.headers['user-agent']||'').slice(0,500)]).catch(()=>{})}
function parseMaybeJSON(v){try{return JSON.parse(v)}catch{return v}}

async function hasColumn(table, column){
  const r=await query(`SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND column_name=$2 LIMIT 1`,[table,column]);
  return !!r.rowCount;
}
app.get('/api/admin/dashboard',authenticate,requireAdmin,async(req,res,next)=>{try{
 const days=Math.min(90,Math.max(1,Number(req.query.days)||7));
 const [orderQty,cartQty]=await Promise.all([hasColumn('order_items','quantity'),hasColumn('cart_items','quantity')]);
 const cartExpr=cartQty?`COALESCE(SUM(quantity),0)::int`:`COUNT(*)::int`;
 const topQty=orderQty?`COALESCE(SUM(oi.quantity),0)::int`:`COUNT(oi.id)::int`;
 const topRevenue=orderQty?`COALESCE(SUM(oi.quantity*oi.price_yer),0)::numeric`:`COALESCE(SUM(oi.price_yer),0)::numeric`;
 const [s,o,p,c,n,t,w,ci]=await Promise.all([
  query(`SELECT COALESCE(SUM(total_yer),0)::numeric sales_total,COALESCE(SUM(total_yer) FILTER(WHERE created_at::date=CURRENT_DATE),0)::numeric sales_today,COALESCE(SUM(total_yer) FILTER(WHERE created_at>=date_trunc('month',CURRENT_DATE)),0)::numeric sales_month,COUNT(*)::int orders_total,COUNT(*) FILTER(WHERE status IN('pending','confirmed'))::int orders_new FROM orders`),
  query(`SELECT status,COUNT(*)::int count FROM orders GROUP BY status`),
  query(`SELECT COUNT(*)::int products,COUNT(*) FILTER(WHERE active AND deleted_at IS NULL)::int products_active,COUNT(*) FILTER(WHERE stock_total BETWEEN 1 AND 5 AND deleted_at IS NULL)::int low_stock FROM products`),
  query(`SELECT COUNT(*)::int customers,COUNT(*) FILTER(WHERE created_at>=CURRENT_DATE-INTERVAL '30 days')::int new_customers FROM users`),
  query(`SELECT COUNT(*)::int wishlist_items FROM wishlist_items`),
  query(`SELECT ${cartExpr} cart_items FROM cart_items`),
  query(`SELECT ${topQty} quantity,${topRevenue} revenue,p.title FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id JOIN orders o ON o.id=oi.order_id WHERE o.status IN('completed','delivered') GROUP BY p.id,p.title ORDER BY quantity DESC LIMIT 8`),
  query(`SELECT to_char(d,'DD Mon') AS label,COALESCE(SUM(o.total_yer),0)::numeric total FROM generate_series(CURRENT_DATE-($1::int-1),CURRENT_DATE,'1 day') d LEFT JOIN orders o ON o.created_at::date=d AND o.status NOT IN('cancelled','returned') GROUP BY d ORDER BY d`,[days])
 ]);
 const activity=await query(`SELECT action,description,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 12`);
 res.json({stats:{...s.rows[0],...p.rows[0],...c.rows[0],...n.rows[0],...t.rows[0]},statuses:o.rows.map(x=>({label:statusLabelAdmin(x.status),count:x.count})),top_products:w.rows,sales:ci.rows,activity:activity.rows,schema:{order_items_quantity:orderQty,cart_items_quantity:cartQty}});
}catch(e){next(e)}});
function normRows(r){return r} function statusLabelAdmin(s){return ({pending:'جديد',confirmed:'مؤكد',processing:'تجهيز',shipped:'شحن',delivered:'تسليم',completed:'مكتمل',cancelled:'ملغي',returned:'مرتجع'})[s]||s}

app.get('/api/admin/inventory',authenticate,requireAdmin,async(_req,res,next)=>{try{const r=await query(`SELECT p.id,p.id::text||'-base' item_id,p.title,'' color,'' size,p.stock_total available,0 reserved FROM products p WHERE p.deleted_at IS NULL UNION ALL SELECT v.id,v.id::text,p.title,v.color,v.size,v.stock,v.reserved FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.active AND p.deleted_at IS NULL ORDER BY title,color,size`);const items=r.rows.map(x=>({...x,id:x.item_id}));res.json({items,stats:{total:items.reduce((a,x)=>a+Number(x.available||0),0),low:items.filter(x=>x.available>0&&x.available<=5).length,out:items.filter(x=>x.available<=0).length,reserved:items.reduce((a,x)=>a+Number(x.reserved||0),0)}})}catch(e){next(e)}});
app.put('/api/admin/inventory/:id',authenticate,requireAdmin,async(req,res,next)=>{try{const id=req.params.id;const available=Math.max(0,Number(req.body.available)||0);if(id.endsWith('-base')){const pid=id.replace(/-base$/,'');const r=await query(`UPDATE products SET stock_total=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,[available,pid]);if(!r.rowCount)return res.status(404).json({message:'المنتج غير موجود.'});await audit(req,'inventory.update','product',pid,'تحديث المخزون',null,{available});return res.json({item:r.rows[0]})}const r=await query(`UPDATE product_variants SET stock=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,[available,id]);if(!r.rowCount)return res.status(404).json({message:'المتغير غير موجود.'});await audit(req,'inventory.update','variant',id,'تحديث مخزون المتغير',null,{available});res.json({item:r.rows[0]})}catch(e){next(e)}});

app.get('/api/admin/taxonomy',authenticate,requireAdmin,async(_req,res,next)=>{try{const [c,b]=await Promise.all([query(`SELECT * FROM categories ORDER BY sort_order,name`),query(`SELECT * FROM badges WHERE active ORDER BY sort_order,name`)]);res.json({categories:c.rows,badges:b.rows})}catch(e){next(e)}});
app.post('/api/admin/badges',authenticate,requireAdmin,async(req,res,next)=>{try{const r=await query(`INSERT INTO badges(name,color,icon,sort_order,active) VALUES($1,$2,$3,$4,true) RETURNING *`,[String(req.body.name||'').trim(),String(req.body.color||'#d9b45c'),String(req.body.icon||''),Number(req.body.sort_order||0)]);await audit(req,'badge.create','badge',r.rows[0].id,'إنشاء شارة',null,r.rows[0]);res.status(201).json({badge:r.rows[0]})}catch(e){next(e)}});
app.delete('/api/admin/badges/:id',authenticate,requireAdmin,async(req,res,next)=>{try{await query(`UPDATE badges SET active=false WHERE id=$1`,[req.params.id]);await audit(req,'badge.delete','badge',req.params.id,'تعطيل شارة');res.json({ok:true})}catch(e){next(e)}});

app.get('/api/admin/customers',authenticate,requireAdmin,async(req,res,next)=>{try{const q=String(req.query.q||'').trim();const provider=String(req.query.provider||'all');const params=[];const where=[];if(q){params.push(`%${q}%`);where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`)}if(provider!=='all'){params.push(provider);where.push(`u.provider=$${params.length}`)}const r=await query(`SELECT u.id,u.name,u.email,u.provider,u.created_at,u.points,COUNT(o.id)::int orders_count,COALESCE(SUM(o.total_yer) FILTER(WHERE o.status NOT IN('cancelled','returned')),0)::numeric spent,MAX(o.created_at) last_order FROM users u LEFT JOIN orders o ON o.user_id=u.id ${where.length?'WHERE '+where.join(' AND '):''} GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`,params);res.json({customers:r.rows})}catch(e){next(e)}});

app.get('/api/admin/orders',authenticate,requireAdmin,async(req,res,next)=>{try{const p=[];const w=[];if(req.query.status&&req.query.status!=='all'){p.push(req.query.status);w.push(`o.status=$${p.length}`)}if(req.query.q){p.push(`%${String(req.query.q)}%`);w.push(`(o.customer_name ILIKE $${p.length} OR o.phone ILIKE $${p.length} OR o.id::text ILIKE $${p.length})`)}if(req.query.from){p.push(req.query.from);w.push(`o.created_at::date >= $${p.length}::date`)}if(req.query.to){p.push(req.query.to);w.push(`o.created_at::date <= $${p.length}::date`)}const r=await query(`SELECT o.*,COUNT(i.id)::int items_count,COALESCE(SUM(i.quantity),0)::int units FROM orders o LEFT JOIN order_items i ON i.order_id=o.id ${w.length?'WHERE '+w.join(' AND '):''} GROUP BY o.id ORDER BY o.created_at DESC LIMIT 300`,p);res.json({orders:r.rows})}catch(e){next(e)}});
app.get('/api/admin/orders/:id',authenticate,requireAdmin,async(req,res,next)=>{try{const o=await query(`SELECT * FROM orders WHERE id=$1`,[req.params.id]);if(!o.rowCount)return res.status(404).json({message:'الطلب غير موجود.'});const i=await query(`SELECT * FROM order_items WHERE order_id=$1 ORDER BY id`,[req.params.id]);res.json({order:{...o.rows[0],items:i.rows}})}catch(e){next(e)}});

app.get('/api/admin/settings',authenticate,requireAdmin,async(_req,res,next)=>{try{const r=await query(`SELECT key,value,type,updated_at FROM store_settings ORDER BY key`);res.json({settings:r.rows})}catch(e){next(e)}});
app.put('/api/admin/settings',authenticate,requireAdmin,async(req,res,next)=>{try{for(const [key,value] of Object.entries(req.body||{})){if(!/^[a-zA-Z0-9_.-]{1,120}$/.test(key))continue;await query(`INSERT INTO store_settings(key,value,updated_by,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[key,String(value??''),req.user.id]);}await audit(req,'settings.update','settings',null,'تحديث إعدادات المتجر',null,req.body);res.json({ok:true})}catch(e){next(e)}});
app.put('/api/admin/profile',authenticate,requireAdmin,async(req,res,next)=>{try{const name=String(req.body.name||'').trim().slice(0,100);const email=String(req.body.email||'').trim().toLowerCase();if(!name||!email)return res.status(400).json({message:'الاسم والبريد مطلوبان.'});const old=await query(`SELECT id,name,email FROM users WHERE id=$1`,[req.user.id]);const r=await query(`UPDATE users SET name=$1,email=$2,updated_at=NOW() WHERE id=$3 RETURNING id,name,email,provider,email_verified,created_at`,[name,email,req.user.id]);await audit(req,'profile.update','user',req.user.id,'تعديل بيانات المدير',old.rows[0],r.rows[0]);res.json({user:r.rows[0],message:'تم حفظ بيانات المدير. قد تحتاج لإعادة تسجيل الدخول بعد تغيير البريد.'})}catch(e){next(e)}});

const contentDefaults={homepage:{hero_title:'أثير | ATHEER',hero_description:'عبايات بتفاصيل تليق بك',selected_title:'مختارات متجرنا',sections:[]},pages:{pages:[
  {slug:'about',title:'من نحن',content:'<p>أثير متجر متخصص في العبايات الراقية، نختار التصاميم بعناية ونعتني بالتفاصيل التي تصنع الفرق.</p><p>هدفنا أن نقدم تجربة شراء أنيقة، واضحة، وسهلة من أول زيارة حتى استلام الطلب.</p>'},
  {slug:'contact',title:'تواصل معنا',content:'<p>يسعدنا تواصلك معنا للاستفسارات والطلبات والمساعدة.</p><p><strong>واتساب:</strong> يمكن تحديث الرقم من لوحة الإدارة في إعدادات المتجر.</p><p><strong>البريد الإلكتروني:</strong> يمكن تحديثه من لوحة الإدارة.</p>'},
  {slug:'privacy',title:'سياسة الخصوصية',content:'<p>نحترم خصوصيتك ونستخدم البيانات اللازمة لمعالجة الطلبات وتحسين تجربة المتجر.</p><p>لا نشارك بيانات العملاء مع جهات غير لازمة لتنفيذ الخدمة إلا وفق ما يسمح به النظام.</p>'},
  {slug:'terms',title:'الشروط والأحكام',content:'<p>باستخدام متجر أثير، يوافق العميل على معلومات المنتج والأسعار وسياسات الطلب والشحن والاستبدال المعروضة في المتجر.</p><p>تحتفظ إدارة المتجر بحق تحديث الشروط عند الحاجة، ويظهر آخر إصدار منشور للزوار.</p>'}
]},navigation:{main:[],bottom:[]},footer:{description:'أثير — أناقة بتفاصيلها',links:[{label:'من نحن',href:'about.html'},{label:'تواصل معنا',href:'contact.html'},{label:'سياسة الخصوصية',href:'privacy.html'},{label:'الشروط والأحكام',href:'terms.html'}],social:[]}};
app.get('/api/admin/content/:type',authenticate,requireAdmin,async(req,res,next)=>{try{const type=req.params.type;const r=await query(`SELECT payload,status,publish_at,unpublish_at FROM site_content WHERE key=$1`,[type]);const payload=r.rows[0]?.payload||contentDefaults[type]||{};res.json({content:payload,html:`<div><h2>${escServer(type)}</h2><p class="muted">هذا محرر المحتوى الديناميكي. البيانات تحفظ في Neon ولا تعتمد على JavaScript ثابت.</p><textarea data-content-field="json" style="width:100%;min-height:320px;background:#121212;color:#fff;border:1px solid #333;border-radius:12px;padding:15px;font-family:monospace">${escServer(JSON.stringify(payload,null,2))}</textarea><button class="btn primary" data-content-save style="margin-top:12px">حفظ المحتوى</button></div>`})}catch(e){next(e)}});
app.put('/api/admin/content/:type',authenticate,requireAdmin,async(req,res,next)=>{try{let payload=req.body; if(req.body.json)payload=parseMaybeJSON(req.body.json);await query(`INSERT INTO site_content(key,payload,status,updated_by,updated_at) VALUES($1,$2,'published',$3,NOW()) ON CONFLICT(key) DO UPDATE SET payload=EXCLUDED.payload,status='published',updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[req.params.type,JSON.stringify(payload),req.user.id]);await audit(req,'content.publish','content',req.params.type,'نشر محتوى الموقع',null,payload);res.json({ok:true})}catch(e){next(e)}});
function escServer(v){return String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}

app.get('/api/admin/marketing',authenticate,requireAdmin,async(_req,res,next)=>{try{const [c,s]=await Promise.all([query(`SELECT * FROM coupons ORDER BY created_at DESC`),query(`SELECT key,value FROM store_settings WHERE key LIKE 'whatsapp_%'`)]);res.json({coupons:c.rows,settings:s.rows})}catch(e){next(e)}});
app.post('/api/admin/coupons',authenticate,requireAdmin,async(req,res,next)=>{try{const r=await query(`INSERT INTO coupons(code,discount_type,discount_value,min_order,starts_at,ends_at,active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[String(req.body.code||'').trim().toUpperCase(),req.body.discount_type==='fixed'?'fixed':'percent',Number(req.body.discount_value||0),Number(req.body.min_order||0),req.body.starts_at||null,req.body.ends_at||null,req.body.active!==false]);await audit(req,'coupon.create','coupon',r.rows[0].id,'إنشاء كوبون',null,r.rows[0]);res.status(201).json({coupon:r.rows[0]})}catch(e){next(e)}});
app.post('/api/admin/coupons/:id/toggle',authenticate,requireAdmin,async(req,res,next)=>{try{const r=await query(`UPDATE coupons SET active=NOT active,updated_at=NOW() WHERE id=$1 RETURNING *`,[req.params.id]);res.json({coupon:r.rows[0]})}catch(e){next(e)}});

app.post('/api/admin/products/bulk',authenticate,requireAdmin,async(req,res,next)=>{try{const ids=Array.isArray(req.body.ids)?req.body.ids:[];const action=req.body.action; if(!ids.length)return res.status(400).json({message:'حدد منتجات.'});if(action==='hide'||action==='show')await query(`UPDATE products SET active=$1,updated_at=NOW() WHERE id=ANY($2::uuid[])`,[action==='show',ids]);else if(action==='delete')await query(`UPDATE products SET deleted_at=NOW(),active=false,updated_at=NOW() WHERE id=ANY($1::uuid[])`,[ids]);else if(action==='restore')await query(`UPDATE products SET deleted_at=NULL,active=true,updated_at=NOW() WHERE id=ANY($1::uuid[])`,[ids]);else return res.status(400).json({message:'عملية غير مدعومة.'});await audit(req,'products.bulk','product',null,'عملية جماعية',{ids,action});await publishToGitHub();res.json({ok:true})}catch(e){next(e)}});
app.post('/api/admin/products/:id/restore',authenticate,requireAdmin,async(req,res,next)=>{try{const r=await query(`UPDATE products SET deleted_at=NULL,active=true,updated_at=NOW() WHERE id=$1 RETURNING *`,[req.params.id]);if(!r.rowCount)return res.status(404).json({message:'المنتج غير موجود.'});await audit(req,'product.restore','product',req.params.id,'استعادة منتج');await publishToGitHub();res.json({product:r.rows[0]})}catch(e){next(e)}});

app.get('/api/admin/audit-logs',authenticate,requireAdmin,async(req,res,next)=>{try{const r=await query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500`);res.json({logs:r.rows})}catch(e){next(e)}});
app.get('/api/admin/health',authenticate,requireAdmin,async(_req,res,next)=>{try{await query('SELECT 1');const g=githubConfig();const b=await query(`SELECT created_at FROM backups ORDER BY created_at DESC LIMIT 1`);res.json({database:'متصل',api:'يعمل',github:g.enabled?'متصل':'غير مربوط',last_backup:b.rows[0]?.created_at?new Date(b.rows[0].created_at).toLocaleString('ar'):'لم يتم بعد',errors:[]})}catch(e){next(e)}});
app.post('/api/admin/backup',authenticate,requireAdmin,async(req,res,next)=>{try{const r=await query(`INSERT INTO backups(kind,location,created_by) VALUES('database','managed-neon', $1) RETURNING *`,[req.user.id]);await audit(req,'backup.create','backup',r.rows[0].id,'إنشاء سجل نسخة احتياطية');res.json({backup:r.rows[0],message:'تم تسجيل النسخة الاحتياطية. النسخ الفعلية لقاعدة Neon تُدار عبر أدوات Neon/الخادم.'})}catch(e){next(e)}});

app.post('/api/admin/upload-image',authenticate,requireAdmin,async(req,res,next)=>{try{const data=String(req.body.data_url||'');const title=String(req.body.title||'nesma-image');const url=await saveImageToGitHub(data,title);res.status(201).json({url})}catch(e){next(e)}});
app.get('/api/admin/notifications',authenticate,requireAdmin,async(_req,res,next)=>{try{const r=await query(`SELECT * FROM popup_notifications ORDER BY sort_order ASC,created_at DESC`);res.json({notifications:r.rows})}catch(e){next(e)}});
app.post('/api/admin/notifications',authenticate,requireAdmin,async(req,res,next)=>{try{const b=req.body||{};const r=await query(`INSERT INTO popup_notifications(title,message,image_url,link_url,position,max_views,page,starts_at,ends_at,active,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[String(b.title||'تنبيه أثير').slice(0,180),String(b.message||''),String(b.image_url||''),String(b.link_url||''),String(b.position||'bottom-right'),Math.max(0,Number(b.max_views||0)),String(b.page||'all'),b.starts_at||null,b.ends_at||null,b.active!==false,Number(b.sort_order||0)]);await audit(req,'notification.create','notification',r.rows[0].id,'إنشاء إشعار منبثق',null,r.rows[0]);res.status(201).json({notification:r.rows[0]})}catch(e){next(e)}});
app.put('/api/admin/notifications/:id',authenticate,requireAdmin,async(req,res,next)=>{try{const b=req.body||{};const r=await query(`UPDATE popup_notifications SET title=$1,message=$2,image_url=$3,link_url=$4,position=$5,max_views=$6,page=$7,starts_at=$8,ends_at=$9,active=$10,sort_order=$11,updated_at=NOW() WHERE id=$12 RETURNING *`,[String(b.title||'').slice(0,180),String(b.message||''),String(b.image_url||''),String(b.link_url||''),String(b.position||'bottom-right'),Math.max(0,Number(b.max_views||0)),String(b.page||'all'),b.starts_at||null,b.ends_at||null,b.active!==false,Number(b.sort_order||0),req.params.id]);if(!r.rowCount)return res.status(404).json({message:'الإشعار غير موجود.'});res.json({notification:r.rows[0]})}catch(e){next(e)}});
app.delete('/api/admin/notifications/:id',authenticate,requireAdmin,async(req,res,next)=>{try{await query(`DELETE FROM popup_notifications WHERE id=$1`,[req.params.id]);res.json({ok:true})}catch(e){next(e)}});
app.get('/api/notifications',async(req,res,next)=>{try{const page=String(req.query.page||'all');const r=await query(`SELECT id,title,message,image_url,link_url,position,page,max_views,views_count FROM popup_notifications WHERE active=true AND (page='all' OR page=$1) AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>NOW()) AND (max_views=0 OR views_count<max_views) ORDER BY sort_order ASC,created_at DESC LIMIT 10`,[page]);for(const n of r.rows) await query(`UPDATE popup_notifications SET views_count=views_count+1,updated_at=NOW() WHERE id=$1 AND (max_views=0 OR views_count<max_views)`,[n.id]);res.json({notifications:r.rows})}catch(e){next(e)}});

app.get('/api/admin/referrals',authenticate,requireAdmin,async(_req,res,next)=>{try{const r=await query(`SELECT u.id,u.name,u.email,u.referral_code,u.points,COUNT(o.id)::int referred_orders,COALESCE(SUM(o.total_yer),0)::numeric referred_sales FROM users u LEFT JOIN orders o ON o.referral_user_id=u.id GROUP BY u.id ORDER BY referred_orders DESC, u.created_at DESC LIMIT 300`);res.json({referrals:r.rows})}catch(e){next(e)}});
app.put('/api/admin/referrals/:id/points',authenticate,requireAdmin,async(req,res,next)=>{try{const points=Math.trunc(Number(req.body.points||0));const r=await query(`UPDATE users SET points=GREATEST(0,points+$1),updated_at=NOW() WHERE id=$2 RETURNING id,points`,[points,req.params.id]);if(!r.rowCount)return res.status(404).json({message:'العميل غير موجود.'});res.json({user:r.rows[0]})}catch(e){next(e)}});

app.get('/api/admin/admins',authenticate,requireAdmin,async(_req,res,next)=>{try{const r=await query(`SELECT a.id,a.role,a.active,a.created_at,u.id user_id,u.name,u.email FROM admins a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC`);res.json({admins:r.rows})}catch(e){next(e)}});
app.post('/api/admin/admins',authenticate,requireAdmin,async(req,res,next)=>{try{const email=String(req.body.email||'').trim().toLowerCase();if(!email)return res.status(400).json({message:'أدخل البريد الإلكتروني.'});const u=await query(`SELECT id,name,email FROM users WHERE lower(email)=lower($1) LIMIT 1`,[email]);if(!u.rowCount)return res.status(404).json({message:'يجب أن يكون البريد مسجلاً في المتجر أولاً، ثم أضفه كمدير.'});const r=await query(`INSERT INTO admins(user_id,role,permissions,active) VALUES($1,$2,$3,'true') ON CONFLICT(user_id) DO UPDATE SET active=true,role=EXCLUDED.role RETURNING *`,[u.rows[0].id,String(req.body.role||'admin'),JSON.stringify(req.body.permissions||{})]);await audit(req,'admin.add','admin',r.rows[0].id,'إضافة مدير آخر',null,{email,role:r.rows[0].role});res.status(201).json({admin:{...r.rows[0],name:u.rows[0].name,email:u.rows[0].email}})}catch(e){next(e)}});
app.put('/api/admin/admins/:id/toggle',authenticate,requireAdmin,async(req,res,next)=>{try{const r=await query(`UPDATE admins SET active=NOT active WHERE id=$1 RETURNING *`,[req.params.id]);res.json({admin:r.rows[0]})}catch(e){next(e)}});

app.get('/api/public/settings',async(_req,res,next)=>{try{const r=await query(`SELECT key,value FROM store_settings`);res.json({settings:Object.fromEntries(r.rows.map(x=>[x.key,x.value]))})}catch(e){next(e)}});
app.get('/api/public/content/:type',async(req,res,next)=>{try{const r=await query(`SELECT payload,status,publish_at,unpublish_at FROM site_content WHERE key=$1 AND status='published' AND (publish_at IS NULL OR publish_at<=NOW()) AND (unpublish_at IS NULL OR unpublish_at>NOW())`,[req.params.type]);res.json({content:r.rows[0]?.payload||contentDefaults[req.params.type]||{}})}catch(e){next(e)}});
app.get('/api/public/page/:slug',async(req,res,next)=>{try{const r=await query(`SELECT payload FROM site_content WHERE key='pages' AND status='published' AND (publish_at IS NULL OR publish_at<=NOW()) AND (unpublish_at IS NULL OR unpublish_at>NOW())`);const pages=r.rows[0]?.payload?.pages||contentDefaults.pages.pages;const page=pages.find(x=>String(x.slug||'').toLowerCase()===String(req.params.slug||'').toLowerCase());if(!page)return res.status(404).json({message:'الصفحة غير موجودة.'});res.json({page});}catch(e){next(e)}});
app.use(express.static(path.join(__dirname,"..","public")));
app.get("/{*splat}",(_req,res)=>res.sendFile(path.join(__dirname,"..","public","index.html")));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({message:err.message||"حدث خطأ في الخادم."});});

async function ensureProductTable(){
  await query(`CREATE TABLE IF NOT EXISTS products(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),title VARCHAR(200) NOT NULL,description TEXT NOT NULL DEFAULT '',category VARCHAR(100) NOT NULL DEFAULT 'عام',category_slugs TEXT[] NOT NULL DEFAULT ARRAY['عام'],audience VARCHAR(20) NOT NULL DEFAULT 'women',image_url TEXT NOT NULL,images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],sizes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],colors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],fabrics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],old_price NUMERIC(12,2),price NUMERIC(12,2) NOT NULL DEFAULT 0,rating NUMERIC(3,2) NOT NULL DEFAULT 5.0,reviews INTEGER NOT NULL DEFAULT 0,tags TEXT NOT NULL DEFAULT '',prep_time INTEGER NOT NULL DEFAULT 10,badges TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],active BOOLEAN NOT NULL DEFAULT TRUE,selected BOOLEAN NOT NULL DEFAULT FALSE,sort_order INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_slugs TEXT[] NOT NULL DEFAULT ARRAY['عام']`); await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`); await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`); await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`); await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS fabrics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`); await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS badges TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`); await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS selected BOOLEAN NOT NULL DEFAULT FALSE`);
  await query(`UPDATE products SET category_slugs=ARRAY[category] WHERE category_slugs IS NULL OR cardinality(category_slugs)=0`);
  await query(`UPDATE products SET badges=CASE WHEN badge IS NOT NULL AND badge<>'' THEN ARRAY[badge] ELSE ARRAY[]::TEXT[] END WHERE cardinality(badges)=0 AND badge IS NOT NULL`);
  await query(`CREATE TABLE IF NOT EXISTS categories(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(100) NOT NULL,slug VARCHAR(120) UNIQUE NOT NULL,image_url TEXT NOT NULL DEFAULT '',active BOOLEAN NOT NULL DEFAULT TRUE,sort_order INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const count=await query(`SELECT COUNT(*)::int AS count FROM categories`); if(!count.rows[0].count){for(const [i,name] of ["عبايات","وصل حديثاً","الأكثر مبيعاً","العروض","إكسسوارات","أطقم"].entries()) await query(`INSERT INTO categories(name,slug,sort_order) VALUES($1,$2,$3) ON CONFLICT(slug) DO NOTHING`,[name,name,i]);}
  await query(`CREATE INDEX IF NOT EXISTS products_active_idx ON products(active,sort_order,created_at DESC)`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32)`); await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0`); await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL`); await query(`CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx ON users(referral_code) WHERE referral_code IS NOT NULL`);
  await query(`CREATE TABLE IF NOT EXISTS orders(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES users(id) ON DELETE SET NULL,status VARCHAR(30) NOT NULL DEFAULT 'pending',customer_name VARCHAR(150) NOT NULL,phone VARCHAR(50) NOT NULL,city VARCHAR(100) NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',currency VARCHAR(3) NOT NULL DEFAULT 'YER',total_yer NUMERIC(14,2) NOT NULL DEFAULT 0,referral_code VARCHAR(32),referral_user_id UUID REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32)`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_user_id UUID REFERENCES users(id) ON DELETE SET NULL`);
  await query(`CREATE TABLE IF NOT EXISTS order_items(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,product_id UUID REFERENCES products(id) ON DELETE SET NULL,name VARCHAR(200) NOT NULL,image_url TEXT NOT NULL DEFAULT '',price_yer NUMERIC(12,2) NOT NULL DEFAULT 0,quantity INTEGER NOT NULL DEFAULT 1,size VARCHAR(100) NOT NULL DEFAULT '',color VARCHAR(100) NOT NULL DEFAULT '',fabric VARCHAR(100) NOT NULL DEFAULT '')`);
  await query(`CREATE TABLE IF NOT EXISTS points_ledger(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,points INTEGER NOT NULL,reason VARCHAR(100) NOT NULL,order_id UUID REFERENCES orders(id) ON DELETE SET NULL,referral_user_id UUID REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS points_ledger_order_reason_idx ON points_ledger(user_id,order_id,reason) WHERE order_id IS NOT NULL`);
  await query(`CREATE TABLE IF NOT EXISTS notifications(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),title VARCHAR(200) NOT NULL,message TEXT NOT NULL DEFAULT '',type VARCHAR(30) NOT NULL DEFAULT 'info',active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await query(`UPDATE users SET referral_code='ATHEER-'||UPPER(SUBSTRING(REPLACE(id::text,'-',''),1,6)) WHERE referral_code IS NULL`);
  await ensureAdminPlatform();
}

app.listen(port,async()=>{console.log(`Auth server running on http://localhost:${port}`);try{await ensureProductTable();console.log("Products/categories tables ready.")}catch(e){console.error("Database setup failed:",e.message);}});
