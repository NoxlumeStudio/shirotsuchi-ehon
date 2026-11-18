(function(root,factory){const a=factory();if(typeof module==='object')module.exports=a;else root.PhoneLandscapeCore=a})(typeof window!=='undefined'?window:this,()=>{
const eligible=v=>v.coarse&&v.width>v.height&&Math.min(v.screenWidth,v.screenHeight)<=600&&Math.max(v.screenWidth,v.screenHeight)<=1400;
const viewport=w=>({width:Math.min(w.document.documentElement.clientWidth,w.visualViewport?.width||Infinity),height:Math.min(w.document.documentElement.clientHeight,w.visualViewport?.height||Infinity),coarse:w.matchMedia('(pointer:coarse)').matches,screenWidth:w.screen.width,screenHeight:w.screen.height});
const contain=(w,h)=>{const scale=Math.min(w/1600,h/900);return {width:1600*scale,height:900*scale,scale}};
function paginate(text,fits){const a=Array.from(text),out=[];let i=0;while(i<a.length){let low=1,high=a.length-i,best=1;while(low<=high){const n=(low+high)>>1;if(fits(a.slice(i,i+n).join(''))){best=n;low=n+1}else high=n-1}if(i+best<a.length){const s=a.slice(i,i+best).join(''),m=[...s.matchAll(/[。！？\n]/gu)].pop();if(m){const n=Array.from(s.slice(0,m.index+1)).length;if(n>best*.65)best=n}}out.push(a.slice(i,i+best).join(''));i+=best}return out.length?out:['']}
// Map the artwork's existing prose space into the contained picture, in native
// phone pixels. Leave room for overlaid controls without changing the picture.
function overlayBox(fit,box){
 const width=Math.min(fit.width,Math.max(1,box.width*fit.scale));
 const height=Math.min(Math.max(1,fit.height-76),Math.max(86,Math.min(fit.height*.46,box.height*fit.scale)));
 const left=Math.max(0,Math.min(fit.width-width,box.x*fit.scale));
 const top=Math.max(36,Math.min(fit.height-40-height,box.y*fit.scale));
 return {left,top,width,height};
}
// Give native-size phone text the adjacent panorama margin as well as the
// original reading space, instead of scaling down the desktop text rectangle.
function readingBox(fit,box,canvas){
 const left=Math.max(8,Math.min(canvas.width-100,(canvas.width-fit.width)/2+box.x*fit.scale));
 const width=Math.max(1,canvas.width-12-left);
 const height=Math.min(canvas.height-76,Math.max(136,fit.height*.64));
 const top=Math.max(36,Math.min(canvas.height-40-height,(canvas.height-fit.height)/2+box.y*fit.scale));
 return {left,top,width,height};
}
function readerBox(canvas){return {left:12,top:42,width:Math.max(1,canvas.width-24),height:Math.max(1,canvas.height-88)}}
function navigation(reading,part,count,direction){return reading&&part+direction>=0&&part+direction<count?{part:part+direction}:{direction};}
return {eligible,viewport,contain,paginate,overlayBox,readingBox,readerBox,navigation};});
