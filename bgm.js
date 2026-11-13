/* Original five-track score. Two reusable audio decks: no per-page Audio nodes. */
(() => {
  const app=document.getElementById('app');
  const button=document.getElementById('bgm');
  if(!button)return;
  const names=[
    'shirotsuchi_01_mizuumino_mura',
    'shirotsuchi_02_chiisanalinochi_acoustic_piano',
    'shirotsuchi_03_morano_mori',
    'shirotsuchi_04_lumiano_hana',
    'shirotsuchi_05_atarashii_asa'
  ];
  const probe=document.createElement('audio');
  const ext=probe.canPlayType('audio/ogg; codecs="vorbis"')?'.ogg':'.m4a';
  const decks=Array.from({length:2},()=>{
    const audio=new Audio();audio.preload='auto';audio.volume=0;audio.loop=false;
    audio.hidden=true;audio.dataset.bgmDeck='true';document.body.append(audio);
    return {audio,track:null,level:0,from:0,to:0,start:0,end:0};
  });
  let enabled=true;
  try{enabled=localStorage.getItem('shirotsuchi-bgm')!=='off'}catch(_){}
  let unlocked=false,playbackBlocked=false,pendingStartClick=false,firstPlayback=true,desired=null,currentPage=1,duck=1,sceneGain=1,narrating=false,sfxUntil=0,frame=0,lastTick=0;
  const now=()=>performance.now();
  const trackFor=n=>n<=5?0:n<=11?1:n<=19?2:n<=24?3:n===25?null:n<=27?3:4;
  const pageGain=n=>n===11||(n>=17&&n<=19)?.8:n===22||n===23?.65:n===27?.85:1;
  const setButton=()=>{
    const needsStart=enabled&&(!unlocked||playbackBlocked);
    button.textContent=!enabled?'♫ BGM OFF':needsStart?'♫ BGM 再生':'♫ BGM ON';
    button.setAttribute('aria-pressed',String(enabled&&!needsStart));
    button.setAttribute('aria-label',!enabled?'BGMを再生':needsStart?'BGMを開始':'BGMを停止');
  };
  const fade=(deck,to,ms)=>{
    deck.from=deck.level;deck.to=to;deck.start=now();deck.end=deck.start+Math.max(ms,1);
  };
  const play=deck=>{
    if(!unlocked||document.hidden||!enabled)return;
    if(!deck.audio.paused)return;
    deck.audio.play().then(()=>{playbackBlocked=false;setButton()}).catch(()=>{
      playbackBlocked=true;setButton(); // Keep a usable start button if autoplay is blocked.
    });
  };
  function chooseDeck(track){
    let matching=decks.filter(d=>d.track===track).sort((a,b)=>
      Number(!b.audio.paused)-Number(!a.audio.paused)||b.level-a.level)[0];
    if(matching)return matching;
    const free=decks.find(d=>d.track===null||d.level<.001)||decks.reduce((a,b)=>a.level<=b.level?a:b);
    free.audio.pause();free.audio.src=`assets/${names[track]}${ext}`;
    free.audio.load();free.track=track;free.level=0;free.audio.volume=0;
    return free;
  }
  function transition(page){
    const previousPage=currentPage;
    currentPage=page;desired=trackFor(page);
    if(!enabled||document.hidden||!unlocked){
      if(!enabled||document.hidden)decks.forEach(d=>{d.audio.pause();d.level=0;d.audio.volume=0});
      return;
    }
    // Start the opening music promptly; long fades are reserved for chapter changes.
    const ms=firstPlayback?650:page===25?3000:page===20||page===28?4000:3000;
    if(desired===null){decks.forEach(d=>fade(d,0,3000));startTick();return}
    // Same chapter continues at its current playhead, even across repeated renders.
    const selected=chooseDeck(desired);
    firstPlayback=false;
    if(page===26&&previousPage===25){try{selected.audio.currentTime=0}catch(_){}}
    decks.forEach(d=>fade(d,d===selected?1:0,ms));
    play(selected);startTick();
  }
  function startTick(){if(!frame){lastTick=now();frame=requestAnimationFrame(tick)}}
  function tick(time){
    frame=0;
    const dt=Math.min(.1,Math.max(0,(time-lastTick)/1000));lastTick=time;
    const targetDuck=narrating?.32:time<sfxUntil?.7:1;
    duck+=Math.min(1,dt*2)*(targetDuck-duck);
    sceneGain+=Math.min(1,dt*1.25)*(pageGain(currentPage)-sceneGain);
    const sceneVolume=.25*sceneGain*duck;
    for(const d of decks){
      if(d.start&&time<d.end){
        const t=Math.max(0,Math.min(1,(time-d.start)/(d.end-d.start)));
        d.level=d.from+(d.to-d.from)*(t*t*(3-2*t));
      }else if(d.start){d.level=d.to;d.start=0}
      d.audio.volume=Math.min(1,Math.max(0,d.level*sceneVolume));
      if(d.level<.001&&d.to===0&&d.audio.paused===false)d.audio.pause();
    }
    // Crossfade the last second into the start of the same recording.
    if(enabled&&unlocked&&!document.hidden&&desired!==null){
      const active=decks.find(d=>d.track===desired&&d.level>.65&&!d.audio.paused);
      if(active&&Number.isFinite(active.audio.duration)&&active.audio.duration>2&&
          active.audio.duration-active.audio.currentTime<1.05){
        const other=decks.find(d=>d!==active);
        if(other&&other.level<.005){
          other.audio.pause();other.audio.src=active.audio.currentSrc||active.audio.src;
          other.audio.load();other.track=desired;other.level=0;other.audio.volume=0;
          fade(active,0,950);fade(other,1,950);play(other);
        }
      }
    }
    if(decks.some(d=>d.level>.001||d.start)||Math.abs(duck-targetDuck)>.005||Math.abs(sceneGain-pageGain(currentPage))>.005)frame=requestAnimationFrame(tick);
  }
  // Use low-rate checks at the end of long tracks; no busy rendering while paused.
  const loopWatch=setInterval(()=>{
    if(enabled&&unlocked&&!document.hidden&&desired!==null){
      decks.filter(d=>d.track===desired&&!d.audio.paused).forEach(d=>{
        if(Number.isFinite(d.audio.duration)&&d.audio.duration-d.audio.currentTime<1.4)startTick();
      });
    }
  },250);
  decks.forEach(d=>d.audio.addEventListener('ended',()=>{
    if(!enabled||document.hidden||d.track!==desired)return;
    // Fallback when the browser did not expose a usable duration near the end.
    d.audio.currentTime=0;play(d);
  }));
  button.addEventListener('click',()=>{
    if(pendingStartClick||(enabled&&(!unlocked||playbackBlocked))){
      pendingStartClick=false;unlocked=true;playbackBlocked=false;
      transition(currentPage);setButton();return;
    }
    enabled=!enabled;
    try{localStorage.setItem('shirotsuchi-bgm',enabled?'on':'off')}catch(_){}
    setButton();
    if(enabled)transition(currentPage);
    else{decks.forEach(d=>fade(d,0,450));startTick()}
  });
  document.addEventListener('pointerdown',e=>{
    if(!unlocked){
      pendingStartClick=!!e.target.closest?.('#bgm');
      unlocked=true;transition(currentPage);setButton();
    }
    else if(enabled&&desired!==null)decks.filter(d=>d.track===desired).forEach(play);
  },{capture:true});
  document.addEventListener('keydown',e=>{
    if(!unlocked&&(e.key==='Enter'||e.key===' '||e.key==='ArrowRight'||e.key==='ArrowLeft')){
      pendingStartClick=document.activeElement===button;
      unlocked=true;transition(currentPage);setButton();
    }
  },{capture:true});
  window.addEventListener('shirotsuchi:page-ready',e=>transition(e.detail.page));
  window.addEventListener('shirotsuchi:narration',e=>{narrating=!!e.detail.active;startTick()});
  window.addEventListener('shirotsuchi:sfx',()=>{sfxUntil=now()+700;startTick()});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){decks.forEach(d=>d.audio.pause());cancelAnimationFrame(frame);frame=0}
    else if(enabled&&unlocked)transition(currentPage);
  });
  setButton();transition(Number(app.dataset.page)+1);
  // If the browser allows audible autoplay, start on P1. Otherwise the first
  // reader gesture unlocks the already prepared recording without blocking UI.
  if(enabled&&!document.hidden&&desired!==null){
    const selected=chooseDeck(desired);
    selected.audio.play().then(()=>{
      if(!enabled||document.hidden){selected.audio.pause();return}
      unlocked=true;playbackBlocked=false;transition(currentPage);setButton();
    }).catch(()=>{});
  }
  window.__shiroBgmDebug=()=>({page:currentPage,enabled,desired,ext,decks:decks.map(d=>({track:d.track,time:d.audio.currentTime,playing:!d.audio.paused,level:d.level,volume:d.audio.volume}))});
})();
