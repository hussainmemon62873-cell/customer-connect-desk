(function(){
  'use strict';
  var canonical=document.querySelector('link[rel="canonical"]');
  var url=(canonical&&canonical.href)||window.location.href;
  var title=document.querySelector('meta[property="og:title"]')?.content||document.title||'Dynamic QR Platform';
  var description=document.querySelector('meta[property="og:description"]')?.content||document.querySelector('meta[name="description"]')?.content||'Explore the Dynamic QR Platform.';
  var message=title+'\n'+description+'\nLearn more: '+url;
  var encode=function(value){return encodeURIComponent(value);};
  document.querySelectorAll('[data-share-kind]').forEach(function(link){
    var kind=link.getAttribute('data-share-kind');
    if(kind==='whatsapp')link.href='https://wa.me/?text='+encode(message);
    if(kind==='facebook')link.href='https://www.facebook.com/sharer/sharer.php?u='+encode(url);
    if(kind==='linkedin')link.href='https://www.linkedin.com/sharing/share-offsite/?url='+encode(url);
  });
  var status=document.querySelector('[data-share-status]');
  function announce(text){if(status)status.textContent=text;}
  var copy=document.querySelector('[data-share-copy]');
  if(copy)copy.addEventListener('click',async function(){
    try{
      if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(message);}
      else{
        var field=document.createElement('textarea');field.value=message;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
        var ok=document.execCommand('copy');field.remove();if(!ok)throw new Error('copy unavailable');
      }
      announce('Share text and link copied. Paste it into your message.');
    }catch(error){announce('Copy is unavailable in this browser. Use one of the share links instead.');}
  });
  var nativeButton=document.querySelector('[data-share-native]');
  if(nativeButton&&navigator.share){nativeButton.hidden=false;nativeButton.addEventListener('click',async function(){
    try{await navigator.share({title:title,text:description,url:url});}catch(error){if(error&&error.name!=='AbortError')announce('Sharing could not be opened. Please use WhatsApp or Copy link.');}
  });}
})();
