/* P20–28: page-scoped, bounded Lumia breeze. Decorative elements never receive input. */
(() => {
  const app = document.getElementById('app');
  const root = app.querySelector('.lumia-atmosphere');
  const flowers = root.querySelector('.lumia-atmosphere-blooms');
  const petals = root.querySelector('.lumia-atmosphere-petals');
  const assets = {
    flowers: ['front', 'threequarter', 'upward', 'downward'].map(v => `assets/lumia_flower_${v}.webp`),
    petals: ['front', 'back', 'twisted', 'curved'].map(v => `assets/lumia_petal_${v}.webp`)
  };
  Object.values(assets).flat().forEach(src => { const img = new Image(); img.src = src; });
  // Page presets: deliberately sparse during fear, memory, tears and farewell.
  const settings = {
    20:{heads:5,angle:2.1,period:6.5,interval:850,max:10,first:800,drift:1},
    21:{heads:0,angle:0,period:0,interval:0,max:0},
    22:{heads:0,angle:0,period:0,interval:0,max:0},
    23:{heads:0,angle:0,period:0,interval:0,max:0},
    24:{heads:3,angle:0,period:0,interval:0,max:3},
    25:{heads:1,angle:.15,period:10,interval:7000,max:1,first:3300},
    26:{heads:4,angle:1.05,period:8.1,interval:2100,max:5,first:1200,drift:.7},
    27:{heads:0,angle:0,period:0,interval:0,max:0},
    28:{heads:8,angle:1.8,period:7.2,interval:700,max:13,first:450,drift:.9}
  };
  // These are possible patches of ground, not fixed slots tied to the cast.
  // A site is used only if the *rendered* flower clears every visible figure.
  const flowerSites = {
    village:[{x:12,y:31},{x:59,y:67},{x:78,y:47},{x:28,y:33},{x:70,y:76},{x:43,y:63},{x:85,y:32},{x:37,y:79},{x:55,y:42},{x:9,y:75},{x:91,y:74},{x:64,y:54}],
    waterside:[{x:4,y:6},{x:15,y:5},{x:4,y:35},{x:85,y:7},{x:12,y:12},{x:70,y:27},{x:50,y:42},{x:82,y:46},{x:30,y:10},{x:63,y:61},{x:88,y:17},{x:45,y:24},{x:76,y:75},{x:20,y:70},{x:90,y:64},{x:56,y:76}]
  };
  let current=0, generation=0, tasks=[], sequence=0, reacting=false;
  const random=(min,max)=>min+Math.random()*(max-min);
  // Separate spatial rhythms: village wind, quiet meeting, and open new morning.
  const motionArea=n=>n===26?{x:[45,81],y:[24,62],drift:[2,9],fall:[170,320]}:
    n===27?{x:[62,87],y:[24,67],drift:[-4,2],fall:[100,240]}:
    n===28?{x:[37,88],y:[-8,48],drift:[-9,15],fall:[300,560]}:
    n===20?{x:[40,85],y:[8,65],drift:[-4,9],fall:[190,420]}:
    {x:[40,85],y:[-3,48],drift:[-4,10],fall:[260,480]};
  const reduced=()=>app.classList.contains('no-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const later=(fn,ms)=>{const token=generation;const id=setTimeout(()=>{if(token===generation)fn();},ms);tasks.push(id);};
  function clear(){
    ++generation;tasks.forEach(clearTimeout);tasks=[];reacting=false;sequence=0;
    flowers.replaceChildren();petals.replaceChildren();
    app.dataset.lumiaAtmosphere='off';
  }
  function layout(n,opts){
    const area=motionArea(n);
    const sites=flowerSites[n>=27?'waterside':'village'];
    const scene=root.getBoundingClientRect();
    const protectedAreas=[...app.querySelectorAll('.rio-figure.is-visible,.shiro-figure.is-visible,.mora-figure.is-visible,.combined-figure,.copy')]
      .filter(el=>el.classList.contains('is-visible')||el.classList.contains('copy')||(el.classList.contains('combined-figure')&&['hug','empty'].includes(app.dataset.combined)))
      .map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
    const placed=[];
    const intersects=(a,b,pad)=>!(a.right+pad<b.left||a.left-pad>b.right||a.bottom+pad<b.top||a.top-pad>b.bottom);
    for(let i=0;i<opts.heads;i++){
      const holder=document.createElement('span');
      holder.className='lumia-atmosphere-head drifting';
      holder.style.animation='none'; // Measure the real box before starting the sway.
      holder.style.setProperty('--sway',`${opts.angle}deg`);
      holder.style.setProperty('--sway-duration',`${opts.period+i*.9}s`);
      holder.style.setProperty('--sway-delay',`${-i*1.7}s`);
      holder.style.setProperty('--flower-duration',`${random(10,15).toFixed(1)}s`);
      holder.style.setProperty('--flower-opacity',String(n===20?.55:n===25?.37:n===28?.52:.82));
      holder.style.setProperty('--flower-fall',`${random(...area.fall).toFixed(0)}px`);
      holder.style.setProperty('--flower-drift',`${random(...area.drift).toFixed(1)}vw`);
      holder.style.setProperty('--flower-turn',`${random(n===28?-165:-22,n===28?165:22).toFixed(1)}deg`);
      holder.style.setProperty('--flower-mid-turn',`${random(n===28?-55:8,n===28?55:8).toFixed(1)}deg`);
      const img=document.createElement('img');
      img.src=assets.flowers[(i+(n===27?1:0))%4];img.alt='';
      holder.appendChild(img);flowers.appendChild(holder);
      let found=false;
      for(let j=0;j<32;j++){
        const site={x:random(...area.x),y:random(...area.y)};
        holder.style.left=`${site.x}%`;
        holder.style.top=`${site.y}%`;
        const rect=holder.getBoundingClientRect();
        if(rect.left<scene.left+8||rect.right>scene.right-8||rect.bottom>scene.bottom-28)continue;
        // A few flowers may pass in front of a character, but most must remain independent.
        const occupied=protectedAreas.filter(actor=>intersects(rect,actor,18));
        const overlapsCopy=occupied.some(actor=>actor.width>scene.width*.4&&actor.height<scene.height*.45);
        if(overlapsCopy)continue;
        // Floating flowers are allowed to cross Mora and occasionally Rio.
        if(placed.some(previous=>intersects(rect,previous,16)))continue;
        placed.push(rect);found=true;break;
      }
      if(!found){holder.remove();continue;}
      holder.addEventListener('animationiteration',()=>{
        holder.style.left=`${random(...area.x).toFixed(1)}%`;
        holder.style.top=`${random(...area.y).toFixed(1)}%`;
        holder.style.setProperty('--flower-drift',`${random(...area.drift).toFixed(1)}vw`);
        holder.style.setProperty('--flower-fall',`${random(...area.fall).toFixed(0)}px`);
        holder.style.setProperty('--flower-turn',`${random(n===28?-165:-22,n===28?165:22).toFixed(1)}deg`);
        holder.style.setProperty('--flower-mid-turn',`${random(n===28?-55:8,n===28?55:8).toFixed(1)}deg`);
      });
      if(n===28){
        // Reuse the existing quiet flower-touch response after removing the large prose-side flower.
        holder.style.pointerEvents='auto';holder.tabIndex=0;holder.setAttribute('role','button');
        holder.setAttribute('aria-label','ルミアの花に触れる');
        const touch=()=>document.querySelector('.lumia-flower.flower-a')?.click();
        holder.addEventListener('click',touch);
        holder.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();touch();}});
      }
      holder.style.removeProperty('animation');
    }
  }
  function onePetal(opts,large=false){
    if(reduced()||!opts.max||petals.childElementCount>=opts.max)return;
    const i=sequence++;
    const img=document.createElement('img');
    img.alt='';img.className=`lumia-atmosphere-petal ${large?'near':'middle'}`;
    img.src=assets.petals[i%assets.petals.length];
    // Independent launch points and fall paths on each visit, including over Mora.
    const area=motionArea(current);
    img.style.left=`${random(...area.x).toFixed(1)}%`;
    img.style.top=`${random(...area.y).toFixed(1)}%`;
    img.style.setProperty('--petal-x',`${random(...area.drift).toFixed(1)}vw`);
    img.style.setProperty('--petal-fall',`${random(...area.fall).toFixed(0)}px`);
    img.style.setProperty('--petal-turn',`${random(-110,110).toFixed(0)}deg`);
    img.style.setProperty('--petal-duration',`${random(current===28?7.5:8,current===28?12:12).toFixed(1)}s`);
    img.style.setProperty('--petal-opacity',String(current===20?.36:current===25?.28:current===28?.48:.54));
    img.addEventListener('animationend',()=>img.remove(),{once:true});
    petals.appendChild(img);
  }
  function schedulePetals(opts){
    if(!opts.interval)return;
    later(()=>{
      onePetal(opts,sequence%5===4 && window.innerWidth>760);
      schedulePetals({...opts,first:0});
    },opts.first||opts.interval);
  }
  function begin(n){
    clear();current=n;
    const opts=settings[n];if(!opts)return;
    app.dataset.lumiaAtmosphere='on';
    if(n!==24)layout(n,opts);
    if(!reduced())schedulePetals(opts);
  }
  function react(){
    if(current!==24||reacting||reduced())return;
    reacting=true;
    // The existing crack-light cue is dispatched at glow onset, after tear contact.
    later(()=>{
      layout(24,settings[24]);
      [...flowers.children].forEach((head,i)=>later(()=>{
        head.classList.add('response');
        later(()=>head.classList.remove('response'),1750);
      },i*140));
      later(()=>onePetal(settings[24]),700);
      later(()=>onePetal(settings[24]),1600);
      later(()=>onePetal(settings[24]),2400);
    },430);
  }
  window.addEventListener('shirotsuchi:page-ready',e=>begin(e.detail.page));
  window.addEventListener('shirotsuchi:lumia-light',react);
  document.getElementById('motion')?.addEventListener('click',()=>{
    // Stop emitted petals immediately on motion changes, without resetting story cues.
    if(reduced())petals.replaceChildren();
  });
  begin(Number(app.dataset.page)+1);
})();
