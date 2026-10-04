(() => {
  const API=window.API_BASE||'https://nesma-store.onrender.com';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  function show(list){
    const n=list?.[0]; if(!n)return;
    const box=document.createElement('div');
    const pos={"bottom-right":"right:18px;bottom:18px","bottom-left":"left:18px;bottom:18px","top-center":"left:50%;top:18px;transform:translateX(-50%)","center":"left:50%;top:50%;transform:translate(-50%,-50%)"}[n.position]||'right:18px;bottom:18px';
    box.style.cssText=`position:fixed;${pos};z-index:99999;width:min(92vw,390px);background:linear-gradient(145deg,#101010,#080808);color:#fff;border:1px solid #9b7838;border-radius:22px;padding:18px 44px 18px 18px;box-shadow:0 20px 70px rgba(0,0,0,.55);font-family:Tajawal,Arial,sans-serif`;
    box.innerHTML=`<button aria-label="إغلاق" style="position:absolute;right:10px;top:8px;background:none;border:0;color:#d5b56e;font-size:24px;cursor:pointer">×</button>${n.image_url?`<img src="${esc(n.image_url)}" style="width:100%;height:150px;object-fit:cover;border-radius:14px;margin-bottom:12px">`:''}<strong style="color:#d5b56e;display:block;margin-bottom:7px;font-size:18px">${esc(n.title)}</strong><div style="line-height:1.9;color:#ddd">${esc(n.message)}</div>${n.link_url?`<a href="${esc(n.link_url)}" style="display:inline-block;margin-top:12px;color:#111;background:#d5b56e;padding:9px 16px;border-radius:12px;text-decoration:none;font-weight:800">اكتشفي المزيد</a>`:''}`;
    box.querySelector('button').onclick=()=>box.remove(); document.body.appendChild(box);
  }
  document.addEventListener('DOMContentLoaded',async()=>{try{const page=location.pathname.includes('index')||location.pathname.endsWith('/')?'home':location.pathname.includes('products')?'products':location.pathname.includes('checkout')?'checkout':'all';const r=await fetch(`${API}/api/notifications?page=${page}`);const d=await r.json();show(d.notifications||[])}catch{}});
})();
