const links=[...document.querySelectorAll('.timeline-link')];
const groups=[...document.querySelectorAll('.month-group')];
let lockedUntil=0;
function activate(id){let selected;const previous=links.find(link=>link.getAttribute('aria-current')==='true');for(const link of links){if(link.hash.slice(1)===id){link.setAttribute('aria-current','true');selected=link;}else link.removeAttribute('aria-current');}const panel=document.querySelector('.timeline');if(selected&&selected!==previous&&panel.scrollWidth>panel.clientWidth){panel.scrollTo({left:selected.offsetLeft-panel.clientWidth/2+selected.offsetWidth/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}
for(const link of links){link.addEventListener('click',()=>{activate(link.hash.slice(1));lockedUntil=performance.now()+1100;});}
let pending=false;
function update(){pending=false;if(performance.now()<lockedUntil)return;const target=innerHeight*.28;let closest=groups[0];for(const group of groups){if(group.getBoundingClientRect().top<=target)closest=group;else break;}if(closest)activate(closest.id);}
addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(update);}},{passive:true});
addEventListener('resize',update);addEventListener('hashchange',()=>{if(location.hash)activate(location.hash.slice(1));});
if(location.hash)activate(location.hash.slice(1));else update();
setTimeout(update,1200);
