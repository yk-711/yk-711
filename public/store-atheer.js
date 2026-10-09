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
      document.querySelectorAll('[data-store-name]').forEach(x=>x.textContent=settings.store_name_ar||'أثير');
      const heroTitle=document.querySelector('#hero h1, #hero h2'); if(heroTitle&&content.hero_title)heroTitle.textContent=content.hero_title;
      const heroDesc=document.querySelector('#hero p'); if(heroDesc&&content.hero_description)heroDesc.textContent=content.hero_description;
      const selectedTitle=document.querySelector('#sutoolSelectedSection .section-heading h2'); if(selectedTitle&&content.selected_title)selectedTitle.textContent=content.selected_title;
      const socialMap={facebook:settings.social_facebook,instagram:settings.social_instagram,whatsapp:settings.social_whatsapp,tiktok:settings.social_tiktok,x:settings.social_x};
      document.querySelectorAll('.that-social a').forEach(a=>{const cls=[...a.classList].join(' ')+' '+[...(a.querySelector('i')?.classList||[])].join(' ');const key=cls.includes('facebook')?'facebook':cls.includes('instagram')?'instagram':cls.includes('whatsapp')?'whatsapp':cls.includes('tiktok')?'tiktok':cls.includes('twitter')||cls.includes('x-twitter')?'x':null;if(key){const href=socialMap[key]||'';a.href=href||'#';a.style.display=href?'inline-flex':'none';a.target=href?'_blank':'_self';a.rel=href?'noopener noreferrer':'';}});
      const trendTitle=document.querySelector('#nesma-home-category-title'); if(trendTitle&&content.latest_trends_title)trendTitle.textContent=content.latest_trends_title;
      const trendWrap=document.querySelector('.nesma-home-category-scroller'); const trends=Array.isArray(content.latest_trends)?content.latest_trends:[]; if(trendWrap){if(trends.length){trendWrap.innerHTML=trends.filter(x=>x.active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(x=>`<a class="nesma-home-category-card" href="${String(x.link||'categories.html').replace(/"/g,'&quot;')}"><img src="${String(x.image||'').replace(/"/g,'&quot;')}" alt="${String(x.title||'').replace(/"/g,'&quot;')}" loading="lazy"><div class="nesma-home-category-card__footer"><span>${String(x.title||'')}</span><span>←</span></div></a>`).join('');}else{try{const cr=await fetch(`${API}/api/categories`).then(r=>r.ok?r.json():{categories:[]});const cats=cr.categories||[];trendWrap.innerHTML=cats.slice(0,8).map(x=>`<a class="nesma-home-category-card" href="products-page.html?category=${encodeURIComponent(x.slug)}"><div class="nesma-home-category-card__footer"><span>${String(x.name||'قسم')}</span><span>←</span></div></a>`).join('')||'<div class="empty">أضيفي الأقسام من لوحة الإدارة.</div>';}catch{}}}
      const sovcats=document.querySelector('.sovcats');if(sovcats){try{const cr=await fetch(`${API}/api/categories`).then(r=>r.ok?r.json():{categories:[]});const cats=cr.categories||[];sovcats.innerHTML=`<button type="button" class="sovcat active" data-cat="all">كل المنتجات</button>`+cats.map(x=>`<button type="button" class="sovcat" data-cat="${String(x.slug).replace(/"/g,'&quot;')}">${String(x.name).replace(/</g,'&lt;')}</button>`).join('');sovcats.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{const next=new URL('products-page.html',location.href);if(b.dataset.cat&&b.dataset.cat!=='all')next.searchParams.set('category',b.dataset.cat);location.href=next.toString()}));}catch{}}
      const custom=Array.isArray(content.custom_sliders)?content.custom_sliders:[]; const special=custom.find(sl=>String(sl.title||'').trim()==='اقتراحات خاصة')||custom[0]; if(special){let host=document.getElementById('nesmaCustomSliders');if(!host){host=document.createElement('div');host.id='nesmaCustomSliders';const anchor=document.querySelector('.nesma-home-category-showcase');if(anchor)anchor.insertAdjacentElement('afterend',host);else document.querySelector('#sutoolSelectedSection')?.insertAdjacentElement('afterend',host);}try{const pr=await fetch(`${API}/api/products`).then(r=>r.ok?r.json():{products:[]});const products=pr.products||[];const ids=Array.isArray(special.product_ids)?special.product_ids:[];const ps=ids.map(id=>products.find(p=>String(p.id)===String(id))).filter(p=>p&&p.active!==false);host.innerHTML=ps.length?`<section class="shop-wrap nesma-special-suggestions"><div class="section-heading"><div><span class="shop-kicker">ATHEER · CURATED FOR YOU</span><h2>${String(special.title||'اقتراحات خاصة')}</h2><p>اختيارات أثير التي تستحق أن تكتشفيها</p></div><a href="products-page.html">عرض الكل ←</a></div><div class="nesma-special-vertical" tabindex="0" aria-label="اقتراحات خاصة، مرر للأعلى والأسفل">${ps.map(p=>`<article class="nesma-special-item"><a class="nesma-special-image" href="product.html?id=${encodeURIComponent(p.id)}"><img loading="lazy" src="${String(p.image_url||'').replace(/"/g,'&quot;')}" alt="${String(p.title||'').replace(/[&<>"]/g,'')}"></a><div class="nesma-special-meta"><b>${String(p.title||'')}</b><span>${Number(p.price||0).toLocaleString('en-US')} ر.ي</span><a href="product.html?id=${encodeURIComponent(p.id)}">اكتشفي التفاصيل <span>←</span></a></div></article>`).join('')}</div></section>`:'';}catch{}}

      const catTitle=document.querySelector('.nesma-home-category-showcase__hero h2'); if(catTitle&&content.category_showcase_title)catTitle.textContent=content.category_showcase_title;
      const catDesc=document.querySelector('.nesma-home-category-showcase__hero p'); if(catDesc&&content.category_showcase_description)catDesc.textContent=content.category_showcase_description;
      const slides=Array.isArray(content.slides)?content.slides:[];
      const track=document.querySelector('#nesmaImageSlider .nesma-slider-addon__track');
      if(track&&slides.length){track.innerHTML=slides.filter(x=>x.active!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(x=>`<div class="nesma-slider-addon__slide"><a href="${String(x.link||'#').replace(/"/g,'&quot;')}"><img src="${String(x.image||'').replace(/"/g,'&quot;')}" alt="${String(x.alt||x.title||'').replace(/"/g,'&quot;')}" loading="lazy"></a></div>`).join('');}
    } catch {}
  }
  applyManagedSite();

  const referral=new URLSearchParams(location.search).get('ref'); if(referral&&/^(?:ATHEER|NESMA)-[A-Z0-9]+$/i.test(referral)) localStorage.setItem('nesma-referral-code',referral.toUpperCase());

  accountBtn?.addEventListener('click', async e => {
    e.preventDefault();
    try { const r = await fetch(`${API}/api/auth/me`, {credentials:'include',headers:{...(localStorage.getItem('nesma-auth-token')?{Authorization:'Bearer '+localStorage.getItem('nesma-auth-token')}: {})}}); location.href = r.ok ? 'account.html' : 'login.html'; }
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
  const overlaySearchInput=document.getElementById('searchInput');
  const searchButton=overlaySearchInput?.closest('.sovinput')?.querySelector('button');
  const searchSuggestions=document.getElementById('searchSuggestions');
  const searchTrending=document.getElementById('searchTrending');
  let searchCatalog=[];
  let searchCatalogLoaded=false;
  const escapeSearchHtml=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const goSearch=term=>{const q=String(term !== undefined ? term : (overlaySearchInput?.value || '')).trim();if(overlaySearchInput&&term!==undefined)overlaySearchInput.value=q;const next=new URL('products-page.html',location.href);if(q)next.searchParams.set('q',q);location.href=next.toString();};
  const renderSearchSuggestions=()=>{
    if(!searchSuggestions)return;
    const q=String(overlaySearchInput?.value||'').trim().toLocaleLowerCase('ar');
    if(!searchCatalog.length){searchSuggestions.innerHTML='<span class=\"sov-empty\">ابدئي بكتابة اسم العباية أو أي كلمة من تفاصيلها</span>';return;}
    let items=searchCatalog.filter(p=>{const hay=[p.title,p.description,p.category,p.tags,p.colors,p.fabrics,p.sizes].filter(Boolean).join(' ').toLocaleLowerCase('ar');return !q||hay.includes(q);}).slice(0,6);
    if(!q)items=searchCatalog.slice(0,6);
    searchSuggestions.innerHTML=items.length?items.map(p=>`<button type=\"button\" class=\"sovsuggest-item\" data-search-term=\"${escapeSearchHtml(p.title||'')}\"><span class=\"sovsuggest-dot\"></span><span>${escapeSearchHtml(p.title||'منتج')}</span></button>`).join(''):'<span class=\"sov-empty\">لا توجد اقتراحات مطابقة</span>';
    searchSuggestions.querySelectorAll('[data-search-term]').forEach(b=>b.addEventListener('click',()=>goSearch(b.dataset.searchTerm)));
  };
  const renderTrending=()=>{
    if(!searchTrending)return;
    const fallback=['عبايات','عباية سوداء','عبايات مطرزة','وصل حديثاً','الأكثر مبيعاً','العروض'];
    const terms=[];
    searchCatalog.slice(0,30).forEach(p=>{[p.category,p.tags].filter(Boolean).forEach(v=>String(v).split(/[,،|]/).map(x=>x.trim()).filter(x=>x.length>2&&x.length<35).forEach(x=>{if(!terms.includes(x))terms.push(x);}));});
    const list=[...terms,...fallback].filter((x,i,a)=>a.indexOf(x)===i).slice(0,8);
    searchTrending.innerHTML=list.map(x=>`<button type=\"button\" class=\"ttag\" data-search-term=\"${escapeSearchHtml(x)}\">${escapeSearchHtml(x)}</button>`).join('');
    searchTrending.querySelectorAll('[data-search-term]').forEach(b=>b.addEventListener('click',()=>goSearch(b.dataset.searchTerm)));
  };
  const loadSearchCatalog=async()=>{
    if(searchCatalogLoaded)return; searchCatalogLoaded=true;
    try{const r=await fetch(`${API}/api/products`);const d=r.ok?await r.json():{};searchCatalog=Array.isArray(d.products)?d.products:[];}catch{searchCatalog=[];}
    renderSearchSuggestions();renderTrending();
  };
  search?.addEventListener('click',()=>{setMobileNav(false);overlay?.classList.add('open');loadSearchCatalog();renderSearchSuggestions();setTimeout(()=>document.getElementById('searchInput')?.focus(),80);});
  closeSearch?.addEventListener('click',()=>overlay?.classList.remove('open'));
  overlaySearchInput?.addEventListener('input',renderSearchSuggestions);
  searchButton?.addEventListener('click',()=>goSearch());
  overlaySearchInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();goSearch()}});

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
