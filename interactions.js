/* 『しろつち』追加演出。すべて既存画像とブラウザ標準APIで実行する。 */
(() => {
  const modeSelect=document.getElementById('reading-mode');
  const hotspotLayer=document.getElementById('hotspot-layer');
  const particles=document.getElementById('scene-particles');
  const speechSupported='speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const narrationAlert=document.getElementById('narration-alert');
  const narrationAlertText=document.getElementById('narration-alert-text');
  const narrationState=document.createElement('span');
  narrationState.className='sr-only';narrationState.setAttribute('role','status');
  hotspotLayer.appendChild(narrationState);
  let mode='manual',speechToken=0,gestureTimers=[],ambient=null,ambientPulse=null;
  let touchTimers=[],lastHeartAt=0,flowerBusy=false;
  let dragStart=null,dragMoved=false,suppressShiroClick=false;
  const shiroFigure=document.getElementById('shiro');
  shiroFigure.querySelector('img').draggable=false;
  const heartLight=document.createElement('span');
  heartLight.className='shiro-touch-light';heartLight.setAttribute('aria-hidden','true');
  shiroFigure.appendChild(heartLight);
  let renderedPage=-1,renderedMode='manual',speechWatchdog=null,speechStartWatchdog=null;
  // P番号ではなくゼロ始まり。本文で「抱く・守る・寄り添う」場面だけ距離を縮める。
  const proximityCues={7:2300,10:3600,14:2800,15:0,16:0,17:0,18:0,20:4300,21:0,22:0,23:0,24:2800};

  // 触る意味が画面上で明確な場面だけに置く。通常のページには表示しない。
  const hotspots={
    2:{x:54,y:54,kind:'water',label:'湖の水に触れる',response:'水面に波紋が広がった'},
    23:{target:'shiro',kind:'light',label:'しろつちの光に触れる',response:'涙に応えて、光があふれた'}
  };
  function heartbeatProfile(n){
    if(n===7||n===8)return {count:2,delay:0,strength:.32,spacing:480,duration:1250,volume:.035};
    if(n===11)return {count:2,delay:0,strength:.20,spacing:600,duration:1070,volume:.025};
    if(n>=15&&n<=19)return {count:1,delay:260,strength:.12,spacing:0,duration:840,volume:.014};
    if(n>=21&&n<=23)return {count:1,delay:420,strength:.07,spacing:0,duration:650,volume:.008};
    return null;
  }
  const delayedGestures={
    5:[[2900,'shiro','rise'],[6300,'rio','lean']],
    6:[[2500,'shiro','startle'],[6000,'rio','lean']],
    7:[[3200,'rio','lean'],[6500,'shiro','jump']],
    9:[[3100,'shiro','rise']],
    11:[[4000,'mora','approach'],[7100,'rio','recoil']],
    12:[[2600,'mora','approach'],[6100,'rio','recoil']],
    13:[[2600,'mora','speak'],[6800,'rio','answer']],
    16:[[3000,'mora','speak']],17:[[3200,'mora','speak'],[6900,'rio','look-up']],
    18:[[3700,'mora','bow']],
    22:[[3200,'rio','weep']],23:[[2900,'shiro','rise']],
    24:[[3100,'shiro','farewell'],[6500,'rio','protect']],
    26:[[3200,'mora','bow'],[6500,'rio','approach']]
  };

  const oldRender=render;
  render=function(){
    const changedPage=renderedPage!==page;
    const changedMode=renderedMode!==mode;
    if(changedPage||changedMode){
      speechToken++;
      clearTimeout(speechWatchdog);clearTimeout(speechStartWatchdog);
      if(speechSupported)window.speechSynthesis.cancel();
    }
    if(changedPage){
      gestureTimers.forEach(clearTimeout);gestureTimers=[];
      touchTimers.forEach(clearTimeout);touchTimers=[];
      shiroFigure.getAnimations().filter(a=>a.id==='story-reaction').forEach(a=>a.cancel());
      shiroFigure.querySelector('img')?.getAnimations().filter(a=>a.id==='story-heartbeat').forEach(a=>a.cancel());
      heartLight.classList.remove('active');flowerBusy=false;lastHeartAt=0;
      particles.replaceChildren();
      if(dragStart&&shiroFigure.hasPointerCapture(dragStart.pointerId))shiroFigure.releasePointerCapture(dragStart.pointerId);
      dragStart=null;dragMoved=false;suppressShiroClick=false;
      shiroFigure.style.removeProperty('margin-left');
      shiroFigure.style.removeProperty('margin-top');
      shiroFigure.classList.remove('is-dragging','is-holding');
      shiroFigure.classList.remove('drag-discovered');
    }
    oldRender();
    app.dataset.readingMode=mode;
    app.dataset.worldAwake=page>=23?'true':'false';
    if(changedPage){
      arrangeProximity();mountHotspot();arrangeGestures();setAmbientScene();
    }
    renderedPage=page;renderedMode=mode;
    if(changedPage||changedMode){
      hideNarrationAlert();
      if(mode==='listen')startNarration(speechToken);
      else if(mode==='movie')startTextFocus();
    }
  };

  function arrangeProximity(){
    app.dataset.proximity='apart';
    const delay=proximityCues[page];
    if(delay===undefined)return;
    if(delay===0||reduced||app.classList.contains('no-motion')){app.dataset.proximity='embrace';return}
    gestureTimers.push(setTimeout(()=>{app.dataset.proximity='embrace'},delay));
  }

  // 既存の自動送りに、読書モード別の待機時間と朗読終了時の進行を追加。
  scheduleAutoAdvance=function(){
    clearTimeout(autoTimer);autoTimer=null;
    if(!autoAdvance||document.hidden)return;
    // A narrator may advance only from utterance.onend, not a silent timer.
    if(mode==='listen')return;
    if(page===pages.length-1){autoAdvance=false;updateAutoButton();return}
    const len=pages[page].text.length;
    const baseMs=Math.max(11000,Math.min(32000,len*190+4400));
    // P25 leaves a quiet pause after the embrace becomes empty in movie mode.
    const ms=baseMs+(mode==='movie'&&page===24?7500:0);
    autoTimer=setTimeout(()=>{if(autoAdvance&&!turning)go(page+1);else scheduleAutoAdvance()},ms);
  };

  function changeMode(value){
    mode=value;
    window.dispatchEvent(new CustomEvent('shirotsuchi:narration',{detail:{active:false}}));
    modeSelect.value=value;
    autoAdvance=value==='movie'; // Narration enables auto only after onstart.
    updateAutoButton();
    narrationState.textContent='';
    render();
  }
  modeSelect.addEventListener('change',e=>changeMode(e.target.value));
  document.getElementById('auto').onclick=()=>changeMode(mode==='manual'?'movie':'manual');
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&mode==='listen'){
      speechToken++;clearTimeout(speechWatchdog);clearTimeout(speechStartWatchdog);
      if(speechSupported)window.speechSynthesis.cancel();
      autoAdvance=false;updateAutoButton();
    }else if(mode==='listen'){
      showNarrationAlert('画面に戻りました。読み上げを再開するには「再試行」を押してください。');
    }
  });

  function hideNarrationAlert(){narrationAlert.hidden=true;narrationAlertText.textContent=''}
  function showNarrationAlert(message){
    narrationAlertText.textContent=message;
    narrationAlert.hidden=false;
  }
  function narrationFailed(message){
    window.dispatchEvent(new CustomEvent('shirotsuchi:narration',{detail:{active:false}}));
    clearTimeout(speechWatchdog);clearTimeout(speechStartWatchdog);
    autoAdvance=false;clearTimeout(autoTimer);autoTimer=null;updateAutoButton();
    narrationState.textContent=message;
    showNarrationAlert(message+' ページ送りは停止しています。');
  }
  document.getElementById('narration-retry').onclick=()=>{
    if(mode!=='listen')changeMode('listen');
    if(speechSupported)window.speechSynthesis.cancel();
    startNarration(++speechToken);
  };
  document.getElementById('narration-manual').onclick=()=>changeMode('manual');

  function startNarration(token){
    if(!speechSupported){narrationFailed('このブラウザでは音声読み上げを利用できません。');return}
    if(document.hidden)return;
    hideNarrationAlert();
    const utterance=new SpeechSynthesisUtterance(pages[page].text);
    utterance.lang='ja-JP';utterance.rate=.88;utterance.pitch=1;utterance.volume=1;
    const voices=window.speechSynthesis.getVoices();
    utterance.voice=voices.find(v=>v.lang==='ja-JP')||voices.find(v=>v.lang.startsWith('ja'))||null;
    if(voices.length>0&&!utterance.voice){
      narrationFailed('日本語の読み上げ音声が見つかりません。ブラウザの音声設定をご確認ください。');return;
    }
    const spans=[...copy.querySelectorAll('.story-text > span')];
    const text=pages[page].text;
    utterance.onboundary=e=>{
      if(token!==speechToken)return;
      let count=0;
      for(const item of spans){count+=item.textContent.length;item.classList.toggle('reading-active',e.charIndex<count&&e.charIndex>=count-item.textContent.length)}
    };
    utterance.onstart=()=>{
      if(token!==speechToken||mode!=='listen')return;
      window.dispatchEvent(new CustomEvent('shirotsuchi:narration',{detail:{active:true}}));
      clearTimeout(speechStartWatchdog);
      autoAdvance=true;updateAutoButton();hideNarrationAlert();
      // If a browser never reports onend, pause safely instead of page-skipping.
      const safetyMs=Math.max(45000,Math.min(180000,text.length*550+15000));
      speechWatchdog=setTimeout(()=>{
        if(token!==speechToken||mode!=='listen')return;
        window.speechSynthesis.cancel();
        narrationFailed('音声の終了を確認できませんでした。');
      },safetyMs);
    };
    utterance.onend=()=>{
      if(token!==speechToken||mode!=='listen')return;
      window.dispatchEvent(new CustomEvent('shirotsuchi:narration',{detail:{active:false}}));
      clearTimeout(speechWatchdog);clearTimeout(speechStartWatchdog);
      spans.forEach(el=>el.classList.remove('reading-active'));
      if(autoAdvance&&page<pages.length-1){clearTimeout(autoTimer);autoTimer=setTimeout(()=>{if(mode==='listen')go(page+1)},2000)}
    };
    utterance.onerror=e=>{
      if(token===speechToken&&mode==='listen')narrationFailed(`読み上げに失敗しました（${e.error||'原因不明'}）。`);
    };
    speechStartWatchdog=setTimeout(()=>{
      if(token!==speechToken||mode!=='listen')return;
      window.speechSynthesis.cancel();
      narrationFailed('読み上げの開始を確認できませんでした。');
    },6500);
    try{window.speechSynthesis.speak(utterance)}
    catch(e){narrationFailed('読み上げを開始できませんでした。')}
  }

  function startTextFocus(){
    const spans=[...copy.querySelectorAll('.story-text > span')];
    const timing=Math.max(11000,Math.min(32000,pages[page].text.length*190+4400))+(page===24?7500:0);
    spans.forEach((span,i)=>{
      const timer=setTimeout(()=>{
        if(mode!=='movie')return;
        spans.forEach(node=>node.classList.remove('reading-active'));
        span.classList.add('reading-active');
      },Math.round((i/spans.length)*timing));
      gestureTimers.push(timer);
    });
  }

  function mountHotspot(){
    hotspotLayer.querySelectorAll('.story-hotspot').forEach(el=>el.remove());
    hotspotLayer.querySelectorAll('.story-touch-response').forEach(el=>el.remove());
    document.querySelectorAll('.story-figure-hint').forEach(el=>el.remove());
    const shiro=document.getElementById('shiro');
    shiro.classList.remove('is-touchable');shiro.setAttribute('role','img');shiro.setAttribute('tabindex','-1');
    shiro.setAttribute('aria-label','しろつちの立ち絵');
    const draggable=page>=5&&page<=23&&pages[page].cast.includes('shiro');
    shiro.classList.toggle('is-draggable',draggable);
    shiro.classList.toggle('drag-invitation',page===6||page===7);
    if(draggable){shiro.setAttribute('role','button');shiro.setAttribute('tabindex','0');shiro.setAttribute('aria-label','しろつちを持ち上げたり動かす');}
    const flower=document.querySelector('.lumia-flower.flower-a');
    flower.removeAttribute('role');flower.removeAttribute('tabindex');flower.removeAttribute('aria-label');
    if(page===27){flower.setAttribute('role','button');flower.setAttribute('tabindex','0');flower.setAttribute('aria-label','ルミアの花に触れる');}
    const heart=heartbeatProfile(page+1);
    const event=heart&&pages[page].cast.includes('shiro')
      ?{target:'shiro',kind:'heartbeat',label:'しろつちの鼓動に触れる',response:'小さな鼓動が指先に伝わる'}
      :hotspots[page];
    if(!event)return;
    if(event.target){
      const figure=document.getElementById(event.target);
      if(!figure?.classList.contains('is-visible'))return;
      figure.classList.add('is-touchable');figure.setAttribute('role','button');figure.setAttribute('tabindex','0');figure.setAttribute('aria-label',event.label);
      return;
    }
    const button=document.createElement('button');
    button.className='story-hotspot';button.type='button';button.title=event.label;
    button.setAttribute('aria-label',event.label);
    button.style.setProperty('--spot-x',event.x+'%');button.style.setProperty('--spot-y',event.y+'%');
    button.onclick=()=>touchStory(event);
    hotspotLayer.appendChild(button);
  }

  // The painted figure is moved by margins, leaving its transform, mirror,
  // breathing and image swaps untouched. Motion is bounded to the nearby
  // space, so it cannot be dragged over the prose or navigation controls.
  function setShiroOffset(dx,dy){
    const compact=innerWidth<=760;
    const wide=(page===6||page===7);
    const maxX=wide?(compact?125:255):(compact?60:125);
    const maxUp=wide?(compact?155:235):(compact?85:150);
    const maxDown=wide?(compact?85:140):(compact?35:65);
    const x=Math.max(-maxX,Math.min(maxX,dx));
    const y=Math.max(-maxUp,Math.min(maxDown,dy));
    shiroFigure.style.marginLeft=`${x}px`;
    shiroFigure.style.marginTop=`${y}px`;
  }
  shiroFigure.addEventListener('pointerdown',e=>{
    if(!shiroFigure.classList.contains('is-draggable')||app.dataset.combined!=='none'||turning||e.button!==0)return;
    const startX=parseFloat(shiroFigure.style.marginLeft)||0;
    const startY=parseFloat(shiroFigure.style.marginTop)||0;
    dragStart={pointerId:e.pointerId,x:e.clientX,y:e.clientY,startX,startY};
    dragMoved=false;
    if(page===6||page===7)shiroFigure.classList.add('is-holding','drag-discovered');
    shiroFigure.setPointerCapture(e.pointerId);
  });
  shiroFigure.addEventListener('pointermove',e=>{
    if(!dragStart||e.pointerId!==dragStart.pointerId)return;
    const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;
    if(Math.hypot(dx,dy)>6){dragMoved=true;shiroFigure.classList.add('is-dragging','drag-discovered');}
    if(dragMoved)setShiroOffset(dragStart.startX+dx,dragStart.startY+dy);
  });
  function endShiroDrag(e){
    if(!dragStart||e.pointerId!==dragStart.pointerId)return;
    if(shiroFigure.hasPointerCapture(e.pointerId))shiroFigure.releasePointerCapture(e.pointerId);
    if(dragMoved){
      suppressShiroClick=true;
      setTimeout(()=>{suppressShiroClick=false},0);
    }
    dragStart=null;dragMoved=false;shiroFigure.classList.remove('is-dragging','is-holding');
  }
  shiroFigure.addEventListener('pointerup',endShiroDrag);
  shiroFigure.addEventListener('pointercancel',endShiroDrag);
  shiroFigure.addEventListener('click',e=>{
    if(suppressShiroClick){e.preventDefault();e.stopImmediatePropagation();suppressShiroClick=false;}
  },true);
  shiroFigure.addEventListener('keydown',e=>{
    if(!shiroFigure.classList.contains('is-draggable')||turning)return;
    const moves={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};
    if(e.key==='Home'){
      e.preventDefault();setShiroOffset(0,0);return;
    }
    if(!moves[e.key])return;
    e.preventDefault();
    setShiroOffset((parseFloat(shiroFigure.style.marginLeft)||0)+moves[e.key][0],(parseFloat(shiroFigure.style.marginTop)||0)+moves[e.key][1]);
  });

  // 立ち絵を直接押した時の座標を使う。反転・移動・画面幅の違いにも追従する。
  document.getElementById('shiro').addEventListener('click',e=>{
    const event=heartbeatProfile(page+1)&&pages[page].cast.includes('shiro')
      ?{target:'shiro',kind:'heartbeat',response:'小さな鼓動が指先に伝わる'}:hotspots[page];
    if(event?.target!=='shiro')return;
    const rect=e.currentTarget.getBoundingClientRect(),stage=app.getBoundingClientRect();
    const clickX=typeof e.clientX==='number'&&e.clientX>0?e.clientX:rect.left+rect.width*.5;
    const clickY=typeof e.clientY==='number'&&e.clientY>0?e.clientY:rect.top+rect.height*.5;
    touchStory({...event,x:Math.max(1,Math.min(99,((clickX-stage.left)/stage.width)*100)),y:Math.max(1,Math.min(99,((clickY-stage.top)/stage.height)*100))});
  });
  const lastFlower=document.querySelector('.lumia-flower.flower-a');
  function touchLumia(){
    if(page!==27||flowerBusy)return;
    flowerBusy=true;
    const still=reduced||app.classList.contains('no-motion');
    if(!still){
      lastFlower.querySelector('img').animate([
        {rotate:'0deg'},{rotate:'-2deg',offset:.28},{rotate:'1deg',offset:.65},{rotate:'0deg'}
      ],{duration:1700,easing:'ease-in-out'});
      const neighbor=document.querySelector('.foreground-waterside');
      neighbor.animate([{rotate:'0deg'},{rotate:'.55deg'},{rotate:'0deg'}],{duration:2100,easing:'ease-in-out'});
    }else{
      lastFlower.style.opacity='.78';
      touchTimers.push(setTimeout(()=>lastFlower.style.removeProperty('opacity'),650));
    }
    touchTimers.push(setTimeout(()=>{flowerBusy=false},2200));
  }
  lastFlower.addEventListener('click',touchLumia);
  lastFlower.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();touchLumia()}});

  function arrangeGestures(){
    if(reduced||app.classList.contains('no-motion'))return;
    for(const [delay,who,motion] of delayedGestures[page]||[]){
      gestureTimers.push(setTimeout(()=>{
        const figure=who==='rio'?document.querySelector('.rio-figure'):document.getElementById(who);
        if(!figure?.classList.contains('is-visible'))return;
        const poses=puppetMoves[motion];if(!poses)return;
        const frames=poses.map(([position,angle])=>({translate:position.includes(' ')?position:`${position} 0`,rotate:angle}));
        const animation=figure.animate(frames,{duration:puppetTiming[motion]||1900,easing:'ease-in-out'});
        activePuppetAnimations.push(animation);
      },delay));
    }
  }

  function pointEffect(type,x,y){
    if(reduced||app.classList.contains('no-motion'))return;
    if(type==='ring'){
      const ring=document.createElement('span');ring.className='story-ring';ring.style.setProperty('--x',x+'%');ring.style.setProperty('--y',y+'%');particles.appendChild(ring);setTimeout(()=>ring.remove(),2100);
      return;
    }
    const amount=type==='grand'?26:12;
    for(let i=0;i<amount;i++){
      const el=document.createElement('span');el.className='story-spark';
      el.style.setProperty('--x',(x+(Math.random()-.5)*9)+'%');
      el.style.setProperty('--y',(y+(Math.random()-.5)*8)+'%');
      el.style.setProperty('--dx',(Math.random()-.5)*190+'px');
      el.style.setProperty('--dy',(-35-Math.random()*175)+'px');
      el.style.setProperty('--particle-size',(5+Math.random()*11)+'px');
      el.style.setProperty('--particle-duration',(1.5+Math.random()*1.7)+'s');
      particles.appendChild(el);setTimeout(()=>el.remove(),3400);
    }
  }

  function flashScene(x,y){
    if(reduced||app.classList.contains('no-motion'))return;
    const flash=document.createElement('span');flash.className='scene-veil';
    flash.style.setProperty('--light-x',x+'%');flash.style.setProperty('--light-y',y+'%');
    particles.appendChild(flash);setTimeout(()=>flash.remove(),2300);
  }

  function touchStory(event){
    const {kind,x,y}=event;
    if(kind==='water'){pointEffect('ring',x,y);playWater()}
    else if(kind==='heartbeat'){reactHeartbeat()}
    else if(kind==='shiro'){reactShiro('nestle');chirp(570,.38,'sine',.025)}
    else if(kind==='sprout'||kind==='flowers'){pointEffect('grand',x,y);chirp(590,.42,'sine',.022);chirp(860,.5,'sine',.012,.14)}
    else if(kind==='mora'){pointEffect('small',x,y);chirp(95,.9,'sine',.022)}
    else if(kind==='memory'||kind==='tear'){pointEffect('ring',x,y);chirp(380,.55,'sine',.025);flashScene(x,y)}
    else if(kind==='light'||kind==='farewell'){
      // Touch never starts the plot's light before Rio's tear has landed.
      if(app.dataset.shiroVariant==='farewellGlow'){
        reactShiro('light');chirp(450,.4,'sine',.016);
      }
    }
    narrationState.textContent=event.response;
  }

  function reactShiro(kind){
    if(reduced||app.classList.contains('no-motion'))return;
    const figure=document.getElementById('shiro');
    figure.getAnimations().filter(a=>a.id==='story-reaction').forEach(a=>a.cancel());
    let frames,duration;
    if(kind==='heartbeat'){
      // 心臓のように二度脈打つ。揺れずに、体の内側が応答する。
      frames=[{scale:'1',offset:0},{scale:'1.08',offset:.2},{scale:'1',offset:.36},{scale:'1.07',offset:.56},{scale:'1',offset:1}];duration=1500;
    }else if(kind==='nestle'){
      // リオがいる左側へ、ほんの少し近づいて安心する。
      frames=[{translate:'0 0',rotate:'0deg',offset:0},{translate:'-38px 0',rotate:'-9deg',offset:.4},{translate:'-38px 0',rotate:'-9deg',offset:.68},{translate:'0 0',rotate:'0deg',offset:1}];duration=2200;
    }else{
      // 涙に反応して光が大きくなり、静かに元の姿へ戻る。
      frames=[{scale:'1',offset:0},{scale:'1.025',offset:.38},{scale:'1.01',offset:.7},{scale:'1',offset:1}];duration=1500;
    }
    figure.classList.add('is-reacting');
    const a=figure.animate(frames,{duration,easing:'ease-in-out'});a.id='story-reaction';
    a.onfinish=()=>figure.classList.remove('is-reacting');
    a.oncancel=()=>figure.classList.remove('is-reacting');
  }

  function reactHeartbeat(){
    const profile=heartbeatProfile(page+1);
    if(!profile||app.dataset.combined==='empty')return;
    if(performance.now()-lastHeartAt<1900)return;
    lastHeartAt=performance.now();
    const tokenPage=page;
    const still=reduced||app.classList.contains('no-motion');
    const beat=()=>{
      if(page!==tokenPage)return;
      heartLight.style.setProperty('--heart-strength',profile.strength);
      heartLight.classList.add('active');
      if(!still){
        const img=shiroFigure.querySelector('img');
        img.getAnimations().filter(a=>a.id==='story-heartbeat').forEach(a=>a.cancel());
        const animation=img.animate([{scale:'1'},{scale:'1.018',offset:.42},{scale:'1'}],{duration:420,easing:'ease-in-out'});
        animation.id='story-heartbeat';
      }
      chirp(155,.18,'sine',profile.volume);
      touchTimers.push(setTimeout(()=>heartLight.classList.remove('active'),profile.count===2?310:profile.duration*.62));
    };
    touchTimers.push(setTimeout(beat,profile.delay));
    if(profile.count===2){
      touchTimers.push(setTimeout(()=>{
        if(page!==tokenPage)return;
        beat();
        // Later in the story the second pulse has less warmth.
        if(page+1===11)heartLight.style.setProperty('--heart-strength',profile.strength*.54);
      },profile.delay+profile.spacing));
    }
  }

  // 水音・風の気配を、録音素材なしで小さな帯域制限ノイズとして生成。
  function startAmbience(){
    try{
      audioCtx??=new (window.AudioContext||window.webkitAudioContext)();
      audioCtx.resume();
      if(ambient)return;
      const len=Math.floor(audioCtx.sampleRate*3);
      const buffer=audioCtx.createBuffer(1,len,audioCtx.sampleRate),data=buffer.getChannelData(0);
      let last=0;for(let i=0;i<len;i++){last=(last*.96)+((Math.random()*2-1)*.04);data[i]=last}
      const source=audioCtx.createBufferSource();source.buffer=buffer;source.loop=true;
      const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=500;
      const gain=audioCtx.createGain();gain.gain.value=0;
      source.connect(filter).connect(gain).connect(audioCtx.destination);source.start();
      ambient={source,filter,gain};
      setAmbientScene();
    }catch(e){ambient=null}
  }
  function setAmbientScene(){
    if(!ambient||!audioCtx)return;
    const forest=[11,12,13].includes(page),room=[1,4,8,9,10].includes(page),night=[4,5,6,7,15,16,17,18].includes(page);
    const freq=forest?230:room?140:night?300:650;
    const volume=!sound||document.hidden?0:forest?.014:room?.004:page>=23?.016:.011;
    const now=audioCtx.currentTime;
    ambient.filter.frequency.setTargetAtTime(freq,now,.65);
    ambient.gain.gain.setTargetAtTime(volume,now,.85);
    clearInterval(ambientPulse);ambientPulse=null;
    if(sound&&page>=19&&page!==22){
      ambientPulse=setInterval(()=>{
        if(!document.hidden&&sound){chirp(750,.46,'sine',.007);chirp(1050,.38,'sine',.006,.14)}
      },11000);
    }
  }
  document.getElementById('sound').addEventListener('click',()=>{
    if(sound)startAmbience();else setAmbientScene();
  });
  document.addEventListener('visibilitychange',setAmbientScene);
  document.getElementById('motion').addEventListener('click',()=>{
    if(app.classList.contains('no-motion'))gestureTimers.forEach(clearTimeout);
  });

  // 初期状態は落ち着いた自分で読むモード。
  app.dataset.readingMode='manual';
  app.dataset.worldAwake='false';
  mountHotspot();
})();
