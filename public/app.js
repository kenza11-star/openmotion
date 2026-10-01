const $=s=>document.querySelector(s);
const state={assets:[],clips:[],selected:null,current:0,zoom:70,playing:false,fps:30,history:[],future:[]};
let raf=0, last=0;

function uid(){return Math.random().toString(36).slice(2,9)}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function pushHistory(){state.history.push(JSON.stringify({clips:state.clips.map(c=>({...c,keyframes:(c.keyframes||[]).map(k=>({...k}))})),current:state.current}));if(state.history.length>30)state.history.shift();state.future=[]}
function undo(){if(!state.history.length)return;state.future.push(JSON.stringify({clips:state.clips,current:state.current}));Object.assign(state,JSON.parse(state.history.pop()));render();draw()}
function redo(){if(!state.future.length)return;state.history.push(JSON.stringify({clips:state.clips,current:state.current}));Object.assign(state,JSON.parse(state.future.pop()));render();draw()}

function openFiles(){ $('#fileInput').click() }
$('#importBtn').onclick=openFiles; $('#addMedia').onclick=openFiles; $('#startImport').onclick=openFiles;
$('#fileInput').onchange=e=>{[...e.target.files].forEach(addAsset);e.target.value=''}
function addAsset(file){
 const url=URL.createObjectURL(file), id=uid(), type=file.type.startsWith('video')?'video':file.type.startsWith('image')?'image':'audio';
 const asset={id,name:file.name,url,type,file,duration:0};
 state.assets.push(asset);
 if(type==='video'||type==='audio'){
  const m=document.createElement(type==='video'?'video':'audio');m.src=url;m.preload='metadata';
  m.onloadedmetadata=()=>{asset.duration=m.duration||3;if(!state.clips.length)createClip(asset);render()}
 }else {asset.duration=3;if(!state.clips.length)createClip(asset)}
 render();toast(file.name+' imported');
}
function createClip(asset,start=0){
 pushHistory();
 const c={id:uid(),assetId:asset.id,start,duration:Math.max(.1,asset.duration||3),speed:1,x:640,y:360,scale:1,rotation:0,opacity:1,keyframes:[]};
 state.clips.push(c);state.selected=c.id;state.current=start;render();draw();
}
function selected(){return state.clips.find(c=>c.id===state.selected)}
function addText(){
 const asset={id:uid(),name:'Text Layer',type:'text',duration:3,text:'Double tap to edit',url:null};
 state.assets.push(asset);createClip(asset)
}
$('#addText').onclick=addText;

function clipAt(t){return state.clips.find(c=>t>=c.start&&t<=c.start+c.duration)}
function selectClip(id){state.selected=id;const c=selected();if(c)state.current=Math.max(c.start,Math.min(state.current,c.start+c.duration));render();draw()}
function split(){
 const c=selected();if(!c)return toast('Select a clip first');
 const cut=state.current;if(cut<=c.start+.02||cut>=c.start+c.duration-.02)return toast('Put playhead inside the clip');
 pushHistory();const right={...c,id:uid(),start:cut,duration:c.start+c.duration-cut,keyframes:(c.keyframes||[]).map(k=>({...k,t:Math.max(0,k.t-(cut-c.start))})).filter(k=>k.t<=c.start+c.duration-cut)};
 c.duration=cut-c.start;c.keyframes=(c.keyframes||[]).filter(k=>k.t<=c.duration);
 state.clips.push(right);state.selected=right.id;render();draw()
}
function duplicate(){const c=selected();if(!c)return;pushHistory();const n={...c,id:uid(),start:c.start+c.duration+.05,keyframes:(c.keyframes||[]).map(k=>({...k}))};state.clips.push(n);state.selected=n.id;render();draw()}
function del(){if(!selected())return;pushHistory();state.clips=state.clips.filter(c=>c.id!==state.selected);state.selected=null;render();draw()}
$('#splitClip').onclick=split;$('#duplicateClip').onclick=duplicate;$('#deleteClip').onclick=del;$('#undo').onclick=undo;$('#redo').onclick=redo;

function bindInspector(){
 const c=selected();if(!c)return;
 const map={trimStart:'start',trimDuration:'duration',speed:'speed',posX:'x',posY:'y',scale:'scale',rotation:'rotation',opacity:'opacity'};
 Object.entries(map).forEach(([id,key])=>{$('#'+id).oninput=e=>{pushHistory();c[key]=parseFloat(e.target.value)||0;render();draw()}})
}
function render(){
 $('#emptyStage').style.display=state.clips.length?'none':'flex';
 $('#mediaList').innerHTML=state.assets.map(a=>`<button class="mediaItem" data-add="${a.id}"><b>${a.type.toUpperCase()}</b>${a.name}</button>`).join('');
 document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>createClip(state.assets.find(a=>a.id===b.dataset.add)));
 const track=$('#track'), px=state.zoom;track.innerHTML='';
 state.clips.forEach(c=>{const a=state.assets.find(x=>x.id===c.assetId);const d=document.createElement('div');d.className='clip'+(c.id===state.selected?' selected':'');d.style.left=(c.start*px)+'px';d.style.width=Math.max(12,c.duration*px)+'px';d.innerHTML=`<b>${a?.name||'Clip'}</b><br><small>${c.duration.toFixed(2)}s</small>`;d.onclick=()=>selectClip(c.id);track.appendChild(d)});
 const max=Math.max(5,...state.clips.map(c=>c.start+c.duration));$('#scrub').max=max;$('#scrub').value=state.current;
 $('#playhead').style.left=(state.current*px)+'px';$('#ruler').style.backgroundSize=px+'px 100%';
 $('#timeLabel').textContent=format(state.current)+' / '+format(max);$('#fpsBadge').textContent=state.fps+' FPS';
 const c=selected();$('#selectionInfo').textContent=c?((state.assets.find(a=>a.id===c.assetId)?.name||'Clip')+' selected'):'No clip selected';
 $('#inspectorEmpty').hidden=!!c;$('#inspectorBody').hidden=!c;
 if(c){$('#clipName').textContent=state.assets.find(a=>a.id===c.assetId)?.name||'Clip';[['trimStart','start'],['trimDuration','duration'],['speed','speed'],['posX','x'],['posY','y'],['scale','scale'],['rotation','rotation'],['opacity','opacity']].forEach(([i,k])=>$('#'+i).value=c[k]);$('#keyframes').textContent=(c.keyframes?.length||0)+' keyframes';bindInspector()}
}
function format(t){t=Math.max(0,t);const m=Math.floor(t/60),s=(t%60).toFixed(3).padStart(6,'0');return String(m).padStart(2,'0')+':'+s}
$('#scrub').oninput=e=>{state.current=parseFloat(e.target.value);syncMedia();render();draw()}
$('#zoom').oninput=e=>{state.zoom=+e.target.value;render()}
$('#zoomIn').onclick=()=>{$('#zoom').value=Math.min(160,+$('#zoom').value+10);state.zoom=+$('#zoom').value;render()}
$('#zoomOut').onclick=()=>{$('#zoom').value=Math.max(20,+$('#zoom').value-10);state.zoom=+$('#zoom').value;render()}
$('#prevFrame').onclick=()=>{state.current=Math.max(0,state.current-1/state.fps);syncMedia();render();draw()}
$('#nextFrame').onclick=()=>{state.current+=1/state.fps;syncMedia();render();draw()}
$('#play').onclick=()=>{state.playing=!state.playing;$('#play').textContent=state.playing?'❚❚':'▶';if(state.playing){last=performance.now();raf=requestAnimationFrame(tick)}}
function tick(t){if(!state.playing)return;state.current+=(t-last)/1000;last=t;const end=Math.max(0,...state.clips.map(c=>c.start+c.duration));if(state.current>end){state.current=0}syncMedia();render();draw();raf=requestAnimationFrame(tick)}
function syncMedia(){state.clips.forEach(c=>{const a=state.assets.find(x=>x.id===c.assetId);if(!a||!a.el)return;if(a.type==='video'){const local=Math.max(0,(state.current-c.start)*c.speed);if(state.current>=c.start&&state.current<=c.start+c.duration){if(Math.abs(a.el.currentTime-local)>.08)a.el.currentTime=local;a.el.playbackRate=c.speed;if(state.playing)a.el.play().catch(()=>{});else a.el.pause()}}})}

function getCanvas(){return $('#stage')}
function draw(){
 const ctx=getCanvas().getContext('2d');ctx.clearRect(0,0,1280,720);ctx.fillStyle='#000';ctx.fillRect(0,0,1280,720);
 state.clips.forEach(c=>{if(state.current<c.start||state.current>c.start+c.duration)return;const a=state.assets.find(x=>x.id===c.assetId);if(!a)return;
  ctx.save();ctx.globalAlpha=c.opacity;ctx.translate(c.x,c.y);ctx.rotate(c.rotation*Math.PI/180);ctx.scale(c.scale,c.scale);
  if(a.type==='image'&&a.el)ctx.drawImage(a.el,-640,-360,1280,720);
  else if(a.type==='video'&&a.el)ctx.drawImage(a.el,-640,-360,1280,720);
  else if(a.type==='text'){ctx.fillStyle='#fff';ctx.font='bold 64px system-ui';ctx.textAlign='center';ctx.fillText(a.text||'Text',0,0)}
  ctx.restore()
 })
}
function prepareAsset(a){if(a.type==='image'){a.el=new Image();a.el.onload=draw;a.el.src=a.url}else if(a.type==='video'){a.el=document.createElement('video');a.el.src=a.url;a.el.muted=true;a.el.playsInline=true;a.el.preload='auto';a.el.onloadeddata=draw}}
const oldPush=state.assets.push.bind(state.assets);state.assets.push=function(a){oldPush(a);prepareAsset(a)}
$('#addKeyframe').onclick=()=>{const c=selected();if(!c)return;pushHistory();c.keyframes.push({t:Math.max(0,state.current-c.start),x:c.x,y:c.y,scale:c.scale,rotation:c.rotation,opacity:c.opacity,easing:'easeInOut'});render();draw();toast('Keyframe added')}

$('#openExport').onclick=()=>$('#exportModal').hidden=false;$('#closeExport').onclick=()=>$('#exportModal').hidden=true;
$('#startExport').onclick=async()=>{
 const canvas=$('#stage'),fps=+$('#exportFps').value||30;
 const stream=canvas.captureStream(fps);let mime='video/webm;codecs=vp9';if(!MediaRecorder.isTypeSupported(mime))mime='video/webm';
 const rec=new MediaRecorder(stream,{mimeType:mime});const chunks=[];rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
 rec.onstop=()=>{const blob=new Blob(chunks,{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='kyn-x-export.webm';a.click();$('#exportStatus').textContent='Export complete.'};
 $('#exportStatus').textContent='Exporting…';rec.start();const was=state.playing;state.playing=true;let started=performance.now(),old=state.current;function step(t){if(t-started>Math.max(1000,...state.clips.map(c=>c.start+c.duration))*1.1){state.playing=false;rec.stop();state.current=old;render();draw();return}state.current=old+(t-started)/1000;syncMedia();draw();requestAnimationFrame(step)}requestAnimationFrame(step)
}

document.addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();$('#play').click()}if(e.key==='Delete')del();if(e.key==='s'&&!e.ctrlKey)split()})
render();draw();
