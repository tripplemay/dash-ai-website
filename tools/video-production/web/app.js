"use strict";
const $ = (id) => document.getElementById(id);
const labels = {visual:"画面与动作",voice:"旁白与情感",music:"配乐与混音",ui:"信息 UI"};
let state, token, projectId, selected, busy = false;
const player = $("player"), comparison = $("comparison");
const node = (tag, text, cls) => { const el = document.createElement(tag); if(text !== undefined) el.textContent=text; if(cls)el.className=cls; return el; };
function notice(text, error=false){ $("notice").textContent=text; $("notice").className=error?"error":""; }
async function api(path, body){ const options = body ? {method:"POST", headers:{"Content-Type":"application/json","X-Workbench-Token":token}, body:JSON.stringify(body)} : {}; const res=await fetch(path, options); const data=await res.json(); if(!res.ok) throw new Error(data.error || res.statusText); return data; }
const base = () => "/api/projects/"+encodeURIComponent(projectId);
const media = (id) => base()+"/media/"+encodeURIComponent(id);
function time(seconds){ const s=Number(seconds)||0; return String(Math.floor(s/60)).padStart(2,"0")+":"+(s%60).toFixed(3).padStart(6,"0"); }
async function action(name, data){ if(busy)return; busy=true; document.querySelectorAll("button").forEach(b=>b.disabled=true); try {const result=await api(base()+"/"+name,{...data,revision:state.revision}); await refresh(); notice(name==="export"?"交付包已导出："+result.directory:"已保存。批准仅适用于指定版本与维度。"); return result;} catch(e){notice(e.message,true); if(e.message.includes("refresh"))await refresh();} finally{busy=false;document.querySelectorAll("button").forEach(b=>b.disabled=false);} }
function getReviews(id,layer){return state.reviews.filter(r=>r.asset===id&&r.layer===layer&&r.scope==="full");}
function renderAssets(){
  const filter=$("role-filter").value; $("assets").replaceChildren();
  Object.values(state.assets).slice().reverse().filter(a=>filter==="all"||a.role===filter).forEach(a=>{const b=node("button",a.label,"asset"+(a.id===selected?" selected":"")); b.dataset.asset=a.id; b.append(node("small",a.unit+" / "+a.role+" · "+time(a.media.duration)+" · "+a.sha256.slice(0,10)));b.onclick=()=>choose(a.id);$("assets").append(b);});
}
function renderDetails(){
  const a=state.assets[selected]; if(!a)return;
  $("version-tag").textContent=a.role+" / "+a.sha256.slice(0,8); $("playing-label").textContent="A · "+a.label;
  $("asset-meta").textContent="SHA256 "+a.sha256+"\n"+a.path+" · "+(a.bytes/1048576).toFixed(1)+" MB · "+a.media.streams.map(s=>s.codec_name+(s.width?" "+s.width+"×"+s.height+" @ "+s.avg_frame_rate:"")).join(" / ");
  $("approvals").replaceChildren();
  Object.entries(labels).forEach(([layer,label])=>{const list=getReviews(selected,layer), last=list[list.length-1];const good=last?.decision==="approved";$("approvals").append(node("div",label+" · "+(last?(good?"已通过":"需返工"):"待审阅"),"approval"+(last?(good?" good":" bad"):"")));});
  $("check-results").replaceChildren();a.checks.forEach(c=>$("check-results").append(node("p",(c.passed?"✓ ":"× ")+c.kind+" · "+c.at.slice(0,19),c.passed?"good":"bad")));
  $("comments").replaceChildren(); state.comments.filter(c=>c.asset===selected).forEach(c=>{const box=node("div",undefined,"comment"), seek=node("button",time(c.start)+" – "+time(c.end),"secondary");seek.onclick=()=>{player.currentTime=c.start;player.pause();};box.append(seek,node("small",c.author+" · "+(c.resolved?"已处理":"待处理")),node("p",c.text));if(!c.resolved){const resolve=node("button","标记已处理","secondary");resolve.onclick=()=>{const text=prompt("处理方式或复核依据（保留历史反馈）");if(text)action("resolve",{id:c.id,text,author:$("author").value});};box.append(resolve);}$("comments").append(box);});
}
function choose(id){
  player.pause();comparison.pause();selected=id;
  const oldTime=player.currentTime||0; player.src=media(id);player.onloadedmetadata=()=>{player.currentTime=Math.min(oldTime,Number.isFinite(player.duration)?Math.max(0,player.duration-.01):0);};
  renderAssets();renderDetails();
}
async function refresh(){
  if(!projectId)return; state=await api(base());$("title").textContent=state.title;$("subtitle").textContent="制作台账 v"+state.revision+" · "+Object.keys(state.assets).length+" 个工件 · 最新输出与批准交付分开管理";
  $("project-facts").textContent=state.id+" / "+state.created.slice(0,10);$("asset-count").textContent=Object.keys(state.assets).length+" ITEMS";
  const previous=$("compare-select").value;$("compare-select").replaceChildren(new Option("关闭对照",""));Object.values(state.assets).filter(a=>a.media.streams.some(s=>s.codec_type==="video")).forEach(a=>$("compare-select").add(new Option(a.label,a.id)));$("compare-select").value=previous;
  $("release-state").textContent=state.approved_release?"已批准交付":"尚未最终批准";
  $("jobs").replaceChildren(); const costs=state.cost_reserved_or_spent;
  $("jobs").append(node("p",Object.keys(costs).length?Object.entries(costs).map(([u,n])=>u+": 已计 / 预留 "+n+" / 预算 "+(state.budgets[u]??"未设置")).join("；"):"无新增生成费用；历史费用未自动导入。"));
  Object.values(state.jobs).forEach(j=>$("jobs").append(node("p",j.unit+" · "+j.provider+" / "+j.state+" · "+(j.submit_id||"尚无任务 ID"))));
  $("notes").replaceChildren();state.notes.forEach(n=>$("notes").append(node("li",n)));
  $("cue-panel").hidden=!state.timeline.length;$("cues").replaceChildren();state.timeline.forEach(c=>{const start=c.start_seconds??c.start,end=c.end_seconds??c.end;if(!Number.isFinite(start)||!Number.isFinite(end))return;const b=node("button",(c.id||"")+" · "+time(start)+" · "+(c.text||""),"asset");b.onclick=()=>{player.pause();player.currentTime=Math.min(start,player.duration);$("comment-start").value=start.toFixed(3);$("comment-end").value=end.toFixed(3);};$("cues").append(b);});
  if(!Object.keys(state.assets).length){player.removeAttribute("src");player.load();renderAssets();$("asset-meta").textContent="尚无素材，使用 CLI ingest 导入。";return;}
  if(!selected||!state.assets[selected])choose(state.latest_render||Object.keys(state.assets)[0]);else{renderAssets();renderDetails();}
}
$("projects").onchange=async()=>{player.pause();comparison.pause();comparison.removeAttribute("src");$("comparison-wrap").hidden=true;$("viewer-grid").classList.remove("comparing");projectId=$("projects").value;selected=null;await refresh();};
$("refresh").onclick=()=>refresh().catch(e=>notice(e.message,true));$("role-filter").onchange=renderAssets;
$("compare-select").onchange=()=>{const id=$("compare-select").value;comparison.pause();$("comparison-wrap").hidden=!id;$("viewer-grid").classList.toggle("comparing",!!id);if(id){comparison.src=media(id);comparison.onloadedmetadata=()=>{comparison.currentTime=Math.min(player.currentTime,comparison.duration);};}else{comparison.removeAttribute("src");comparison.load();}};
player.ontimeupdate=()=>{$("clock").textContent=time(player.currentTime);if(!$("comparison-wrap").hidden&&Number.isFinite(comparison.duration)&&Math.abs(comparison.currentTime-player.currentTime)>.18)comparison.currentTime=Math.min(player.currentTime,comparison.duration);};
player.onpause=()=>comparison.pause();player.onseeking=()=>{if(Number.isFinite(comparison.duration))comparison.currentTime=Math.min(player.currentTime,comparison.duration);};player.onratechange=()=>comparison.playbackRate=player.playbackRate;
player.onplay=()=>{if(!$("comparison-wrap").hidden&&player.currentTime<comparison.duration)comparison.play().catch(e=>notice("B 对照播放失败："+e.message,true));};
$("play-both").onclick=()=>player.paused?player.play().catch(e=>notice(e.message,true)):player.pause();
$("comment-now").onclick=()=>{player.pause();$("comment-start").value=player.currentTime.toFixed(3);$("comment-end").value=player.currentTime.toFixed(3);$("comment-text").focus();};
$("comment-form").onsubmit=async e=>{e.preventDefault();const r=await action("comment",{asset:selected,start:Number($("comment-start").value),end:Number($("comment-end").value),author:$("author").value,text:$("comment-text").value});if(r)$("comment-text").value="";};
$("review-form").onsubmit=e=>{e.preventDefault();if(!$("author").value.trim()){notice("请先填写审阅人。",true);return;}if(confirm("确认已完整审阅当前素材的所选维度？不会同时批准其他维度或新版本。"))action("review",{asset:selected,layer:$("review-layer").value,decision:$("review-decision").value,scope:"full",author:$("author").value,text:$("review-text").value});};
$("check").onclick=()=>{notice("正在核验 SHA、依赖与全流解码，请稍候…");action("check",{asset:selected});};
$("release-form").onsubmit=e=>{e.preventDefault();if(confirm("确认此为最终整片？系统将核对全片分层批准、未处理反馈和技术检查。"))action("release",{asset:selected,author:$("author").value,device_review:$("device-review").value,rights_review:$("rights-review").value});};
$("export").onclick=async()=>{const r=await action("export",{});if(r)$("export-result").textContent=r.directory;};
async function init(){const data=await api("/api/projects");token=data.token;data.projects.forEach(p=>$("projects").add(new Option(p.title,p.id)));if(!data.projects.length){$("subtitle").textContent="暂无项目，请使用 CLI init 创建项目并导入素材。";return;}projectId=data.projects[0].id;await refresh();}
init().catch(e=>notice(e.message,true));
