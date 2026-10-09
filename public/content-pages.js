(() => {
  const API='https://nesma-store.onrender.com';
  const slug=new URLSearchParams(location.search).get('slug')||location.pathname.split('/').pop().replace(/\.html$/i,'')||'about';
  const titleEl=document.getElementById('pageTitle'),bodyEl=document.getElementById('pageContent');
  fetch(`${API}/api/public/page/${encodeURIComponent(slug)}`).then(async r=>{if(!r.ok)throw new Error('not-found');return r.json()}).then(({page})=>{document.title=`${page.title} | أثير`;titleEl.textContent=page.title;bodyEl.innerHTML=page.content||'<p>لا يوجد محتوى منشور لهذه الصفحة حالياً.</p>';}).catch(()=>{titleEl.textContent='الصفحة غير متاحة';bodyEl.innerHTML='<p>عذراً، هذه الصفحة غير متاحة حالياً.</p><a class="luxury-link" href="./">العودة إلى الرئيسية</a>';});
  document.getElementById('cartFab')?.addEventListener('click',()=>location.href='cart.html');
  document.getElementById('navSearchBtn')?.addEventListener('click',()=>document.getElementById('searchOv')?.classList.add('open'));
  document.getElementById('searchClose')?.addEventListener('click',()=>document.getElementById('searchOv')?.classList.remove('open'));
  const input=document.getElementById('searchInput');input?.addEventListener('keydown',e=>{if(e.key==='Enter'){const q=input.value.trim();location.href=`products-page.html${q?'?q='+encodeURIComponent(q):''}`}});
})();