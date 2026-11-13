/* 『しろつち』感情差分。既存render/ページ送りを拡張し、差分タイマーを必ず破棄する。 */
(() => {
  const app = document.getElementById('app');
  const figures = {
    rio: document.querySelector('.rio-figure'),
    shiro: document.getElementById('shiro'),
    mora: document.getElementById('mora')
  };
  const imagePaths = {
    rio: {default:'assets/rio.webp', finalStep:'assets/rio_final_step.webp', tears:'assets/rio_tears.webp', down:'assets/rio_down.webp',cheekTear:'assets/rio_cheek_tear.webp',emptyArms:'assets/rio_empty_arms.webp'},
    shiro: {default:'assets/shiro.webp', lean:'assets/shiro_small_head_tilt_opposite.webp', stage1:'assets/shiro_stage1.webp',stage2:'assets/shiro_stage2.webp',stage3:'assets/shiro_stage3.webp',preGlow:'assets/shiro_pre_glow.webp',farewellGlow:'assets/shiro_farewell_glow.webp'},
    mora: {default:'assets/mora.webp', sad:'assets/mora_sad.webp'},
    combined: {hug:'assets/rio_hug.webp',empty:'assets/rio_empty_arms.webp'},
    memory: {hand:'assets/grandmother_hand_p22.webp',grandmother:'assets/grandmother_memory.webp'},
    lumia: {sprout:'assets/lumia_sprout.webp',bud:'assets/lumia_bud.webp',bloom:'assets/lumia_bloom.webp',petal:'assets/lumia_petal.webp'},
    effect: {crack:'assets/shiro_crack_mask.webp',fallingTear:'assets/falling_tear.webp'}
  };
  const primaryImages = Object.fromEntries(Object.entries(figures).map(([key,root]) => [key,root.querySelector('img')]));
  const combined = document.getElementById('rio-hug');
  const memoryHand = document.getElementById('grandmother-hand');
  const memoryCut = document.querySelector('.grandmother-memory');
  const flowerImages = [...document.querySelectorAll('.lumia-flower img')];
  const fallingTear = document.getElementById('falling-tear');
  let timers = [], turnToken = 0;
  const motionOff = () => app.classList.contains('no-motion') || reduced;
  const delay = (ms, fn) => timers.push(setTimeout(fn, ms));
  // load failure: revert to the established default standing image.
  for(const name of Object.keys(primaryImages)){
    primaryImages[name].addEventListener('error', () => {
      if(primaryImages[name].getAttribute('src') !== imagePaths[name].default){
        primaryImages[name].src = imagePaths[name].default;
        app.dataset[`${name}Variant`] = 'default';
      }
    });
  }
  combined.querySelector('img').addEventListener('error', () => {
    app.dataset.combined = 'none';
    combined.style.display = 'none';
    if(page+1===25)releaseAtFarewell(true);
  });
  Object.values(imagePaths).forEach(group => Object.values(group).forEach(src => { const prefetch = new Image(); prefetch.src=src; }));

  function stageForPage(number){
    if(number<6 || number>25)return 0;
    if(number<=10)return 1;
    if(number<=20)return 2;
    return 3;
  }

  function reset(){
    ++turnToken;
    timers.forEach(clearTimeout); timers=[];
    combined.style.removeProperty('display');
    combined.classList.remove('variant-fading');
    combined.querySelector('img').src=imagePaths.combined.hug;
    app.dataset.combined='none';
    app.dataset.endingSolo='no';
    app.dataset.memoryHand='none';
    app.dataset.memoryCut='none';
    app.dataset.lumiaStage='none';
    app.dataset.lumiaSway='off';
    app.dataset.lumiaPetals='none';
    app.dataset.foreground='none';
    app.dataset.foregroundSway='off';
    flowerImages.forEach(img=>{img.src=imagePaths.lumia.sprout;img.style.removeProperty('opacity');});
    // Page-local flower states do not depend on visiting a previous page.
    if(page+1===20){app.dataset.lumiaStage='bud';flowerImages.forEach(img=>img.src=imagePaths.lumia.bud);}
    if([27,28].includes(page+1)){app.dataset.lumiaStage='bloom';flowerImages.forEach(img=>img.src=imagePaths.lumia.bloom);}
    app.dataset.crackGlow='none';
    app.dataset.cheekTear='none';
    app.dataset.tearFall='none';
    app.dataset.tearContact='none';
    fallingTear.style.removeProperty('left');
    fallingTear.style.removeProperty('top');
    fallingTear.style.removeProperty('--tear-dx');
    fallingTear.style.removeProperty('--tear-dy');
    const shiroStage=stageForPage(page+1);
    app.dataset.shiroStage=String(shiroStage);
    for(const name of Object.keys(primaryImages)){
      figures[name].classList.remove('variant-fading');
      const base=name==='shiro'?(page+1===24?'preGlow':shiroStage?`stage${shiroStage}`:'default'):(name==='rio'?(page+1===23?'tears':page+1===28?'finalStep':'default'):'default');
      primaryImages[name].src=imagePaths[name][base];
      app.dataset[`${name}Variant`]=base;
    }
    // P25 is the single farewell: embrace once, then switch this same image
    // element to Rio's empty arms. Never show a separate Shiro on top.
    if(page+1===25){
      app.dataset.combined='hug';
      combined.setAttribute('aria-label','しろつちを抱きしめるリオ');
    }
  }

  function swap(name, variant, duration=680){
    const root=figures[name], img=primaryImages[name];
    const next=imagePaths[name][variant];
    if(!next || img.getAttribute('src')===next)return;
    if(motionOff()){
      img.src=next;app.dataset[`${name}Variant`]=variant;
      if(name==='shiro')positionBlinkLids();
      return;
    }
    const token=turnToken;
    root.classList.add('variant-fading');
    delay(Math.min(260,duration*.36),()=>{
      if(token!==turnToken)return;
      img.src=next;
      app.dataset[`${name}Variant`]=variant;
      if(name==='shiro')positionBlinkLids();
      root.classList.remove('variant-fading');
      // Intentionally no second full-character layer / double face.
    });
  }

  function embrace(){
    app.dataset.combined='hug';
    app.dataset.crackGlow='none';
  }

  function placeTear(startX,startY,endX,endY){
    app.dataset.tearFall='none';
    fallingTear.style.left=`${startX}px`;
    fallingTear.style.top=`${startY}px`;
    fallingTear.style.setProperty('--tear-dx',`${endX-startX}px`);
    fallingTear.style.setProperty('--tear-dy',`${endY-startY}px`);
    // Restart the single droplet animation on each new cue, without accumulating nodes.
    void fallingTear.offsetWidth;
    app.dataset.tearFall='active';
    delay(1700,()=>{app.dataset.tearFall='none';});
  }

  function cheekTear(){app.dataset.cheekTear='visible';}

  function tearDrops(){
    app.dataset.cheekTear='none';
    if(motionOff())return;
    const rect=figures.rio.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const x=rect.left+rect.width*.575;
    const y=rect.top+rect.height*.258;
    placeTear(x,y,x+rect.width*.025,y+Math.min(rect.height*.5,210));
  }

  function tearTouchesShiro(){
    if(motionOff())return;
    const rio=figures.rio.getBoundingClientRect();
    const shiro=figures.shiro.getBoundingClientRect();
    if(!rio.width||!rio.height||!shiro.width||!shiro.height)return;
    // This is Rio's single tear: start at his cheek, end on Shiro's chest crack.
    // Both anchors follow the displayed figures, including responsive positions.
    const hitX=shiro.left+shiro.width*.52;
    const hitY=shiro.top+shiro.height*.46;
    // The drop from P23 continues vertically just above Shiro's crack.
    // A horizontal journey from Rio's cheek would look like a flying tear.
    const startY=Math.min(hitY-120,rio.top+rio.height*.42);
    placeTear(hitX,startY,hitX,hitY);
  }

  function shiroIlluminates(){
    app.dataset.tearFall='none';
    // The painted cracks already glow. No additional mask or competing silhouette.
    swap('shiro','farewellGlow',1200);
    app.dataset.crackGlow='none';
    window.dispatchEvent(new CustomEvent('shirotsuchi:lumia-light'));
  }

  function tearContact(){
    app.dataset.tearFall='none';
    app.dataset.tearContact='active';
    delay(1200,()=>{app.dataset.tearContact='none';});
  }

  function changeStage(stage){
    app.dataset.shiroStage=String(stage);
    swap('shiro',`stage${stage}`,850);
  }

  function showHand(strength){
    if(!memoryHand.querySelector('img').complete)return;
    app.dataset.memoryHand=strength;
    delay(strength==='faint'?2800:4300,()=>{app.dataset.memoryHand='none';});
  }

  function showMemory(strength){
    if(!memoryCut.querySelector('img').complete)return;
    app.dataset.memoryHand='none'; // The illustrated face is a separate memory cut, never laid onto Rio.
    app.dataset.memoryCut=strength;
    if(!motionOff())delay(strength==='faint'?6200:12500,()=>{app.dataset.memoryCut='none';});
  }

  function showSprout(){
    flowerImages[0].src=imagePaths.lumia.sprout;
    app.dataset.lumiaStage='sprout';
  }

  function bloomLumia(){
    if(motionOff()){
      flowerImages.forEach(img=>img.src=imagePaths.lumia.bloom);
      app.dataset.lumiaStage='bloom';return;
    }
    app.dataset.lumiaStage='transition';
    delay(350,()=>{
      flowerImages.forEach(img=>img.src=imagePaths.lumia.bloom);
      app.dataset.lumiaStage='bloom';
      app.dataset.lumiaSway='on';
    });
  }

  function swayLumia(){if(!motionOff())app.dataset.lumiaSway='on';}
  function driftPetals(){if(!motionOff())app.dataset.lumiaPetals='active';}

  function revealForeground(){
    app.dataset.foreground='visible';
    if(!motionOff() && page+1!==19 && page+1!==28)app.dataset.foregroundSway='on';
  }

  function glowCracks(){
    // The supplied mask is aligned with Stage 3. Never project it on another silhouette.
    if(app.dataset.shiroStage!=='3'||app.dataset.combined==='hug')return;
    app.dataset.crackGlow='active';
    delay(2300,()=>{app.dataset.crackGlow='none';});
  }

  function releaseAtFarewell(fallback=false){
    // The original embrace is one flat illustration: exchange it for the empty embrace.
    if(!fallback){
      if(motionOff()){
        combined.querySelector('img').src=imagePaths.combined.empty;
        app.dataset.combined='empty';
        combined.setAttribute('aria-label','しろつちが消えた後の、空の腕のリオ');
        return;
      }
      combined.classList.add('variant-fading');
      delay(240,()=>{
        combined.querySelector('img').src=imagePaths.combined.empty;
        app.dataset.combined='empty';
        combined.setAttribute('aria-label','しろつちが消えた後の、空の腕のリオ');
        combined.classList.remove('variant-fading');
      });
      return;
    }
    // Failed image load: retain a comprehensible Rio-only ending.
    app.dataset.endingSolo='yes';
    app.dataset.combined='none';
    primaryImages.rio.src=imagePaths.rio.tears;
    app.dataset.rioVariant='tears';
  }

  const sceneVariants={
    2:[['rio','down',1050],['memory','faint',2000]],
    6:[['shiro','lean',1750]],
    8:[['shiro','lean',1900]],
    10:[['stage','2',2800],['lumia','sprout',3150]],
    11:[['rio','down',950],['combined','hug',3500]],
    13:[['rio','down',1250]],
    16:[['combined','hug',1350]],
    19:[['mora','sad',3100],['shiro','lean',4500]],
    20:[['foreground','reveal',900],['lumia','bloom',2600],['petals','drift',4800]],
    22:[['rio','down',700],['memory','clear',950]],
    23:[['cheek','appear',1250],['tear','fallFromRio',3400]],
    24:[['tear','touchShiro',1550],['tearContact','glint',3270],['shiro','farewellGlow',3820]],
    25:[['farewell','empty',4600]],
    27:[['mora','sad',150],['lumia','sway',2750]],
    28:[['petals','drift',1250]]
  };

  // Note: sceneVariants keys above are displayed page numbers (one-based).
  const originalRender=render;
  let lastVariantPage=-1;
  render=function(){
    const pageChanged=page!==lastVariantPage;
    if(pageChanged)reset();
    originalRender();
    // A mode/motion/paragraph refresh is not a new scene. Preserve its cues.
    if(!pageChanged)return;
    lastVariantPage=page;
    window.dispatchEvent(new CustomEvent('shirotsuchi:page-ready',{detail:{page:page+1}}));
    // Match the actual painted backdrop, not just a page number.
    const scene=app.dataset.sceneArt;
    const n=page+1;
    const foreground=(scene==='forest'&&[12,13,14].includes(n))?'forest':
      (scene==='village-quiet'&&n===20)?'village':
      (scene==='flower-lake'&&[27,28].includes(n))?'waterside':'none';
    app.dataset.foregroundType=foreground;
    if(foreground==='forest'||foreground==='waterside')revealForeground();
    const cues=sceneVariants[page+1]||[];
    const token=turnToken;
    cues.forEach(([name,variant,when])=>{
      const act=()=>{
        if(token!==turnToken)return;
        if(name==='combined')embrace();
        else if(name==='farewell')releaseAtFarewell();
        else if(name==='cheek')cheekTear();
        else if(name==='tear')variant==='touchShiro'?tearTouchesShiro():tearDrops();
        else if(name==='tearContact')tearContact();
        else if(name==='stage')changeStage(Number(variant));
        else if(name==='memory')showHand(variant);
        else if(name==='memoryCut')showMemory(variant);
        else if(name==='lumia'){
          if(variant==='sprout')showSprout();
          else if(variant==='bloom')bloomLumia();
          else swayLumia();
        }
        else if(name==='petals')driftPetals();
        else if(name==='foreground')revealForeground();
        else if(name==='crack')glowCracks();
        else if(name==='shiro'&&variant==='farewellGlow')shiroIlluminates();
        else swap(name,variant,name==='mora'?1200:650);
      };
      if(motionOff()){
        // Keep a meaningful still state for reduced motion without delayed effects.
        if(name==='tear'||name==='tearContact'||name==='cheek'||name==='crack'||name==='petals')return;
        // Static images still tell the climax in order; no travel or flashing.
        if(n===25&&name==='farewell')delay(4600,act);
        else if(n===24&&name==='shiro'&&variant==='farewellGlow')delay(2300,act);
        else act();
      }else delay(when,act);
    });
  };
  // Recompute the current page so direct entry and page rewind share the same state.
  render();
})();
