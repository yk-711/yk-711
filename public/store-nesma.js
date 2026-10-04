(() => {
  const API = 'https://nesma-store.onrender.com';
  const accountBtn = document.getElementById('accountBtn');
  const currencySelect = document.getElementById('currencySelect');
  const currencyToggle = document.getElementById('currencyToggle');
  const currencyShort = document.getElementById('currencyShort');
  const cartFab = document.getElementById('cartFab');
  const navToggle = document.querySelector('.navbar-toggler');
  const navMenu = document.getElementById('navmenu');
  const navBackdrop = document.getElementById('navBackdrop');
  const search = document.getElementById('navSearchBtn');
  const overlay = document.getElementById('searchOv');
  const closeSearch = document.getElementById('searchClose');


  async function applyManagedSite(){
    try {
      const [sr,cr]=await Promise.all([fetch(`${API}/api/public/settings`).then(r=>r.ok?r.json():{}),fetch(`${API}/api/public/content/homepage`).then(r=>r.ok?r.json():{})]);
      const settings=sr.settings||{}, content=cr.content||{};
      document.title=settings.seo_title||document.title;
      const desc=document.querySelector('meta[name="description"]'); if(desc&&settings.seo_description) desc.setAttribute('content',settings.seo_description);
      document.querySelectorAll('[data-store-name]').forEach(x=>x.textContent=settings.store_name_ar||'نسمة');
      const heroTitle=document.querySelector('#hero h1, #hero h2'); if(heroTitle&&content.hero_title)heroTitle.textContent=content.hero_title;
      const heroDesc=document.querySelector('#hero p'); if(heroDesc&&content.hero_description)heroDesc.textContent=content.hero_description;
      const selectedTitle=document.querySelector('#sutoolSelectedSection .section-heading h2'); if(selectedTitle&&content.selected_title)selectedTitle.textContent=content.selected_title;
      const socialMap={facebook:settings.social_facebook,instagram:settings.social_instagram,whatsapp:settings.social_whatsapp,tiktok:settings.social_tiktok,x:settings.social_x};
      document.querySelectorAll('.that-social a').forEach(a=>{const cls=[...a.classList].join(' ')+' '+[...(a.querySelector('i')?.classList||[])].join(' ');const key=cls.includes('facebook')?'facebook':cls.includes('instagram')?'instagram':cls.includes('whatsapp')?'whatsapp':cls.includes('tiktok')?'tiktok':cls.includes('twitter')||cls.includes('x-twitter')?'x':null;if(key){const href=socialMap[key]||'';a.href=href||'#';a.style.display=href?'inline-flex':'none';a.target=href?'_blank':'_self';a.rel=href?'noopener noreferrer':'';}});
      const trendTitle=document.querySelector('#nesma-home-category-title'); if(trendTitle&&content.latest_trends_title)trendTitle.textContent=content.latest_trends_title;
      const trendWrap=document.querySelector('.nesma-home-category-scroller'); const trends=Array.isArray(content.latest_trends)?content.latest_trends:[]; if(trendWrap&&trends.length){trendWrap.innerHTML=trends.filter(x=>x.active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(x=>`<a class="nesma-home-category-card" href="${String(x.link||'categories.html').replace(/"/g,'&quot;')}"><img src="${String(x.image||'').replace(/"/g,'&quot;')}" alt="${String(x.title||'').replace(/"/g,'&quot;')}" loading="lazy"><div class="nesma-home-category-card__footer"><span>${String(x.title||'')}</span><span>←</span></div></a>`).join('');}
      const custom=Array.isArray(content.custom_sliders)?content.custom_sliders:[]; if(custom.length){let host=document.getElementById('nesmaCustomSliders');if(!host){host=document.createElement('div');host.id='nesmaCustomSliders';document.querySelector('#sutoolSelectedSection')?.insertAdjacentElement('afterend',host);}try{const pr=await fetch(`${API}/api/products`).then(r=>r.ok?r.json():{products:[]});const products=pr.products||[];host.innerHTML=custom.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map((sl,i)=>{const ids=sl.product_ids||[];const ps=ids.length?ids.map(id=>products.find(p=>String(p.id)===String(id))).filter(Boolean):products.slice(0,12);return `<section class="shop-wrap nesma-custom-slider"><div class="section-heading"><div><span class="shop-kicker">NESMA COLLECTION</span><h2>${String(sl.title||'تشكيلة مختارة')}</h2></div><a href="products-page.html">عرض الكل ←</a></div><div class="selected-slider"><div class="selected-track">${ps.map(p=>`<article class="mwrap"><div class="mcard" data-id="${p.id}" data-title="${String(p.title||'').replace(/"/g,'&quot;')}" data-price="${p.price||0}"><img src="${p.image_url||''}" alt=""><div class="mmeta"><b>${String(p.title||'')}</b><span>${Number(p.price||0).toLocaleString('en-US')} ر.ي</span></div></div></article>`).join('')}</div></div></section>`}).join('');}catch{}}

      const catTitle=document.querySelector('.nesma-home-category-showcase__hero h2'); if(catTitle&&content.category_showcase_title)catTitle.textContent=content.category_showcase_title;
      const catDesc=document.querySelector('.nesma-home-category-showcase__hero p'); if(catDesc&&content.category_showcase_description)catDesc.textContent=content.category_showcase_description;
      const slides=Array.isArray(content.slides)?content.slides:[];
      const track=document.querySelector('#nesmaImageSlider .nesma-slider-addon__track');
      if(track&&slides.length){track.innerHTML=slides.filter(x=>x.active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(x=>`<div class="nesma-slider-addon__slide"><a href="${String(x.link||'#').replace(/"/g,'&quot;')}"><img src="${String(x.image||'').replace(/"/g,'&quot;')}" alt="${String(x.alt||x.title||'').replace(/"/g,'&quot;')}" loading="lazy"></a></div>`).join('');}
    } catch {}
  }
  applyManagedSite();

  const referral=new URLSearchParams(location.search).get('ref'); if(referral&&/^NESMA-[A-Z0-9]+$/i.test(referral)) localStorage.setItem('nesma-referral-code',referral.toUpperCase());

  accountBtn?.addEventListener('click', async e => {
    e.preventDefault();
    try { const r = await fetch(`${API}/api/auth/me`, {credentials:'include'}); location.href = r.ok ? 'account.html' : 'login.html'; }
    catch { location.href = 'login.html'; }
  });
  cartFab?.addEventListener('click', () => { location.href = 'cart.html'; });

  const isHomePage = /(?:^|\/)index\.html?$/.test(location.pathname) || location.pathname.endsWith('/');
  // جميع الأسعار في المتجر مخزنة بالريال اليمني، والتحويل يتم مباشرة من YER.
  const currencyRates = { yer: 1, sar: 1/140, usd: 1/532 };
  const currencyLabels = { yer: 'ر.ي', sar: 'ر.س', usd: '$' };
  const currencyCodes = { yer: 'YER', sar: 'SAR', usd: 'USD' };
  let activeCurrency = localStorage.getItem('nesma-currency') || 'yer';
  const numberPrice = value => { const m=String(value??'').replace(/,/g,'').match(/[0-9]+(?:\.[0-9]+)?/); return m?Number(m[0]):0; };
  const priceText = basePrice => { const v=numberPrice(basePrice)*currencyRates[activeCurrency]; return `${activeCurrency==='yer'?Math.round(v).toLocaleString('en-US'):v.toFixed(2)} ${currencyLabels[activeCurrency]}`; };
  function refreshPrices(){ document.querySelectorAll('.mcard').forEach(card=>{ const p=card.querySelector('.mprice'); if(p)p.textContent=priceText(card.dataset.price); const o=card.querySelector('.mold'); if(o&&card.dataset.old)o.textContent=priceText(card.dataset.old); }); }
  function syncCurrency(){
    if(currencySelect) currencySelect.value=activeCurrency;
    if(currencyShort) currencyShort.textContent=currencyCodes[activeCurrency];
    refreshPrices();
    window.NesmaShop?.setCurrency?.(activeCurrency.toUpperCase());
    document.dispatchEvent(new CustomEvent('nesma:currency',{detail:activeCurrency.toUpperCase()}));
  }
  currencySelect?.addEventListener('change',e=>{
    const next=String(e.target.value||'yer').toLowerCase();
    if(!currencyRates[next]) return;
    activeCurrency=next; localStorage.setItem('nesma-currency',activeCurrency); syncCurrency();
  });
  currencyToggle?.addEventListener('click',()=>{
    const order=['yer','sar','usd'];
    activeCurrency=order[(order.indexOf(activeCurrency)+1)%order.length];
    localStorage.setItem('nesma-currency',activeCurrency); syncCurrency();
  });
  syncCurrency();

  function setMobileNav(open){ if(!navMenu||!navToggle||!navBackdrop)return; const next=window.innerWidth<992&&open; navMenu.classList.toggle('show',next);navMenu.classList.toggle('mobile-open',next);navBackdrop.classList.toggle('show',next);navBackdrop.setAttribute('aria-hidden',String(!next));navToggle.setAttribute('aria-expanded',String(next));document.body.classList.toggle('nav-locked',next); }
  navToggle?.setAttribute('aria-expanded','false'); navToggle?.addEventListener('click',e=>{e.preventDefault();setMobileNav(!navMenu?.classList.contains('mobile-open'));}); navBackdrop?.addEventListener('click',()=>setMobileNav(false)); navMenu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMobileNav(false))); window.addEventListener('resize',()=>{if(window.innerWidth>=992)setMobileNav(false);});
  search?.addEventListener('click',()=>{setMobileNav(false);overlay?.classList.add('open');}); closeSearch?.addEventListener('click',()=>overlay?.classList.remove('open'));

  // النقر على بطاقة المنتج يفتح صفحة التفاصيل الاحترافية، وليس نافذة منبثقة.
  function bindProductCards(){ document.querySelectorAll('.mcard').forEach(card=>{
    if(card.dataset.detailBound==='1')return; card.dataset.detailBound='1';
    const go=()=>{ const id=card.dataset.id || card.getAttribute('data-id'); if(id) location.href=`product.html?id=${encodeURIComponent(id)}`; };
    card.addEventListener('click',e=>{ if(e.target.closest('.fav-btn,button,a,input,select')) return; go(); });
    card.querySelector('.madd')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();go();});
  }); }
  document.querySelectorAll('.mcard').forEach((card,i)=>{ if(!card.dataset.id){ const title=card.dataset.title||''; card.dataset.id=card.dataset.id||card.getAttribute('data-product-id')||''; } });
  bindProductCards();

  const filterButtons=[...document.querySelectorAll('.filter-btn')],sortSelect=document.getElementById('sortSelect'),mgrid=document.getElementById('mgrid'),searchInput=document.getElementById('searchInput'),searchStatus=document.getElementById('searchStatus');
  let activeFilter='all',searchQuery='';
  function applyCatalogView(){ if(!mgrid)return; const items=[...mgrid.querySelectorAll('.mwrap')].map(wrapper=>({wrapper,card:wrapper.querySelector('.mcard')})).filter(x=>x.card); items.forEach(({wrapper,card})=>{const hay=`${card.dataset.title||''} ${card.dataset.cat||''} ${card.dataset.tags||''}`.toLocaleLowerCase();wrapper.style.display=(activeFilter==='all'||card.dataset.audience===activeFilter)&&(!searchQuery||hay.includes(searchQuery))?'':'none';}); const visible=items.filter(x=>x.wrapper.style.display!=='none'); const sort=sortSelect?.value||'default'; if(sort!=='default')visible.sort((a,b)=>{const d=numberPrice(a.card.dataset.price)-numberPrice(b.card.dataset.price);return sort==='low'?d:-d;}); visible.concat(items.filter(x=>x.wrapper.style.display==='none')).forEach(x=>mgrid.appendChild(x.wrapper)); if(searchStatus){searchStatus.textContent=searchQuery?`${visible.length} منتج مطابق للبحث`:'اكتبي اسم المنتج أو الفئة للبحث السريع';searchStatus.classList.toggle('empty',visible.length===0);} bindProductCards(); }
  filterButtons.forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter||'all';filterButtons.forEach(x=>x.classList.toggle('active',x===b));applyCatalogView();})); sortSelect?.addEventListener('change',applyCatalogView); searchInput?.addEventListener('input',()=>{searchQuery=searchInput.value.trim().toLocaleLowerCase();applyCatalogView();});
  document.querySelectorAll('.mcard').forEach(card=>{card.style.position='relative';if((card.dataset.tags||'').includes('جديد')&&!card.querySelector('.new-badge'))card.insertAdjacentHTML('afterbegin','<span class="new-badge">جديد</span>');if(!card.querySelector('.fav-btn')){const fav=document.createElement('button');fav.className='fav-btn';fav.type='button';fav.setAttribute('aria-label','إضافة إلى المفضلة');const key=`fav-${card.dataset.id||card.dataset.title}`;fav.textContent=localStorage.getItem(key)==='1'?'♥':'♡';fav.addEventListener('click',e=>{e.stopPropagation();const next=localStorage.getItem(key)==='1'?'0':'1';localStorage.setItem(key,next);fav.textContent=next==='1'?'♥':'♡';});card.prepend(fav);}});
  applyCatalogView();
})();
