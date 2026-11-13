(() => {
  "use strict";
  const STORE_KEY = "td_crm_v2";
  const OLD_KEY = "td_leads_v1";
  const $ = id => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0,10);
  let db = {version:2, leads:[], activity:[]};
  let toastTimer;

  function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : "td-"+Date.now()+"-"+Math.random().toString(16).slice(2)); }
  function clean(value, max=3000){ return String(value ?? "").trim().slice(0,max); }
  function safeDate(value){ return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : ""; }
  function load(){
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if(raw){ const parsed=JSON.parse(raw); if(parsed && Array.isArray(parsed.leads)){ db={version:2,leads:parsed.leads,activity:Array.isArray(parsed.activity)?parsed.activity:[]}; return; } }
      const old=localStorage.getItem(OLD_KEY);
      if(old){
        const arr=JSON.parse(old);
        if(Array.isArray(arr)){
          db.leads=arr.map(x=>({id:x.id||uid(),company:clean(x.company||x.name,120),city:clean(x.city,80),website:clean(x.website,200),contact:clean(x.contact,100),contactInfo:clean(x.contactInfo,150),status:clean(x.status,50)||"Új",nextTask:clean(x.nextTask,180),dueDate:safeDate(x.dueDate),contactDate:safeDate(x.contactDate),notes:clean(x.notes),createdAt:x.createdAt||new Date().toISOString(),updatedAt:x.updatedAt||new Date().toISOString()})).filter(x=>x.company);
          save(false);
        }
      }
    } catch(e){ console.error("Nem sikerült beolvasni a CRM-adatokat",e); }
  }
  function save(show=true){
    try {
      localStorage.setItem(STORE_KEY,JSON.stringify(db));
      $("saveState").textContent="● Mentve";
      $("saveState").style.color="#a8e5c8";
      if(show) toast("Mentve – az adatok ezen az eszközön tárolódnak.");
    } catch(e){
      $("saveState").textContent="● Mentési hiba";
      $("saveState").style.color="#ffb0a8";
      toast("Nem sikerült menteni. Tölts le biztonsági mentést, és ellenőrizd a tárhelyet.");
    }
  }
  function log(action, company){
    db.activity.unshift({id:uid(),action,company,at:new Date().toISOString()});
    db.activity=db.activity.slice(0,300);
  }
  function toast(msg){
    const el=$("toast"); el.textContent=msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
  }
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function dateLabel(d){ if(!d)return "—"; const [y,m,day]=d.split("-"); return `${y}.${m}.${day}.`; }
  function dueClass(d){if(!d)return ""; if(d<today())return "overdue"; if(d===today())return "today"; return "";}
  function render(){
    const q=$("searchInput").value.trim().toLocaleLowerCase("hu");
    const filter=$("statusFilter").value;
    const visible=db.leads.filter(x=>(!filter||x.status===filter)&&(!q||`${x.company} ${x.city}`.toLocaleLowerCase("hu").includes(q))).sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
    $("statTotal").textContent=db.leads.length;
    $("statWaiting").textContent=db.leads.filter(x=>x.status==="Válaszra vár").length;
    $("statClients").textContent=db.leads.filter(x=>x.status==="Ügyfél").length;
    $("statOverdue").textContent=db.leads.filter(x=>x.dueDate&&x.dueDate<today()&&x.nextTask).length;
    $("resultCount").textContent=`${visible.length} kapcsolat`;
    $("emptyState").classList.toggle("hidden",visible.length!==0);
    $("leadRows").innerHTML=visible.map(x=>{
      const d=x.dueDate?`<span class="due ${dueClass(x.dueDate)}">${dateLabel(x.dueDate)}</span>`:"—";
      const st=x.status.toLocaleLowerCase("hu").replaceAll(" ","-");
      return `<tr><td><div class="company-name">${esc(x.company)}</div><div class="city-name">${esc(x.city||"Város nincs megadva")}</div></td><td><span class="status ${esc(st)}">${esc(x.status)}</span></td><td class="task-cell">${esc(x.nextTask||"Nincs megadva")}</td><td>${d}</td><td>${dateLabel((x.updatedAt||"").slice(0,10))}</td><td><div class="row-actions"><button class="mini-btn" data-edit="${esc(x.id)}">Szerkesztés</button><button class="mini-btn" data-delete="${esc(x.id)}">Törlés</button></div></td></tr>`;
    }).join("");
    renderTasks();
  }
  function renderTasks(){
    const items=db.leads.filter(x=>x.nextTask&&x.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    $("taskSummary").textContent=items.length?`${items.length} ütemezett teendő`:"Nincs ütemezett teendő";
    $("taskList").innerHTML=items.length?items.map(x=>`<div class="task-item"><div><strong>${esc(x.nextTask)}</strong><small>${esc(x.company)}${x.city?" · "+esc(x.city):""}</small></div><span class="task-date ${dueClass(x.dueDate)}">${dateLabel(x.dueDate)}${x.dueDate<today()?" · Lejárt":x.dueDate===today()?" · Ma":""}</span></div>`).join(""):`<p class="muted">Adj meg következő teendőt és határidőt egy kapcsolatnál, hogy itt megjelenjen.</p>`;
  }
  function openForm(item){
    $("leadForm").reset();
    $("leadId").value=item?.id||"";
    $("dialogTitle").textContent=item?"Kapcsolat szerkesztése":"Új érdeklődő";
    for(const key of ["company","city","website","contact","contactInfo","status","nextTask","dueDate","contactDate","notes"]) $(key).value=item?.[key]|| (key==="status"?"Új":"");
    $("leadDialog").showModal();
  }
  function closeForm(){ $("leadDialog").close(); }
  function exportFile(name,content,type){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
  }
  function backup(){
    const payload={...db,exportedAt:new Date().toISOString(),app:"Transport Digital CRM"};
    exportFile(`transport-digital-mentes-${today()}.json`,JSON.stringify(payload,null,2),"application/json;charset=utf-8");
    toast("A teljes biztonsági mentés letöltése elindult.");
  }
  function csv(){
    const cols=["company","city","website","contact","contactInfo","status","nextTask","dueDate","contactDate","notes","createdAt","updatedAt"];
    const rows=[["Cégnév","Város","Weboldal","Kapcsolattartó","Üzleti elérhetőség","Státusz","Következő teendő","Határidő","Kapcsolatfelvétel dátuma","Megjegyzés","Létrehozva","Módosítva"],...db.leads.map(x=>cols.map(k=>x[k]||""))];
    const content="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\r\n");
    exportFile(`transport-digital-kapcsolatok-${today()}.csv`,content,"text/csv;charset=utf-8");
  }
  function importBackup(file){
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(reader.result);
        if(!data||!Array.isArray(data.leads))throw new Error("Érvénytelen mentés");
        if(!confirm(`A visszaállítás ${data.leads.length} kapcsolatot tölt be, és lecseréli a jelenlegi CRM-adatokat. Folytatod?`))return;
        db={version:2,leads:data.leads,activity:Array.isArray(data.activity)?data.activity:[]};
        save(false);render();toast("A biztonsági mentés visszaállítása sikerült.");
      }catch(e){toast("A fájl nem érvényes Transport Digital mentés.");}
      $("importJsonInput").value="";
    };
    reader.readAsText(file);
  }
  $("newLeadBtn").addEventListener("click",()=>openForm());
  $("closeDialog").addEventListener("click",closeForm);
  $("cancelDialog").addEventListener("click",closeForm);
  $("leadForm").addEventListener("submit",e=>{
    e.preventDefault();
    const id=$("leadId").value;
    const old=db.leads.find(x=>x.id===id);
    const item={id:id||uid(),company:clean($("company").value,120),city:clean($("city").value,80),website:clean($("website").value,200),contact:clean($("contact").value,100),contactInfo:clean($("contactInfo").value,150),status:$("status").value,nextTask:clean($("nextTask").value,180),dueDate:safeDate($("dueDate").value),contactDate:safeDate($("contactDate").value),notes:clean($("notes").value),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(!item.company){toast("A cégnév megadása kötelező.");return;}
    if(old){db.leads=db.leads.map(x=>x.id===id?item:x);log("Szerkesztés",item.company);}else{db.leads.push(item);log("Új kapcsolat",item.company);}
    save(false);render();closeForm();toast("A kapcsolat adatai sikeresen mentve.");
  });
  $("leadRows").addEventListener("click",e=>{
    const edit=e.target.closest("[data-edit]"); const del=e.target.closest("[data-delete]");
    if(edit){const item=db.leads.find(x=>x.id===edit.dataset.edit);if(item)openForm(item);}
    if(del){const item=db.leads.find(x=>x.id===del.dataset.delete);if(item&&confirm(`Biztosan törlöd ezt a kapcsolatot: ${item.company}?`)){db.leads=db.leads.filter(x=>x.id!==item.id);log("Törlés",item.company);save(false);render();toast("A kapcsolat törölve.");}}
  });
  $("searchInput").addEventListener("input",render);
  $("statusFilter").addEventListener("change",render);
  $("csvBtn").addEventListener("click",csv);
  $("backupBtn").addEventListener("click",backup);
  $("exportJsonBtn").addEventListener("click",backup);
  $("importJsonInput").addEventListener("change",e=>{if(e.target.files[0])importBackup(e.target.files[0]);});
  window.addEventListener("storage",e=>{if(e.key===STORE_KEY){load();render();}});
  window.addEventListener("beforeunload",()=>{try{localStorage.setItem(STORE_KEY,JSON.stringify(db));}catch(e){}});
  load();render();
})();