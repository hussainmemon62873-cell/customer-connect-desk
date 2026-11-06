(function(){
  'use strict';
  var config=window.DQR_ADS_CONFIG||{};
  var publisher=String(config.publisherId||'');
  if(config.enabled!==true||!/^ca-pub-\d{10,}$/.test(publisher))return;
  var page=document.body&&document.body.dataset?document.body.dataset.page||'':'public';
  if(page==='customer'||page==='admin')return;
  var slots=config.slots||{};
  var units=document.querySelectorAll('[data-ad-slot]');
  if(!units.length)return;
  var script=document.createElement('script');
  script.async=true;
  script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(publisher);
  script.crossOrigin='anonymous';
  script.onload=function(){units.forEach(function(slot){
    var id=String(slots[slot.getAttribute('data-ad-slot')]||'');
    if(!/^\d{5,}$/.test(id))return;
    slot.innerHTML='<span class="ad-label">Advertisement</span><ins class="adsbygoogle" style="display:block" data-ad-client="'+publisher+'" data-ad-slot="'+id+'" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    slot.hidden=false;
    try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch(e){slot.hidden=true;}
  });};
  document.head.appendChild(script);
})();
