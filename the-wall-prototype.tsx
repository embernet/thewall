import { useState, useCallback, useRef, useEffect, useMemo, useReducer } from "react";

const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2, 11);
const now = () => new Date().toISOString();
const mid = (a="a",b="z") => { let m=""; for(let i=0;i<Math.max(a.length,b.length)+1;i++){const ca=i<a.length?a.charCodeAt(i):97,cb=i<b.length?b.charCodeAt(i):122;if(ca<cb-1){m+=String.fromCharCode(Math.floor((ca+cb)/2));return m;}m+=String.fromCharCode(ca);}return m+"n";};
const fmtT = ms => { const s=Math.floor(ms/1000); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); };
const COL_TYPES = [
  {type:"transcript",title:"Transcript",icon:"🎙️",color:"#ef4444"},
  {type:"notes",title:"Notes",icon:"📝",color:"#6366f1"},
  {type:"concepts",title:"Key Concepts",icon:"💡",color:"#8b5cf6"},
  {type:"ideas",title:"Ideas",icon:"🧠",color:"#a855f7"},
  {type:"questions",title:"Questions",icon:"❓",color:"#ec4899"},
  {type:"claims",title:"Claims",icon:"📌",color:"#14b8a6"},
  {type:"gaps",title:"Gaps & Risks",icon:"⚠️",color:"#f97316"},
  {type:"actions",title:"Actions",icon:"✅",color:"#22c55e"},
  {type:"inquiry",title:"Inquiry",icon:"🔮",color:"#06b6d4"},
  {type:"agent_queue",title:"Agent Queue",icon:"⚡",color:"#eab308"},
  {type:"highlights",title:"Highlights",icon:"⭐",color:"#fbbf24"},
  {type:"trash",title:"Trash",icon:"🗑️",color:"#6b7280"},
];
const SB={user:{l:"User",bg:"#4f46e5"},agent:{l:"Agent",bg:"#0891b2"},transcription:{l:"Transcript",bg:"#dc2626"},inquiry:{l:"Inquiry",bg:"#06b6d4"}};
const MC={silent:"#6366f1",active:"#22c55e",sidekick:"#f59e0b"};
const SC=["#f59e0b","#6366f1","#22c55e","#ec4899","#06b6d4","#f97316","#a855f7","#14b8a6"];

// ── Claude API ──
const askClaude = async (sys, msg) => {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:sys,messages:[{role:"user",content:msg}]})
    });
    const d = await r.json();
    return d.content?.map(b=>b.text||"").join("\n")||"";
  } catch(e){console.error("API err:",e);return null;}
};

// ── Simple TF-IDF Embeddings ──
const stopWords = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","shall","can","need","dare","ought","used","to","of","in","for","on","with","at","by","from","as","into","through","during","before","after","above","below","between","out","off","over","under","again","further","then","once","here","there","when","where","why","how","all","each","every","both","few","more","most","other","some","such","no","not","only","own","same","so","than","too","very","just","because","but","and","or","if","while","that","this","it","i","we","they","he","she","you","my","your","his","her","its","our","their","what","which"]);
const tokenize = text => text.toLowerCase().replace(/[^a-z0-9\s]/g,"").split(/\s+/).filter(w=>w.length>2&&!stopWords.has(w));
const tfidf = (text, corpus) => {
  const tokens = tokenize(text);
  const tf = {};
  tokens.forEach(t => { tf[t] = (tf[t]||0) + 1; });
  const maxTf = Math.max(...Object.values(tf), 1);
  const vec = {};
  Object.entries(tf).forEach(([t,f]) => {
    const df = corpus.filter(d => d.includes(t)).length || 1;
    vec[t] = (f/maxTf) * Math.log((corpus.length+1)/df);
  });
  return vec;
};
const cosSim = (a, b) => {
  const keys = new Set([...Object.keys(a),...Object.keys(b)]);
  let dot=0,na=0,nb=0;
  keys.forEach(k => { const va=a[k]||0,vb=b[k]||0; dot+=va*vb; na+=va*va; nb+=vb*vb; });
  return na&&nb ? dot/(Math.sqrt(na)*Math.sqrt(nb)) : 0;
};
const findSimilar = (query, cards, topK=5) => {
  const corpus = cards.map(c => tokenize(c.content).join(" "));
  const qVec = tfidf(query, corpus);
  return cards.map((c,i) => ({card:c, score:cosSim(qVec, tfidf(c.content, corpus))}))
    .sort((a,b) => b.score-a.score).slice(0,topK).filter(x=>x.score>0.05);
};

// ── Persistence ──
const SKEY="wall-sess-";
const IKEY="wall-idx";

const saveSession = async (state) => {
  if(!state?.session?.id) return false;
  try {
    const audio = {autoScroll: state.audio?.autoScroll !== false};
    const data = {session:state.session, columns:state.columns, cards:state.cards, audio, speakerColors:state.speakerColors||{}};
    const json = JSON.stringify(data);
    const r1 = await window.storage.set(SKEY+state.session.id, json);
    if(!r1){console.error("storage.set session failed");return false;}
    // Update index
    let idx = [];
    try { const r = await window.storage.get(IKEY); if(r&&r.value) idx = JSON.parse(r.value); } catch(e){}
    const entry = {id:state.session.id, title:state.session.title, mode:state.session.mode, updatedAt:now(), cardCount:(state.cards||[]).filter(c=>!c.isDeleted).length};
    idx = [entry, ...idx.filter(x=>x.id!==state.session.id)].slice(0,50);
    const r2 = await window.storage.set(IKEY, JSON.stringify(idx));
    if(!r2){console.error("storage.set index failed");return false;}
    return true;
  } catch(e){console.error("Save err:",e);return false;}
};

const loadSession = async (id) => {
  try {
    const r = await window.storage.get(SKEY+id);
    if(r&&r.value) return JSON.parse(r.value);
    return null;
  } catch(e){console.error("Load session err:",e);return null;}
};

const loadIndex = async () => {
  try {
    const r = await window.storage.get(IKEY);
    if(r&&r.value) return JSON.parse(r.value);
    return [];
  } catch(e){console.error("Load index err:",e);return [];}
};

const deleteSession = async (id) => {
  try { await window.storage.delete(SKEY+id); } catch(e){}
  try {
    let idx=[];
    try{const r=await window.storage.get(IKEY);if(r&&r.value) idx=JSON.parse(r.value);}catch(e){}
    idx=idx.filter(x=>x.id!==id);
    await window.storage.set(IKEY,JSON.stringify(idx));
  } catch(e){console.error("Delete err:",e);}
};

// ── Agent Definitions ──
const AGENTS = [
  {key:"concepts",col:"concepts",name:"Concept Extractor",
    sys:"Extract key concepts from meeting transcript. Output 1-3 items, each on its own line starting with •. One sentence each. Only bullets.",
    prompt:t=>"Extract key concepts:\n\n"+t},
  {key:"questions",col:"questions",name:"Questioner",
    sys:"Generate probing questions from meeting discussion. Output 1-2 questions, each on a new line starting with •. Only bullets.",
    prompt:t=>"What questions arise?\n\n"+t},
  {key:"claims",col:"claims",name:"Claim Identifier",
    sys:"Identify factual claims and assertions. Output 1-2 items, each on a new line starting with •. Only bullets.",
    prompt:t=>"Identify claims:\n\n"+t},
  {key:"gaps",col:"gaps",name:"Gap Finder",
    sys:"Identify gaps, risks, unstated assumptions. Output 1-2 items, each on a new line starting with •. Only bullets.",
    prompt:t=>"What gaps or risks exist?\n\n"+t},
  {key:"actions",col:"actions",name:"Action Tracker",
    sys:"Extract action items and decisions. Output 0-2 items starting with •. Include who is responsible. If none, output nothing.",
    prompt:t=>"Extract action items:\n\n"+t},
];

// ── State ──
const mkSession = (title="New Session", mode="sidekick") => {
  const sid=uid();
  const cols=COL_TYPES.map((c,i)=>({id:uid(),sessionId:sid,type:c.type,title:c.title,sortOrder:String.fromCharCode(98+i*2),visible:c.type!=="trash",collapsed:false}));
  return {session:{id:sid,title,mode,goal:"",status:"active",createdAt:now()},columns:cols,cards:[],
    audio:{recording:false,paused:false,level:0,elapsed:0,autoScroll:true},
    agentBusy:{},agentTasks:[],speakerColors:{},view:"session"};
};

const reducer = (st,a) => {
  switch(a.type){
    case "INIT": return {...a.p,view:"session"};
    case "SET_TITLE": return {...st,session:{...st.session,title:a.p}};
    case "SET_MODE": return {...st,session:{...st.session,mode:a.p}};
    case "ADD_CARD": return {...st,cards:[...st.cards,a.p]};
    case "UPDATE_CARD": return {...st,cards:st.cards.map(c=>c.id===a.p.id?{...c,...a.p.u,updatedAt:now()}:c)};
    case "DELETE_CARD":{const t=st.columns.find(c=>c.type==="trash");return t?{...st,cards:st.cards.map(c=>c.id===a.p?{...c,columnId:t.id,isDeleted:1}:c)}:st;}
    case "MOVE_CARD": return {...st,cards:st.cards.map(c=>c.id===a.p.cid?{...c,columnId:a.p.col,sortOrder:a.p.so,isDeleted:0}:c)};
    case "TOGGLE_HL": return {...st,cards:st.cards.map(c=>{if(c.id!==a.p)return c;const m={none:"user",user:"none",ai:"both",both:"ai"};return{...c,highlightedBy:m[c.highlightedBy]||"user"};})};
    case "TOG_VIS": return {...st,columns:st.columns.map(c=>c.id===a.p?{...c,visible:!c.visible}:c)};
    case "TOG_COLL": return {...st,columns:st.columns.map(c=>c.id===a.p?{...c,collapsed:!c.collapsed}:c)};
    case "EMPTY_TRASH":{const t=st.columns.find(c=>c.type==="trash");return{...st,cards:st.cards.filter(c=>c.columnId!==t?.id)};}
    case "SET_AUDIO": return {...st,audio:{...st.audio,...a.p}};
    case "SET_BUSY": return {...st,agentBusy:{...st.agentBusy,[a.p.k]:a.p.v}};
    case "ADD_TASK": return {...st,agentTasks:[...st.agentTasks,a.p]};
    case "UPD_TASK": return {...st,agentTasks:st.agentTasks.map(t=>t.id===a.p.id?{...t,...a.p.u}:t)};
    case "SET_VIEW": return {...st,view:a.p};
    case "SET_COLORS": return {...st,speakerColors:a.p};
    default: return st;
  }
};

// ── Audio Viz ──
const AudioViz = ({active,level}) => (
  <div style={{display:"flex",alignItems:"end",gap:1.5,height:24}}>
    {Array.from({length:18},(_,i)=>{
      const h=active?Math.max(2,(level*(0.3+0.7*Math.sin((i/18)*Math.PI)))*22+Math.random()*3):2;
      return <div key={i} style={{width:2.5,height:h,borderRadius:1,background:active?"hsl("+(i/18)*40+",80%,58%)":"#334155",transition:"height 0.08s"}}/>;
    })}
  </div>
);

// ── Card ──
const CardC = ({card,onDel,onHl,onEdit,colType,spkC,onNavigate}) => {
  const [editing,setEditing]=useState(false);
  const [txt,setTxt]=useState(card.content);
  const [hov,setHov]=useState(false);
  const badge=SB[card.source]||SB.user;
  const hlC={none:"transparent",user:"#f59e0b",ai:"#3b82f6",both:"#22c55e"};
  const bdr=hlC[card.highlightedBy]||"transparent";
  const save=()=>{onEdit(card.id,txt);setEditing(false);};
  const hasLinks=card.sourceCardIds&&card.sourceCardIds.length>0;
  return(
    <div id={"card-"+card.id} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:"#0f172a",border:"1px solid "+(bdr!=="transparent"?bdr:"#1e293b"),borderRadius:8,padding:"8px 10px",marginBottom:5,borderLeft:bdr!=="transparent"?"3px solid "+bdr:undefined,transition:"all 0.15s"}}>
      {card.speaker&&<div style={{marginBottom:3}}><span style={{fontSize:10,fontWeight:700,color:spkC?.[card.speaker]||"#64748b",background:(spkC?.[card.speaker]||"#64748b")+"18",padding:"1px 6px",borderRadius:8}}>{card.speaker}</span></div>}
      {editing?(
        <div>
          <textarea value={txt} onChange={e=>setTxt(e.target.value)} style={{width:"100%",background:"#1e293b",color:"#e2e8f0",border:"1px solid #334155",borderRadius:6,padding:6,fontSize:12,resize:"vertical",minHeight:50,fontFamily:"inherit",boxSizing:"border-box"}}
            autoFocus onKeyDown={e=>{if(e.key==="Enter"&&e.metaKey)save();if(e.key==="Escape")setEditing(false);}}/>
          <div style={{display:"flex",gap:4,marginTop:3}}>
            <button onClick={save} style={{fontSize:10,background:"#4f46e5",color:"#fff",border:"none",borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>Save</button>
            <button onClick={()=>setEditing(false)} style={{fontSize:10,background:"#334155",color:"#94a3b8",border:"none",borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
      ):<div style={{fontSize:12,color:"#e2e8f0",lineHeight:1.5,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{card.content}</div>}
      {hasLinks&&(
        <div style={{marginTop:4,display:"flex",flexWrap:"wrap",gap:3}}>
          {card.sourceCardIds.map((src,i)=>(
            <button key={i} onClick={e=>{e.stopPropagation();onNavigate&&onNavigate(src.id);}}
              style={{fontSize:9,background:src.color||"#1e293b",color:"#fff",border:"none",borderRadius:5,padding:"2px 7px",cursor:"pointer",display:"flex",alignItems:"center",gap:3,opacity:0.85}}>
              <span>{src.icon||"📌"}</span>
              <span style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{src.label||"Source"}</span>
              <span style={{opacity:0.6}}>→</span>
            </button>
          ))}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4,flexWrap:"wrap"}}>
        <span style={{fontSize:8,background:badge.bg,color:"#fff",padding:"1px 5px",borderRadius:7,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>{badge.l}</span>
        {card.sourceAgentName&&<span style={{fontSize:9,color:"#0891b2"}}>{card.sourceAgentName}</span>}
        {card.timestamp!==undefined&&card.timestamp!==null&&<span style={{fontSize:9,color:"#475569"}}>{"⏱"+fmtT(card.timestamp)}</span>}
        <span style={{fontSize:9,color:"#475569"}}>{new Date(card.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
      </div>
      {hov&&!editing&&(
        <div style={{display:"flex",gap:2,marginTop:4,flexWrap:"wrap"}}>
          {[{i:"📋",l:"Copy",fn:()=>navigator.clipboard?.writeText(card.content)},
            {i:"✏️",l:"Edit",fn:()=>{setTxt(card.content);setEditing(true);}},
            {i:"⭐",l:card.highlightedBy==="user"||card.highlightedBy==="both"?"Unhl":"Hl",fn:()=>onHl(card.id)},
            ...(colType!=="trash"?[{i:"🗑️",l:"Del",fn:()=>onDel(card.id)}]:[]),
          ].map((a,i)=>(
            <button key={i} onClick={e=>{e.stopPropagation();a.fn();}}
              style={{fontSize:9,background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:4,padding:"1px 5px",cursor:"pointer"}}>{a.i+" "+a.l}</button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Inquiry Column ──
const InquiryCol = ({column,cards,allCards,dispatch,spkC,onNavigate}) => {
  const [query,setQuery]=useState("");
  const [scope,setScope]=useState("all");
  const [loading,setLoading]=useState(false);
  const scrollRef=useRef(null);
  const iCards=cards.sort((a,b)=>(a.sortOrder||"").localeCompare(b.sortOrder||""));

  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:"smooth"});},[cards.length]);

  const ask = async () => {
    if(!query.trim()||loading) return;
    const q=query.trim(); setQuery(""); setLoading(true);
    // Add user question card
    const last=iCards[iCards.length-1];
    dispatch({type:"ADD_CARD",p:{id:uid(),columnId:column.id,sessionId:column.sessionId,content:"❓ "+q,source:"user",aiTags:[],userTags:[],highlightedBy:"none",isDeleted:0,createdAt:now(),updatedAt:now(),sortOrder:last?mid(last.sortOrder):"n"}});

    // RAG: find relevant cards
    const searchable = allCards.filter(c=>!c.isDeleted&&c.columnId!==column.id);
    const relevant = findSimilar(q, searchable, 8);
    const context = relevant.map(r=>{
      const prefix = r.card.speaker ? r.card.speaker+": " : (r.card.sourceAgentName ? "["+r.card.sourceAgentName+"] " : "");
      return prefix + r.card.content;
    }).join("\n\n");

    const sys = "You are an AI research assistant analyzing a meeting/session. Answer the user's question based on the provided context. Be specific, reference details from the context. If the context doesn't contain enough info, say so. Be concise but thorough.";
    const msg = "Context from the session:\n\n" + (context||"(No relevant context found)") + "\n\n---\nQuestion: " + q;

    const result = await askClaude(sys, msg);
    setLoading(false);
    if(!result) return;
    const last2 = [...iCards].pop();
    dispatch({type:"ADD_CARD",p:{id:uid(),columnId:column.id,sessionId:column.sessionId,content:result,source:"inquiry",sourceAgentName:"Inquiry AI",promptUsed:"Scope: "+scope+"\nRelevant cards: "+relevant.length+"\n\nContext:\n"+context.slice(0,500),aiTags:[],userTags:[],highlightedBy:"none",isDeleted:0,createdAt:now(),updatedAt:now(),sortOrder:last2?mid(last2.sortOrder):"n"}});
  };

  return(
    <div style={{width:340,minWidth:340,background:"#0f172a",borderRight:"1px solid #1e293b",display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"8px 10px 6px",borderBottom:"1px solid #1e293b",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:14}}>🔮</span>
          <span style={{fontSize:12,fontWeight:600,color:"#e2e8f0"}}>Inquiry</span>
          <span style={{fontSize:10,color:"#475569",background:"#1e293b",borderRadius:8,padding:"0 5px"}}>{cards.length}</span>
          {loading&&<span style={{fontSize:10,color:"#06b6d4",animation:"pulse 1s infinite"}}>● thinking</span>}
        </div>
        <div style={{display:"flex",gap:3,marginTop:5}}>
          {["all","transcript","agents"].map(s=>(
            <button key={s} onClick={()=>setScope(s)} style={{fontSize:9,padding:"2px 7px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:500,background:scope===s?"#06b6d4":"#1e293b",color:scope===s?"#fff":"#64748b",textTransform:"capitalize"}}>{s}</button>
          ))}
        </div>
      </div>
      <div ref={scrollRef} style={{flex:1,overflow:"auto",padding:"6px 8px",scrollbarWidth:"thin",scrollbarColor:"#334155 transparent"}}>
        {iCards.map(card=>(
          <CardC key={card.id} card={card} colType="inquiry" spkC={spkC}
            onDel={id=>dispatch({type:"DELETE_CARD",p:id})} onHl={id=>dispatch({type:"TOGGLE_HL",p:id})}
            onEdit={(id,c)=>dispatch({type:"UPDATE_CARD",p:{id,u:{content:c}}})}/>
        ))}
        {cards.length===0&&!loading&&<div style={{textAlign:"center",padding:"20px",color:"#334155",fontSize:12}}>Ask questions about your session.<br/>AI uses embeddings to find relevant context.</div>}
      </div>
      <div style={{padding:"6px 8px",borderTop:"1px solid #1e293b",flexShrink:0}}>
        <div style={{display:"flex",gap:4}}>
          <textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ask about this session..." rows={2}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask();}}}
            style={{flex:1,background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"6px 8px",fontSize:12,color:"#e2e8f0",resize:"none",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          <button onClick={ask} disabled={loading||!query.trim()}
            style={{background:loading?"#334155":"#06b6d4",color:"#fff",border:"none",borderRadius:6,padding:"0 10px",cursor:loading?"wait":"pointer",fontSize:12,fontWeight:700,flexShrink:0}}>
            {loading?"...":"Ask"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Agent Queue Column ──
const AgentQueueCol = ({column,tasks,agentBusy,dispatch,onRetryTask}) => {
  const recent = tasks.slice(-50).reverse();
  const running = Object.entries(agentBusy||{}).filter(([k,v])=>v).map(([k])=>k);
  const [expanded,setExpanded]=useState({});
  const [editingPrompt,setEditingPrompt]=useState(null);
  const [editedPrompt,setEditedPrompt]=useState("");

  const toggle=(id)=>setExpanded(p=>({...p,[id]:!p[id]}));
  const startEdit=(t)=>{setEditingPrompt(t.id);setEditedPrompt(t.prompt||"");};

  return(
    <div style={{width:340,minWidth:340,background:"#0f172a",borderRight:"1px solid #1e293b",display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"8px 10px 6px",borderBottom:"1px solid #1e293b",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:14}}>⚡</span>
          <span style={{fontSize:12,fontWeight:600,color:"#e2e8f0"}}>Agent Queue</span>
          <span style={{fontSize:10,color:"#475569",background:"#1e293b",borderRadius:8,padding:"0 5px"}}>{tasks.length}</span>
          {running.length>0&&<span style={{fontSize:10,color:"#eab308",animation:"pulse 1s infinite"}}>● {running.length} active</span>}
        </div>
        {tasks.length>0&&(
          <div style={{display:"flex",gap:8,marginTop:5,fontSize:10,color:"#64748b"}}>
            <span style={{color:"#22c55e"}}>✓ {tasks.filter(t=>t.status==="completed").length}</span>
            <span style={{color:"#ef4444"}}>✗ {tasks.filter(t=>t.status==="failed").length}</span>
            <span style={{color:"#eab308"}}>⏳ {running.length}</span>
          </div>
        )}
      </div>
      <div style={{flex:1,overflow:"auto",padding:"6px 8px",scrollbarWidth:"thin",scrollbarColor:"#334155 transparent"}}>
        {running.length>0&&(
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:"#eab308",fontWeight:600,marginBottom:4}}>RUNNING</div>
            {running.map(k=>{const ag=AGENTS.find(a=>a.key===k);return(
              <div key={k} style={{background:"#1e293b",borderRadius:6,padding:"6px 8px",marginBottom:4,borderLeft:"3px solid #eab308"}}>
                <div style={{fontSize:11,color:"#e2e8f0",fontWeight:600}}>{ag?.name||k}</div>
                <div style={{fontSize:10,color:"#eab308",marginTop:2,display:"flex",alignItems:"center",gap:4}}>
                  <span style={{display:"inline-block",width:10,height:10,border:"2px solid #eab308",borderTop:"2px solid transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                  Processing...
                </div>
              </div>
            );})}
          </div>
        )}
        {recent.length>0?(
          <div>
            <div style={{fontSize:10,color:"#64748b",fontWeight:600,marginBottom:4}}>HISTORY</div>
            {recent.map(t=>{
              const isExp=expanded[t.id];
              const isFail=t.status==="failed";
              const isEditing=editingPrompt===t.id;
              return(
                <div key={t.id} style={{background:"#0f172a",border:"1px solid "+(isFail?"#7f1d1d":"#1e293b"),borderRadius:6,marginBottom:5,borderLeft:"3px solid "+(t.status==="completed"?"#22c55e":isFail?"#ef4444":"#64748b"),overflow:"hidden"}}>
                  <div style={{padding:"6px 8px",cursor:"pointer"}} onClick={()=>toggle(t.id)}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontSize:11,color:"#e2e8f0",fontWeight:500}}>{t.agentName}</span>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:9,color:t.status==="completed"?"#22c55e":isFail?"#ef4444":"#64748b",fontWeight:600,textTransform:"uppercase"}}>{t.status}</span>
                        <span style={{fontSize:10,color:"#475569",transition:"transform 0.2s",transform:isExp?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
                      </div>
                    </div>
                    <div style={{fontSize:10,color:"#475569",marginTop:2}}>
                      {t.status==="completed"&&<span style={{color:"#22c55e"}}>{t.cardsCreated||0} cards created • </span>}
                      {isFail&&<span style={{color:"#ef4444"}}>Error • </span>}
                      {new Date(t.completedAt||t.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
                      {t.duration&&<span> • {t.duration}ms</span>}
                    </div>
                  </div>

                  {isExp&&(
                    <div style={{borderTop:"1px solid #1e293b",padding:"8px",background:"#0a0f1a"}}>
                      {isFail&&t.error&&(
                        <div style={{marginBottom:8}}>
                          <div style={{fontSize:10,color:"#ef4444",fontWeight:600,marginBottom:3}}>Error Details</div>
                          <div style={{fontSize:11,color:"#fca5a5",background:"#7f1d1d20",borderRadius:6,padding:"6px 8px",fontFamily:"monospace",whiteSpace:"pre-wrap",wordBreak:"break-word",border:"1px solid #7f1d1d40",lineHeight:1.4}}>{t.error}</div>
                        </div>
                      )}

                      {t.inputText&&(
                        <div style={{marginBottom:8}}>
                          <div style={{fontSize:10,color:"#64748b",fontWeight:600,marginBottom:3}}>Input Text</div>
                          <div style={{fontSize:11,color:"#94a3b8",background:"#1e293b",borderRadius:6,padding:"6px 8px",maxHeight:80,overflow:"auto",whiteSpace:"pre-wrap",wordBreak:"break-word",lineHeight:1.4}}>{t.inputText.length>300?t.inputText.slice(0,300)+"...":t.inputText}</div>
                        </div>
                      )}

                      {t.prompt&&(
                        <div style={{marginBottom:8}}>
                          <div style={{fontSize:10,color:"#64748b",fontWeight:600,marginBottom:3}}>Prompt</div>
                          <div style={{fontSize:11,color:"#94a3b8",background:"#1e293b",borderRadius:6,padding:"6px 8px",maxHeight:80,overflow:"auto",fontFamily:"monospace",whiteSpace:"pre-wrap",wordBreak:"break-word",lineHeight:1.4}}>{t.prompt.length>400?t.prompt.slice(0,400)+"...":t.prompt}</div>
                        </div>
                      )}

                      {t.status==="completed"&&t.resultPreview&&(
                        <div style={{marginBottom:8}}>
                          <div style={{fontSize:10,color:"#64748b",fontWeight:600,marginBottom:3}}>Result</div>
                          <div style={{fontSize:11,color:"#94a3b8",background:"#1e293b",borderRadius:6,padding:"6px 8px",maxHeight:80,overflow:"auto",whiteSpace:"pre-wrap",lineHeight:1.4}}>{t.resultPreview}</div>
                        </div>
                      )}

                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {isFail&&(
                          <button onClick={(e)=>{e.stopPropagation();onRetryTask(t);}}
                            style={{fontSize:10,background:"#4f46e520",color:"#a5b4fc",border:"1px solid #4f46e540",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:3}}>
                            ↻ Retry
                          </button>
                        )}
                        {isFail&&t.prompt&&(
                          <button onClick={(e)=>{e.stopPropagation();startEdit(t);}}
                            style={{fontSize:10,background:"#06b6d420",color:"#67e8f9",border:"1px solid #06b6d440",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:3}}>
                            ✏️ Edit & Retry
                          </button>
                        )}
                        <button onClick={(e)=>{e.stopPropagation();navigator.clipboard?.writeText(JSON.stringify(t,null,2));}}
                          style={{fontSize:10,background:"#1e293b",color:"#64748b",border:"1px solid #334155",borderRadius:5,padding:"4px 10px",cursor:"pointer"}}>
                          📋 Copy
                        </button>
                      </div>

                      {isEditing&&(
                        <div style={{marginTop:8,borderTop:"1px solid #1e293b",paddingTop:8}}>
                          <div style={{fontSize:10,color:"#06b6d4",fontWeight:600,marginBottom:4}}>Edit Prompt</div>
                          <textarea value={editedPrompt} onChange={e=>setEditedPrompt(e.target.value)}
                            style={{width:"100%",background:"#1e293b",color:"#e2e8f0",border:"1px solid #334155",borderRadius:6,padding:"6px 8px",fontSize:11,resize:"vertical",minHeight:80,fontFamily:"monospace",boxSizing:"border-box",outline:"none",lineHeight:1.4}}/>
                          <div style={{display:"flex",gap:4,marginTop:4}}>
                            <button onClick={()=>{onRetryTask({...t,prompt:editedPrompt,editedPrompt:true});setEditingPrompt(null);}}
                              style={{fontSize:10,background:"#06b6d4",color:"#fff",border:"none",borderRadius:5,padding:"4px 12px",cursor:"pointer",fontWeight:600}}>Run with edited prompt</button>
                            <button onClick={()=>setEditingPrompt(null)}
                              style={{fontSize:10,background:"#334155",color:"#94a3b8",border:"none",borderRadius:5,padding:"4px 10px",cursor:"pointer"}}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ):<div style={{textAlign:"center",padding:"20px",color:"#334155",fontSize:12}}>Agent tasks will appear here as they run.</div>}
      </div>
      <style>{`@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}`}</style>
    </div>
  );
};

// ── Transcript Input ──
const TranscriptInput = ({columnId,sessionId,dispatch,cards,speakers}) => {
  const [text,setText]=useState("");
  const [speaker,setSpeaker]=useState("");
  const [customSpeaker,setCustomSpeaker]=useState("");
  const [showAddSpeaker,setShowAddSpeaker]=useState(false);
  const inputRef=useRef(null);

  // Derive known speakers from existing cards
  const knownSpeakers=useMemo(()=>{
    const s=new Set(speakers||[]);
    cards.forEach(c=>{if(c.speaker)s.add(c.speaker);});
    return [...s];
  },[cards,speakers]);

  const addSegment=()=>{
    if(!text.trim()) return;
    const last=cards[cards.length-1];
    dispatch({type:"ADD_CARD",p:{id:uid(),columnId,sessionId,content:text.trim(),source:"transcription",speaker:speaker||null,timestamp:null,aiTags:[],userTags:[],highlightedBy:"none",isDeleted:0,createdAt:now(),updatedAt:now(),sortOrder:last?mid(last.sortOrder):"n"}});
    setText("");
    inputRef.current?.focus();
  };

  const addSpeaker=()=>{
    if(!customSpeaker.trim()) return;
    setSpeaker(customSpeaker.trim());
    setCustomSpeaker("");
    setShowAddSpeaker(false);
  };

  return(
    <div style={{padding:"6px 8px",borderTop:"1px solid #1e293b",flexShrink:0}}>
      <div style={{display:"flex",gap:3,marginBottom:4,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:9,color:"#64748b"}}>Speaker:</span>
        <button onClick={()=>setSpeaker("")}
          style={{fontSize:9,padding:"2px 6px",borderRadius:6,border:!speaker?"1px solid #6366f1":"1px solid #334155",background:!speaker?"#6366f120":"transparent",color:!speaker?"#a5b4fc":"#64748b",cursor:"pointer"}}>None</button>
        {knownSpeakers.map((s,i)=>(
          <button key={s} onClick={()=>setSpeaker(s)}
            style={{fontSize:9,padding:"2px 6px",borderRadius:6,border:speaker===s?"1px solid "+(SC[i%SC.length]):"1px solid #334155",background:speaker===s?(SC[i%SC.length])+"20":"transparent",color:speaker===s?SC[i%SC.length]:"#64748b",cursor:"pointer"}}>{s}</button>
        ))}
        {showAddSpeaker?(
          <div style={{display:"flex",gap:2,alignItems:"center"}}>
            <input value={customSpeaker} onChange={e=>setCustomSpeaker(e.target.value)} placeholder="Name" autoFocus
              onKeyDown={e=>{if(e.key==="Enter")addSpeaker();if(e.key==="Escape")setShowAddSpeaker(false);}}
              style={{width:70,background:"#1e293b",border:"1px solid #334155",borderRadius:4,padding:"2px 5px",fontSize:9,color:"#e2e8f0",outline:"none"}}/>
            <button onClick={addSpeaker} style={{fontSize:9,background:"#22c55e",color:"#fff",border:"none",borderRadius:4,padding:"2px 5px",cursor:"pointer"}}>✓</button>
            <button onClick={()=>setShowAddSpeaker(false)} style={{fontSize:9,background:"none",color:"#64748b",border:"none",cursor:"pointer"}}>✕</button>
          </div>
        ):(
          <button onClick={()=>setShowAddSpeaker(true)} style={{fontSize:9,padding:"2px 5px",borderRadius:4,border:"1px dashed #334155",background:"transparent",color:"#475569",cursor:"pointer"}}>+</button>
        )}
      </div>
      <div style={{display:"flex",gap:3}}>
        <textarea ref={inputRef} value={text} onChange={e=>setText(e.target.value)}
          placeholder={speaker?"What did "+speaker+" say?":"Type what was said... (Enter to add)"}
          rows={2}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();addSegment();}}}
          style={{flex:1,background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"5px 7px",fontSize:12,color:"#e2e8f0",resize:"none",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        <button onClick={addSegment} disabled={!text.trim()}
          style={{background:text.trim()?"#ef4444":"#334155",color:"#fff",border:"none",borderRadius:6,padding:"0 10px",cursor:text.trim()?"pointer":"default",fontSize:11,fontWeight:700,flexShrink:0,alignSelf:"stretch"}}>
          Add
        </button>
      </div>
      <div style={{fontSize:9,color:"#475569",marginTop:3}}>Enter to add segment • Shift+Enter for new line • Agents auto-analyse every few segments</div>
    </div>
  );
};

// ── Generic Column ──
const Col = ({column,cards,dispatch,onDrop,audio,onTogRec,onPauseRec,simRunning,agentBusy,spkC,speakers,onNavigate}) => {
  const [input,setInput]=useState("");
  const [search,setSearch]=useState("");
  const [hlF,setHlF]=useState("all");
  const scrollRef=useRef(null);
  const meta=COL_TYPES.find(c=>c.type===column.type)||COL_TYPES[0];
  const prevLen=useRef(cards.length);
  const isBusy=agentBusy?.[column.type];

  useEffect(()=>{
    if(cards.length>prevLen.current)scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:"smooth"});
    prevLen.current=cards.length;
  },[cards.length]);

  let filtered=cards;
  if(search){const q=search.toLowerCase();filtered=filtered.filter(c=>c.content.toLowerCase().includes(q)||c.speaker?.toLowerCase().includes(q));}
  if(column.type==="highlights"){
    if(hlF==="user")filtered=filtered.filter(c=>c.highlightedBy==="user"||c.highlightedBy==="both");
    else if(hlF==="ai")filtered=filtered.filter(c=>c.highlightedBy==="ai"||c.highlightedBy==="both");
  }

  const addCard=()=>{
    if(!input.trim())return;
    const last=cards[cards.length-1];
    dispatch({type:"ADD_CARD",p:{id:uid(),columnId:column.id,sessionId:column.sessionId,content:input.trim(),source:"user",aiTags:[],userTags:[],highlightedBy:"none",isDeleted:0,createdAt:now(),updatedAt:now(),sortOrder:last?mid(last.sortOrder):"n"}});
    setInput("");
  };

  if(column.collapsed){
    return(
      <div style={{width:44,minWidth:44,background:"#0f172a",borderRight:"1px solid #1e293b",display:"flex",flexDirection:"column",alignItems:"center",paddingTop:10,cursor:"pointer"}}
        onClick={()=>dispatch({type:"TOG_COLL",p:column.id})}>
        <span style={{fontSize:14}}>{meta.icon}</span>
        <span style={{writingMode:"vertical-rl",fontSize:10,color:"#64748b",marginTop:6,letterSpacing:1}}>{column.title}</span>
        <span style={{fontSize:9,color:"#475569",marginTop:3,background:"#1e293b",borderRadius:7,padding:"1px 4px"}}>{cards.length}</span>
      </div>
    );
  }

  return(
    <div style={{width:340,minWidth:340,background:"#0f172a",borderRight:"1px solid #1e293b",display:"flex",flexDirection:"column",height:"100%"}}
      onDragOver={e=>{e.preventDefault();e.currentTarget.style.background="#1a1f35";}}
      onDragLeave={e=>{e.currentTarget.style.background="#0f172a";}}
      onDrop={e=>{e.preventDefault();e.currentTarget.style.background="#0f172a";const cid=e.dataTransfer.getData("text/plain");if(cid)onDrop(column.id,cid);}}>
      <div style={{padding:"8px 10px 4px",borderBottom:"1px solid #1e293b",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:14}}>{meta.icon}</span>
            <span style={{fontSize:12,fontWeight:600,color:"#e2e8f0"}}>{column.title}</span>
            <span style={{fontSize:10,color:"#475569",background:"#1e293b",borderRadius:8,padding:"0 5px"}}>{cards.length}</span>
            {isBusy&&<span style={{fontSize:10,color:"#0891b2",animation:"pulse 1s infinite"}}>●</span>}
          </div>
          <div style={{display:"flex",gap:2}}>
            {column.type==="trash"&&cards.length>0&&<button onClick={()=>{if(confirm("Empty trash?"))dispatch({type:"EMPTY_TRASH"});}} style={{fontSize:9,background:"#7f1d1d",color:"#fca5a5",border:"none",borderRadius:4,padding:"2px 6px",cursor:"pointer"}}>Empty</button>}
            <button onClick={()=>dispatch({type:"TOG_COLL",p:column.id})} style={{fontSize:11,background:"none",color:"#475569",border:"none",cursor:"pointer"}}>◀</button>
          </div>
        </div>

        {column.type==="transcript"&&(
          <div style={{padding:"5px 0 2px"}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <button onClick={onTogRec}
                style={{width:30,height:30,borderRadius:"50%",border:(audio?.recording||simRunning)?"2px solid #ef4444":"2px solid #334155",background:(audio?.recording||simRunning)?"#7f1d1d":"#1e293b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",flexShrink:0}}>
                {(audio?.recording||simRunning)&&!audio?.paused&&<div style={{position:"absolute",inset:-4,borderRadius:"50%",border:"2px solid #ef4444",opacity:0.4,animation:"pulse 1.5s ease-in-out infinite"}}/>}
                <div style={{width:(audio?.recording||simRunning)?9:11,height:(audio?.recording||simRunning)?9:11,borderRadius:(audio?.recording||simRunning)?2:"50%",background:(audio?.recording||simRunning)?"#ef4444":"#64748b"}}/>
              </button>
              {audio?.recording&&<button onClick={onPauseRec} style={{fontSize:14,background:"#1e293b",border:"1px solid #334155",borderRadius:6,width:26,height:26,cursor:"pointer",color:"#94a3b8",display:"flex",alignItems:"center",justifyContent:"center"}}>{audio?.paused?"▶":"⏸"}</button>}
              <div style={{flex:1}}><AudioViz active={(audio?.recording||simRunning)&&!audio?.paused} level={audio?.level||0}/></div>
              {(audio?.recording||simRunning)&&<span style={{fontSize:10,color:"#ef4444",fontFamily:"monospace",fontWeight:600}}>{fmtT(audio?.elapsed||0)}</span>}
            </div>
            {(audio?.recording||simRunning)&&(
              <div style={{display:"flex",alignItems:"center",gap:3,marginTop:3}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:audio?.paused?"#f59e0b":"#ef4444",animation:audio?.paused?"none":"pulse 1.5s ease-in-out infinite"}}/>
                <span style={{fontSize:9,color:audio?.paused?"#f59e0b":"#ef4444",fontWeight:600}}>{audio?.paused?"PAUSED":simRunning?"SIMULATING":"LIVE"}</span>
              </div>
            )}
          </div>
        )}

        {cards.length>5&&<input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:"100%",marginTop:3,background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"3px 7px",fontSize:11,color:"#e2e8f0",outline:"none",boxSizing:"border-box"}}/>}
        {column.type==="highlights"&&(
          <div style={{display:"flex",gap:3,marginTop:4}}>
            {["all","user","ai"].map(f=>(
              <button key={f} onClick={()=>setHlF(f)} style={{fontSize:9,padding:"2px 7px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:500,background:hlF===f?(f==="user"?"#f59e0b":f==="ai"?"#3b82f6":"#6366f1"):"#1e293b",color:hlF===f?"#fff":"#64748b"}}>{f==="all"?"All":f==="user"?"⭐ User":"🤖 AI"}</button>
            ))}
          </div>
        )}
      </div>
      <div ref={scrollRef} style={{flex:1,overflow:"auto",padding:"6px 8px",scrollbarWidth:"thin",scrollbarColor:"#334155 transparent"}}>
        {filtered.sort((a,b)=>(a.sortOrder||"").localeCompare(b.sortOrder||"")).map(card=>(
          <div key={card.id} draggable onDragStart={e=>e.dataTransfer.setData("text/plain",card.id)}>
            <CardC card={card} colType={column.type} spkC={spkC} onNavigate={onNavigate}
              onDel={id=>dispatch({type:"DELETE_CARD",p:id})} onHl={id=>dispatch({type:"TOGGLE_HL",p:id})}
              onEdit={(id,c)=>dispatch({type:"UPDATE_CARD",p:{id,u:{content:c}}})}/>
          </div>
        ))}
        {filtered.length===0&&<div style={{textAlign:"center",padding:"16px",color:"#334155",fontSize:11}}>{column.type==="transcript"?"Type transcript segments below.\nTag speakers and press Enter.\nAgents will auto-analyse your input.":"Cards will appear here"}</div>}
      </div>
      {column.type!=="trash"&&column.type!=="transcript"&&(
        <div style={{padding:"5px 8px",borderTop:"1px solid #1e293b",flexShrink:0}}>
          <div style={{display:"flex",gap:3}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder={"Add to "+column.title+"..."} rows={1}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();addCard();}}}
              style={{flex:1,background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"5px 7px",fontSize:11,color:"#e2e8f0",resize:"none",fontFamily:"inherit",outline:"none",minHeight:26,boxSizing:"border-box"}}/>
            <button onClick={addCard} style={{background:"#4f46e5",color:"#fff",border:"none",borderRadius:6,padding:"0 9px",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0}}>+</button>
          </div>
        </div>
      )}
      {column.type==="transcript"&&(
        <TranscriptInput columnId={column.id} sessionId={column.sessionId} dispatch={dispatch} cards={cards} speakers={speakers}/>
      )}
    </div>
  );
};

// ── Export Formats ──
const exportSessionMarkdown = (state) => {
  if(!state?.session) return;
  let md = "# " + state.session.title + "\n\n";
  md += "**Mode:** " + state.session.mode + " | **Created:** " + new Date(state.session.createdAt).toLocaleString() + "\n\n---\n\n";
  const visCols = (state.columns||[]).filter(c=>c.visible&&c.type!=="trash"&&c.type!=="agent_queue").sort((a,b)=>(a.sortOrder||"").localeCompare(b.sortOrder||""));
  for (const col of visCols) {
    const meta = COL_TYPES.find(ct=>ct.type===col.type)||{};
    const colCards = (state.cards||[]).filter(c=>c.columnId===col.id&&!c.isDeleted).sort((a,b)=>(a.sortOrder||"").localeCompare(b.sortOrder||""));
    if(colCards.length===0) continue;
    md += "## " + (meta.icon||"") + " " + col.title + " (" + colCards.length + ")\n\n";
    for (const card of colCards) {
      const prefix = card.speaker ? "**" + card.speaker + ":** " : "";
      const agent = card.sourceAgentName ? " _(" + card.sourceAgentName + ")_" : "";
      md += "- " + prefix + card.content + agent + "\n";
    }
    md += "\n";
  }
  const blob = new Blob([md], {type:"text/markdown"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (state.session.title||"session").replace(/[^a-zA-Z0-9]/g,"_").slice(0,40);
  a.href = url; a.download = "wall_" + safeName + ".md"; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

const exportSessionCSV = (state) => {
  if(!state?.session) return;
  const rows = [["Column","Speaker","Source","Agent","Content","Highlighted","Created"]];
  const visCols = (state.columns||[]).sort((a,b)=>(a.sortOrder||"").localeCompare(b.sortOrder||""));
  for (const col of visCols) {
    const colCards = (state.cards||[]).filter(c=>c.columnId===col.id&&!c.isDeleted).sort((a,b)=>(a.sortOrder||"").localeCompare(b.sortOrder||""));
    for (const card of colCards) {
      const esc = (s) => '"' + (s||"").replace(/"/g,'""') + '"';
      rows.push([esc(col.title),esc(card.speaker),esc(card.source),esc(card.sourceAgentName),esc(card.content),card.highlightedBy||"none",card.createdAt||""]);
    }
  }
  const csv = rows.map(r=>r.join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (state.session.title||"session").replace(/[^a-zA-Z0-9]/g,"_").slice(0,40);
  a.href = url; a.download = "wall_" + safeName + ".csv"; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

// ── Export Menu ──
const ExportMenu = ({state,onClose}) => {
  if(!state?.session) return null;
  const cardCount = (state.cards||[]).filter(c=>!c.isDeleted).length;
  const opts = [
    {icon:"💾",label:"Save as JSON (full data, re-importable)",desc:"Complete session data including all cards, columns, agent tasks, and metadata. Can be imported back.",fn:()=>{exportSessionToFile(state);onClose();}},
    {icon:"📝",label:"Export as Markdown",desc:"Human-readable document with all columns and cards.",fn:()=>{exportSessionMarkdown(state);onClose();}},
    {icon:"📊",label:"Export as CSV",desc:"Spreadsheet-compatible tabular format.",fn:()=>{exportSessionCSV(state);onClose();}},
    {icon:"📋",label:"Copy all to clipboard",desc:"Plain text of all cards, grouped by column.",fn:()=>{
      let txt="";
      const visCols=(state.columns||[]).filter(c=>c.visible&&c.type!=="trash").sort((a,b)=>(a.sortOrder||"").localeCompare(b.sortOrder||""));
      for(const col of visCols){
        const cards=(state.cards||[]).filter(c=>c.columnId===col.id&&!c.isDeleted).sort((a,b)=>(a.sortOrder||"").localeCompare(b.sortOrder||""));
        if(!cards.length) continue;
        txt+="=== "+col.title+" ===\n";
        for(const card of cards) txt+=(card.speaker?card.speaker+": ":"")+card.content+"\n";
        txt+="\n";
      }
      navigator.clipboard?.writeText(txt);
      onClose();
    }},
  ];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={onClose}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:20,width:420,maxWidth:"90vw"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{color:"#e2e8f0",margin:0,fontSize:15}}>Export Session</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",fontSize:16,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{fontSize:11,color:"#64748b",marginBottom:12}}>{state.session.title} • {cardCount} cards</div>
        {opts.map((o,i)=>(
          <button key={i} onClick={o.fn}
            style={{width:"100%",textAlign:"left",padding:"10px 12px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,marginBottom:6,cursor:"pointer",display:"block"}}>
            <div style={{fontSize:13,color:"#e2e8f0",fontWeight:600}}>{o.icon} {o.label}</div>
            <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── File Export/Import ──
const downloadJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

const exportSessionToFile = (state) => {
  if(!state?.session) return;
  const data = {
    _format: "the-wall-session",
    _version: 1,
    _exportedAt: now(),
    session: state.session,
    columns: state.columns,
    cards: state.cards,
    speakerColors: state.speakerColors || {},
    agentTasks: state.agentTasks || [],
  };
  const safeName = (state.session.title || "session").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
  downloadJSON(data, "wall_" + safeName + "_" + new Date().toISOString().slice(0,10) + ".json");
};

const exportAllSessionsToFile = async () => {
  const idx = await loadIndex();
  const sessions = [];
  for (const entry of idx) {
    const data = await loadSession(entry.id);
    if (data) sessions.push({
      _format: "the-wall-session", _version: 1,
      session: data.session, columns: data.columns, cards: data.cards,
      speakerColors: data.speakerColors || {},
    });
  }
  downloadJSON({
    _format: "the-wall-backup", _version: 1,
    _exportedAt: now(), _count: sessions.length,
    sessions,
  }, "wall_backup_" + new Date().toISOString().slice(0,10) + ".json");
};

const readFileAsJSON = () => {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) { reject("No file"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try { resolve(JSON.parse(ev.target.result)); }
        catch(err) { reject("Invalid JSON: " + err.message); }
      };
      reader.onerror = () => reject("File read error");
      reader.readAsText(file);
    };
    input.click();
  });
};

const importSessionFromFile = async (onDone) => {
  try {
    const data = await readFileAsJSON();
    if (data._format === "the-wall-backup" && data.sessions) {
      // Bulk import
      let count = 0;
      for (const s of data.sessions) {
        if (s.session?.id) {
          const storeData = { session: s.session, columns: s.columns, cards: s.cards, speakerColors: s.speakerColors || {} };
          await window.storage.set(SKEY + s.session.id, JSON.stringify(storeData));
          let idx = [];
          try { const r = await window.storage.get(IKEY); if(r?.value) idx = JSON.parse(r.value); } catch(e){}
          const entry = { id: s.session.id, title: s.session.title, mode: s.session.mode, updatedAt: s.session.updatedAt || now(), cardCount: (s.cards||[]).filter(c=>!c.isDeleted).length };
          idx = [entry, ...idx.filter(x=>x.id!==s.session.id)].slice(0,50);
          await window.storage.set(IKEY, JSON.stringify(idx));
          count++;
        }
      }
      alert("Imported " + count + " sessions from backup.");
    } else if (data._format === "the-wall-session" && data.session?.id) {
      // Single session
      const storeData = { session: data.session, columns: data.columns, cards: data.cards, speakerColors: data.speakerColors || {} };
      await window.storage.set(SKEY + data.session.id, JSON.stringify(storeData));
      let idx = [];
      try { const r = await window.storage.get(IKEY); if(r?.value) idx = JSON.parse(r.value); } catch(e){}
      const entry = { id: data.session.id, title: data.session.title, mode: data.session.mode, updatedAt: now(), cardCount: (data.cards||[]).filter(c=>!c.isDeleted).length };
      idx = [entry, ...idx.filter(x=>x.id!==data.session.id)].slice(0,50);
      await window.storage.set(IKEY, JSON.stringify(idx));
      alert("Imported session: " + data.session.title);
    } else {
      alert("Unrecognized file format. Expected a Wall session or backup file.");
    }
    if (onDone) onDone();
  } catch(e) {
    if (e !== "No file") alert("Import failed: " + e);
  }
};

// ── Session Launcher ──
const Launcher = ({onStart,onSimulate,sessions,onOpen,onDelete,onRefresh}) => {
  const [tab,setTab]=useState(sessions.length>0?"recent":"new");
  const [title,setTitle]=useState("");
  const [simCtx,setSimCtx]=useState("Q3 product roadmap review. The team needs to decide between investing in developer experience or a new real-time collaboration feature.");
  const [simParts,setSimParts]=useState([
    {name:"Alex",role:"VP Engineering — facilitator"},
    {name:"Jordan",role:"Lead Analyst — data-driven"},
    {name:"Sam",role:"Head of Support — customer advocate"},
    {name:"Morgan",role:"CFO — revenue focused"},
  ]);
  const [simTurns,setSimTurns]=useState(20);

  return(
    <div style={{width:"100%",height:"100vh",background:"#020617",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}}>
      <div style={{width:580,maxHeight:"90vh",overflow:"auto",scrollbarWidth:"thin",scrollbarColor:"#334155 transparent"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,fontWeight:800,letterSpacing:-2,background:"linear-gradient(135deg,#6366f1,#ec4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:6}}>THE WALL</div>
          <div style={{color:"#64748b",fontSize:13}}>AI-powered intelligence surface for meetings, research & thinking</div>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:16,justifyContent:"center"}}>
          {[...(sessions.length>0?[{k:"recent",l:"Recent Sessions",i:"📂"}]:[]),{k:"new",l:"New Session",i:"📝"},{k:"sim",l:"Simulate Meeting",i:"🎭"}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              style={{padding:"7px 16px",borderRadius:8,border:tab===t.k?"2px solid #6366f1":"1px solid #1e293b",background:tab===t.k?"#1e1b4b":"#0f172a",color:tab===t.k?"#a5b4fc":"#64748b",cursor:"pointer",fontSize:12,fontWeight:600}}>{t.i+" "+t.l}</button>
          ))}
        </div>
        <div style={{background:"#0f172a",borderRadius:12,border:"1px solid #1e293b",padding:20}}>
          {tab==="recent"&&(
            <div>
              <div style={{display:"flex",gap:4,marginBottom:10}}>
                <button onClick={()=>importSessionFromFile(onRefresh)}
                  style={{flex:1,fontSize:11,padding:"7px 10px",borderRadius:6,border:"1px solid #334155",background:"#1e293b",color:"#a5b4fc",cursor:"pointer",fontWeight:600}}>📂 Import from File</button>
                {sessions.length>0&&<button onClick={exportAllSessionsToFile}
                  style={{flex:1,fontSize:11,padding:"7px 10px",borderRadius:6,border:"1px solid #334155",background:"#1e293b",color:"#22c55e",cursor:"pointer",fontWeight:600}}>💾 Export All Backup</button>}
              </div>
              {sessions.map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"#1e293b",borderRadius:8,marginBottom:6,cursor:"pointer"}}
                  onClick={()=>onOpen(s.id)}>
                  <div>
                    <div style={{fontSize:13,color:"#e2e8f0",fontWeight:600}}>{s.title}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{s.cardCount||0} cards • {s.mode} • {new Date(s.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={async(e)=>{e.stopPropagation();const data=await loadSession(s.id);if(data){exportSessionToFile({...data,agentTasks:[]});}}} style={{fontSize:11,background:"#334155",color:"#22c55e",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer"}} title="Save to disk">💾</button>
                    <button onClick={e=>{e.stopPropagation();onOpen(s.id);}} style={{fontSize:11,background:"#4f46e5",color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer"}}>Open</button>
                    <button onClick={e=>{e.stopPropagation();if(confirm("Delete session?"))onDelete(s.id);}} style={{fontSize:11,background:"#334155",color:"#94a3b8",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer"}}>✕</button>
                  </div>
                </div>
              ))}
              {sessions.length===0&&<div style={{textAlign:"center",color:"#475569",padding:16,fontSize:13}}>No saved sessions yet.</div>}
            </div>
          )}
          {tab==="new"&&(
            <div>
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:5}}>Session Title</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Product Strategy Meeting"
                style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#e2e8f0",outline:"none",boxSizing:"border-box",marginBottom:14}}/>
              <p style={{fontSize:12,color:"#64748b",lineHeight:1.6,marginBottom:16}}>Start an empty session. Type notes or record audio. AI agents analyse content in real-time across columns.</p>
              <button onClick={()=>onStart(title||"New Session")} style={{width:"100%",padding:"11px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#6366f1,#4f46e5)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>Start Session →</button>
            </div>
          )}
          {tab==="sim"&&(
            <div>
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:5}}>Meeting Context</label>
              <textarea value={simCtx} onChange={e=>setSimCtx(e.target.value)} rows={3}
                style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"9px 12px",fontSize:12,color:"#e2e8f0",outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box",marginBottom:10}}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <label style={{fontSize:12,color:"#94a3b8"}}>Participants</label>
                <button onClick={()=>setSimParts([...simParts,{name:"",role:""}])} style={{fontSize:10,background:"#1e293b",color:"#6366f1",border:"1px solid #334155",borderRadius:4,padding:"2px 7px",cursor:"pointer"}}>+ Add</button>
              </div>
              {simParts.map((p,i)=>(
                <div key={i} style={{display:"flex",gap:5,marginBottom:5,alignItems:"center"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:SC[i%SC.length],flexShrink:0}}/>
                  <input value={p.name} onChange={e=>{const n=[...simParts];n[i]={...n[i],name:e.target.value};setSimParts(n);}} placeholder="Name"
                    style={{width:90,background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"5px 7px",fontSize:11,color:"#e2e8f0",outline:"none"}}/>
                  <input value={p.role} onChange={e=>{const n=[...simParts];n[i]={...n[i],role:e.target.value};setSimParts(n);}} placeholder="Role"
                    style={{flex:1,background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"5px 7px",fontSize:11,color:"#e2e8f0",outline:"none"}}/>
                  {simParts.length>2&&<button onClick={()=>setSimParts(simParts.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:12}}>✕</button>}
                </div>
              ))}
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginTop:10,marginBottom:4}}>Turns: {simTurns}</label>
              <input type="range" min={5} max={40} value={simTurns} onChange={e=>setSimTurns(+e.target.value)} style={{width:"100%",accentColor:"#6366f1",marginBottom:12}}/>
              <button onClick={()=>onSimulate({context:simCtx,participants:simParts.filter(p=>p.name),turns:simTurns})}
                disabled={!simCtx.trim()||simParts.filter(p=>p.name).length<2}
                style={{width:"100%",padding:"11px",borderRadius:8,border:"none",background:simCtx.trim()?"linear-gradient(135deg,#ec4899,#6366f1)":"#334155",color:"#fff",fontSize:14,fontWeight:700,cursor:simCtx.trim()?"pointer":"not-allowed"}}>
                🎭 Start Simulated Meeting →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Settings ──
const Settings = ({open,onClose,state,dispatch}) => {
  if(!open) return null;
  const [tab,setTab]=useState("columns");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"flex-end",zIndex:100}} onClick={onClose}>
      <div style={{width:380,background:"#0f172a",borderLeft:"1px solid #1e293b",height:"100%",overflow:"auto",padding:18}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h2 style={{color:"#e2e8f0",margin:0,fontSize:15}}>Settings</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",fontSize:16,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"flex",gap:3,marginBottom:14}}>
          {["columns","agents"].map(t=><button key={t} onClick={()=>setTab(t)} style={{padding:"3px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:500,textTransform:"capitalize",background:tab===t?"#4f46e5":"#1e293b",color:tab===t?"#fff":"#64748b"}}>{t}</button>)}
        </div>
        {tab==="columns"&&(state.columns||[]).map(col=>{
          const m=COL_TYPES.find(c=>c.type===col.type)||{};
          return(
            <div key={col.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #1e293b"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><span>{m.icon}</span><span style={{color:"#e2e8f0",fontSize:12}}>{col.title}</span></div>
              <button onClick={()=>dispatch({type:"TOG_VIS",p:col.id})} style={{width:36,height:19,borderRadius:10,border:"none",cursor:"pointer",background:col.visible?"#4f46e5":"#334155",position:"relative"}}>
                <div style={{width:13,height:13,borderRadius:7,background:"#fff",position:"absolute",top:3,left:col.visible?20:3,transition:"left 0.2s"}}/>
              </button>
            </div>
          );
        })}
        {tab==="agents"&&[...AGENTS,{key:"ideas",col:"ideas",name:"Idea Generator"}].map(a=>(
          <div key={a.key} style={{padding:"8px 0",borderBottom:"1px solid #1e293b"}}>
            <span style={{color:"#e2e8f0",fontSize:12,fontWeight:600}}>{a.name}</span>
            <span style={{fontSize:10,color:"#64748b",marginLeft:6}}>→ {a.col}</span>
            {a.key==="ideas"&&<div style={{fontSize:10,color:"#475569",marginTop:2}}>Runs as a second pass after other agents, generating actionable ideas from their findings</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main App ──
export default function TheWall() {
  const [state,dispatch]=useReducer(reducer,{view:"launcher",agentTasks:[],agentBusy:{},cards:[],columns:[]});
  const [selCards,setSelCards]=useState(new Set());
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [editTitle,setEditTitle]=useState(false);
  const [simRunning,setSimRunning]=useState(false);
  const [sessions,setSessions]=useState([]);
  const [exportOpen,setExportOpen]=useState(false);
  const cardsRef=useRef([]);
  const simAbort=useRef(false);
  const timerStart=useRef(null);
  const timerIv=useRef(null);
  const saveTimer=useRef(null);
  const recordingRef=useRef(false);

  const [saveStatus,setSaveStatus]=useState("idle"); // idle, saving, saved, error

  useEffect(()=>{cardsRef.current=state.cards||[];},[state.cards]);

  // Load sessions index on mount and whenever we return to launcher
  useEffect(()=>{
    if(state.view==="launcher") loadIndex().then(setSessions);
  },[state.view]);

  // Auto-save debounced
  useEffect(()=>{
    if(!state.session?.id||state.view!=="session") return;
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      setSaveStatus("saving");
      saveSession(state).then(ok=>{
        setSaveStatus(ok?"saved":"error");
        if(ok) loadIndex().then(setSessions);
      });
    },2000);
    return ()=>clearTimeout(saveTimer.current);
  },[state.cards,state.session?.title,state.session?.mode,state.columns,state.view]);

  // Also save immediately on every new card
  const prevCardLen=useRef(0);
  useEffect(()=>{
    const len=(state.cards||[]).length;
    if(state.session?.id&&len>prevCardLen.current&&len>0){
      setSaveStatus("saving");
      saveSession(state).then(ok=>setSaveStatus(ok?"saved":"error"));
    }
    prevCardLen.current=len;
  },[state.cards?.length]);

  // ── Agent Processing ──
  const runAgents = useCallback(async (text,sessionId,columns) => {
    if(!text?.trim()) return;
    const ideasCol=columns.find(c=>c.type==="ideas");
    const newAgentCards=[];

    // Find the transcript cards that match this batch text so we can link back
    const tcol=columns.find(c=>c.type==="transcript");
    const tMeta=COL_TYPES.find(ct=>ct.type==="transcript")||{};
    const allTranscript=tcol?cardsRef.current.filter(c=>c.columnId===tcol.id&&!c.isDeleted):[];
    const batchLines=text.split("\n").filter(l=>l.trim());
    const sourceTranscriptCards=allTranscript.filter(tc=>{
      return batchLines.some(line=>{
        const clean=line.replace(/^[^:]+:\s*/,"");
        return tc.content===clean||tc.content.includes(clean)||clean.includes(tc.content);
      });
    }).slice(-6);
    const transcriptLinks=sourceTranscriptCards.map(tc=>({
      id:tc.id,
      label:(tc.speaker?tc.speaker+": ":"")+tc.content.slice(0,50),
      icon:tMeta.icon||"🎙️",
      color:(tMeta.color||"#ef4444")+"80"
    }));

    const tasks=AGENTS.map(async agent=>{
      const col=columns.find(c=>c.type===agent.col);
      if(!col) return;
      const taskId=uid();
      const promptText=agent.prompt(text);
      const startedAt=Date.now();
      dispatch({type:"SET_BUSY",p:{k:agent.col,v:true}});
      dispatch({type:"ADD_TASK",p:{id:taskId,agentName:agent.name,agentKey:agent.key,status:"running",createdAt:now(),cardsCreated:0,inputText:text,prompt:promptText,systemPrompt:agent.sys}});
      try{
        const result=await askClaude(agent.sys,promptText);
        const duration=Date.now()-startedAt;
        if(!result){dispatch({type:"UPD_TASK",p:{id:taskId,u:{status:"failed",error:"No response from Claude API. This usually means the API is unreachable or returned an empty response. Check network connectivity.",completedAt:now(),duration}}});return;}
        const bullets=result.split("\n").map(l=>l.replace(/^[•\-\*]\s*/,"").trim()).filter(l=>l.length>5);
        let created=0;
        for(const b of bullets){
          const existing=cardsRef.current.filter(c=>c.columnId===col.id);
          const last=existing[existing.length-1];
          const cardId=uid();
          // Find best matching transcript card(s) for this specific bullet
          let bulletLinks=[...transcriptLinks];
          if(sourceTranscriptCards.length>1){
            const best=findSimilar(b,sourceTranscriptCards,2);
            if(best.length>0){
              bulletLinks=best.map(r=>({
                id:r.card.id,
                label:(r.card.speaker?r.card.speaker+": ":"")+r.card.content.slice(0,50),
                icon:tMeta.icon||"🎙️",
                color:(tMeta.color||"#ef4444")+"80"
              }));
            }
          }
          const card={id:cardId,columnId:col.id,sessionId,content:b,source:"agent",sourceAgentName:agent.name,sourceCardIds:bulletLinks,aiTags:[],userTags:[],highlightedBy:"none",isDeleted:0,createdAt:now(),updatedAt:now(),sortOrder:last?mid(last.sortOrder):"n"};
          dispatch({type:"ADD_CARD",p:card});
          newAgentCards.push({...card,colType:agent.col,colTitle:col.title,colIcon:COL_TYPES.find(ct=>ct.type===agent.col)?.icon||"📌",colColor:COL_TYPES.find(ct=>ct.type===agent.col)?.color||"#64748b"});
          created++;
        }
        dispatch({type:"UPD_TASK",p:{id:taskId,u:{status:"completed",cardsCreated:created,completedAt:now(),duration,resultPreview:result.slice(0,500)}}});
      }catch(e){
        const duration=Date.now()-startedAt;
        const errMsg=e?.message||String(e);
        dispatch({type:"UPD_TASK",p:{id:taskId,u:{status:"failed",error:errMsg,completedAt:now(),duration}}});
      }
      dispatch({type:"SET_BUSY",p:{k:agent.col,v:false}});
    });
    await Promise.allSettled(tasks);

    // ── Ideas Agent (second pass) ──
    if(!ideasCol||newAgentCards.length===0) return;
    // Group source cards by type for a richer prompt
    const gapCards=newAgentCards.filter(c=>c.colType==="gaps");
    const questionCards=newAgentCards.filter(c=>c.colType==="questions");
    const claimCards=newAgentCards.filter(c=>c.colType==="claims");
    const actionCards=newAgentCards.filter(c=>c.colType==="actions");
    const conceptCards=newAgentCards.filter(c=>c.colType==="concepts");

    const sections=[];
    if(gapCards.length) sections.push("GAPS & RISKS (suggest how to address each):\n"+gapCards.map(c=>"- "+c.content).join("\n"));
    if(questionCards.length) sections.push("QUESTIONS (suggest possible answers or approaches):\n"+questionCards.map(c=>"- "+c.content).join("\n"));
    if(claimCards.length) sections.push("CLAIMS (suggest how to verify or build on each):\n"+claimCards.map(c=>"- "+c.content).join("\n"));
    if(actionCards.length) sections.push("ACTION ITEMS (suggest better or additional approaches):\n"+actionCards.map(c=>"- "+c.content).join("\n"));
    if(conceptCards.length) sections.push("KEY CONCEPTS (suggest applications or explorations):\n"+conceptCards.map(c=>"- "+c.content).join("\n"));
    if(sections.length===0) return;

    const ideasTaskId=uid();
    const ideasSys="You are a creative problem-solver and idea generator. Given analysis from a meeting, generate actionable ideas. For each idea, start the line with the NUMBER of the source item it addresses (from the numbered list below), then a pipe |, then the idea. Format: NUMBER|idea text. One idea per line. Be specific and actionable. Generate 2-5 ideas total.";

    // Number the source cards for reference
    let numberedItems=[];
    let itemIdx=1;
    const allSourceCards=[...gapCards,...questionCards,...claimCards,...actionCards,...conceptCards];
    const numberedList=allSourceCards.map(c=>{const n=itemIdx++;numberedItems.push({num:n,card:c});return n+". ["+c.colType.toUpperCase()+"] "+c.content;}).join("\n");

    const ideasPrompt="Here are findings from a meeting analysis. Generate ideas to address them.\n\n"+numberedList;

    dispatch({type:"SET_BUSY",p:{k:"ideas",v:true}});
    dispatch({type:"ADD_TASK",p:{id:ideasTaskId,agentName:"Idea Generator",agentKey:"ideas",status:"running",createdAt:now(),cardsCreated:0,inputText:numberedList,prompt:ideasPrompt,systemPrompt:ideasSys}});

    try{
      const result=await askClaude(ideasSys,ideasPrompt);
      if(!result){dispatch({type:"UPD_TASK",p:{id:ideasTaskId,u:{status:"failed",error:"No response",completedAt:now()}}});dispatch({type:"SET_BUSY",p:{k:"ideas",v:false}});return;}
      const lines=result.split("\n").map(l=>l.replace(/^[•\-\*]\s*/,"").trim()).filter(l=>l.length>5);
      let created=0;
      for(const line of lines){
        // Parse NUMBER|idea format
        const pipeIdx=line.indexOf("|");
        let sourceNum=null;
        let ideaText=line;
        if(pipeIdx>0&&pipeIdx<5){
          const numStr=line.slice(0,pipeIdx).replace(/[^0-9]/g,"");
          sourceNum=parseInt(numStr,10);
          ideaText=line.slice(pipeIdx+1).trim();
        }
        if(!ideaText||ideaText.length<5) continue;

        // Build source card links
        const sourceLinks=[];
        if(sourceNum&&numberedItems.length>0){
          const src=numberedItems.find(ni=>ni.num===sourceNum);
          if(src){
            sourceLinks.push({id:src.card.id,label:src.card.content.slice(0,50),icon:src.card.colIcon,color:src.card.colColor+"80"});
          }
        }
        // Fallback: if no number parsed, try to find best match
        if(sourceLinks.length===0&&allSourceCards.length>0){
          const best=findSimilar(ideaText,allSourceCards,1);
          if(best.length>0&&best[0].score>0.1){
            const src=best[0].card;
            sourceLinks.push({id:src.id,label:src.content.slice(0,50),icon:src.colIcon,color:src.colColor+"80"});
          }
        }

        const existing=cardsRef.current.filter(c=>c.columnId===ideasCol.id);
        const last=existing[existing.length-1];
        dispatch({type:"ADD_CARD",p:{id:uid(),columnId:ideasCol.id,sessionId,content:ideaText,source:"agent",sourceAgentName:"Idea Generator",sourceCardIds:sourceLinks,aiTags:[],userTags:[],highlightedBy:"none",isDeleted:0,createdAt:now(),updatedAt:now(),sortOrder:last?mid(last.sortOrder):"n"}});
        created++;
      }
      dispatch({type:"UPD_TASK",p:{id:ideasTaskId,u:{status:"completed",cardsCreated:created,completedAt:now(),resultPreview:result.slice(0,500)}}});
    }catch(e){
      dispatch({type:"UPD_TASK",p:{id:ideasTaskId,u:{status:"failed",error:e?.message||String(e),completedAt:now()}}});
    }
    dispatch({type:"SET_BUSY",p:{k:"ideas",v:false}});
  },[]);

  // ── Watch transcript for agent triggers ──
  const transcriptBuf=useRef([]);
  const agentTmr=useRef(null);
  const scheduleAgents=useCallback((text)=>{
    if(!state.session?.id||!state.columns) return;
    transcriptBuf.current.push(text);
    clearTimeout(agentTmr.current);
    agentTmr.current=setTimeout(()=>{
      const batch=transcriptBuf.current.join("\n");
      transcriptBuf.current=[];
      if(batch.trim()) runAgents(batch,state.session.id,state.columns);
    },4000);
  },[state.session?.id,state.columns,runAgents]);

  const lastTC=useRef(0);
  useEffect(()=>{
    if(!state.columns||simRunning) return;
    const tcol=state.columns.find(c=>c.type==="transcript");
    if(!tcol) return;
    const tCards=(state.cards||[]).filter(c=>c.columnId===tcol.id&&!c.isDeleted);
    if(tCards.length>lastTC.current){
      tCards.slice(lastTC.current).forEach(c=>scheduleAgents(c.content));
    }
    lastTC.current=tCards.length;
  },[state.cards?.length,state.columns,simRunning,scheduleAgents]);

  // ── Speech Recognition ──
  const recognitionRef=useRef(null);
  const interimRef=useRef("");
  const analyserRef=useRef(null);
  const audioCtxRef=useRef(null);
  const animFrameRef=useRef(null);

  const addTranscriptCard=useCallback((text,speaker)=>{
    if(!text?.trim()||!state.session?.id) return;
    const tcol=(state.columns||[]).find(c=>c.type==="transcript");
    if(!tcol) return;
    const existing=cardsRef.current.filter(c=>c.columnId===tcol.id);
    const last=existing[existing.length-1];
    dispatch({type:"ADD_CARD",p:{id:uid(),columnId:tcol.id,sessionId:state.session.id,content:text.trim(),source:"transcription",speaker:speaker||"You",timestamp:Date.now()-(timerStart.current||Date.now()),aiTags:[],userTags:[],highlightedBy:"none",isDeleted:0,createdAt:now(),updatedAt:now(),sortOrder:last?mid(last.sortOrder):"n"}});
  },[state.session?.id,state.columns]);

  const startAudioLevel=useCallback(async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      audioCtxRef.current=new(window.AudioContext||window.webkitAudioContext)();
      const source=audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current=audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize=256;
      source.connect(analyserRef.current);
      const data=new Uint8Array(analyserRef.current.frequencyBinCount);
      const tick=()=>{
        if(!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg=data.reduce((s,v)=>s+v,0)/data.length/255;
        dispatch({type:"SET_AUDIO",p:{level:avg*2.5,elapsed:Date.now()-(timerStart.current||Date.now())}});
        animFrameRef.current=requestAnimationFrame(tick);
      };
      tick();
      return stream;
    }catch(e){
      console.warn("Mic access denied, using simulated levels");
      timerIv.current=setInterval(()=>{dispatch({type:"SET_AUDIO",p:{level:0.3+Math.random()*0.5,elapsed:Date.now()-(timerStart.current||Date.now())}});},100);
      return null;
    }
  },[]);

  const stopAudioLevel=useCallback(()=>{
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerIv.current);
    if(audioCtxRef.current){try{audioCtxRef.current.close();}catch(e){}}
    audioCtxRef.current=null;analyserRef.current=null;
  },[]);

  const toggleRecord=useCallback(()=>{
    if(simRunning){simAbort.current=true;setSimRunning(false);clearInterval(timerIv.current);stopAudioLevel();dispatch({type:"SET_AUDIO",p:{recording:false,paused:false,level:0}});recordingRef.current=false;return;}
    if(state.audio?.recording){
      // Stop
      recordingRef.current=false;
      if(recognitionRef.current){try{recognitionRef.current.stop();}catch(e){}}
      recognitionRef.current=null;
      stopAudioLevel();
      dispatch({type:"SET_AUDIO",p:{recording:false,paused:false,level:0}});
    } else {
      // Start
      timerStart.current=Date.now();
      recordingRef.current=true;
      dispatch({type:"SET_AUDIO",p:{recording:true,paused:false}});
      startAudioLevel();

      const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SpeechRecognition){
        console.warn("SpeechRecognition not supported — use type-to-transcribe");
        return;
      }
      const recog=new SpeechRecognition();
      recog.continuous=true;
      recog.interimResults=true;
      recog.lang="en-US";
      recog.maxAlternatives=1;

      recog.onresult=(event)=>{
        let finalText="";
        let interimText="";
        for(let i=event.resultIndex;i<event.results.length;i++){
          const transcript=event.results[i][0].transcript;
          if(event.results[i].isFinal){
            finalText+=transcript;
          } else {
            interimText+=transcript;
          }
        }
        if(finalText.trim()){
          addTranscriptCard(finalText);
        }
        interimRef.current=interimText;
      };

      recog.onerror=(event)=>{
        console.warn("Speech recognition error:",event.error);
        if(event.error==="not-allowed"||event.error==="service-not-allowed"){
          // Mic blocked — keep recording visual active for type-to-transcribe mode
          recognitionRef.current=null;
          // Start simulated audio levels for visual feedback
          clearInterval(timerIv.current);
          timerIv.current=setInterval(()=>{dispatch({type:"SET_AUDIO",p:{level:0.05+Math.random()*0.1,elapsed:Date.now()-(timerStart.current||Date.now())}});},200);
        }
        if(event.error==="no-speech"||event.error==="network"){
          // Auto-restart on transient errors
          try{recog.start();}catch(e){}
        }
      };

      recog.onend=()=>{
        // Auto-restart if still recording (browser stops after silence)
        if(recognitionRef.current&&recordingRef.current){
          try{recog.start();}catch(e){}
        }
      };

      try{recog.start();}catch(e){console.error("Failed to start recognition:",e);}
      recognitionRef.current=recog;
    }
  },[simRunning,state.audio?.recording,addTranscriptCard,startAudioLevel,stopAudioLevel]);

  const pauseRecord=useCallback(()=>{
    if(state.audio?.paused){
      // Resume
      if(recognitionRef.current){try{recognitionRef.current.start();}catch(e){}}
      startAudioLevel();
      dispatch({type:"SET_AUDIO",p:{paused:false}});
    } else {
      // Pause
      if(recognitionRef.current){try{recognitionRef.current.stop();}catch(e){}}
      stopAudioLevel();
      dispatch({type:"SET_AUDIO",p:{paused:true,level:0}});
    }
  },[state.audio,startAudioLevel,stopAudioLevel]);

  // Cleanup on unmount
  useEffect(()=>()=>{
    if(recognitionRef.current){try{recognitionRef.current.stop();}catch(e){}}
    stopAudioLevel();
  },[stopAudioLevel]);

  // Must be before conditional return to respect hooks rules
  const knownSpeakers=useMemo(()=>{
    const s=new Set(Object.keys(state.speakerColors||{}));
    (state.cards||[]).forEach(c=>{if(c.speaker)s.add(c.speaker);});
    return [...s];
  },[state.cards,state.speakerColors]);

  // ── Session actions ──
  const startSession=(title)=>{dispatch({type:"INIT",p:mkSession(title)});};

  const openSession=async(id)=>{
    const data=await loadSession(id);
    if(!data){alert("Could not load session. It may have been deleted.");return;}
    const restored={...data,agentBusy:{},agentTasks:[],view:"session"};
    if(!restored.audio) restored.audio={recording:false,paused:false,level:0,elapsed:0,autoScroll:true};
    else restored.audio={...restored.audio,recording:false,paused:false,level:0};
    dispatch({type:"INIT",p:restored});
    if(data.speakerColors) dispatch({type:"SET_COLORS",p:data.speakerColors});
  };

  const delSession=async(id)=>{
    await deleteSession(id);
    const updated=await loadIndex();
    setSessions(updated);
  };

  const startSim=async(config)=>{
    const s=mkSession("🎭 "+config.context.slice(0,40)+"...","silent");
    const colors={};
    config.participants.forEach((p,i)=>{colors[p.name]=SC[i%SC.length];});
    s.speakerColors=colors;
    dispatch({type:"INIT",p:s});
    dispatch({type:"SET_COLORS",p:colors});
    setSimRunning(true);
    simAbort.current=false;
    timerStart.current=Date.now();
    timerIv.current=setInterval(()=>{dispatch({type:"SET_AUDIO",p:{level:0.3+Math.random()*0.7,elapsed:Date.now()-timerStart.current}});},100);

    const partDesc=config.participants.map(function(p){return p.name+" ("+p.role+")";}).join(", ");
    const genSys="You are a meeting dialogue generator. Generate realistic meeting dialogue. Each line must be formatted exactly as: SPEAKER_NAME: dialogue text. One speaker per line. No stage directions. Make it natural.";
    const genPrompt="Generate "+config.turns+" turns of a meeting.\n\nContext: "+config.context+"\n\nParticipants:\n"+partDesc+"\n\nGenerate the full conversation now, one line per turn in format NAME: text";

    const result=await askClaude(genSys,genPrompt);
    if(!result||simAbort.current){setSimRunning(false);clearInterval(timerIv.current);return;}

    const lines=result.split("\n").filter(l=>l.includes(":")&&l.trim().length>5);
    const tcol=s.columns.find(c=>c.type==="transcript");
    if(!tcol){setSimRunning(false);clearInterval(timerIv.current);return;}

    let batch=[];
    for(let i=0;i<lines.length;i++){
      if(simAbort.current) break;
      const ci=lines[i].indexOf(":");
      const speaker=lines[i].slice(0,ci).trim().replace(/^\*+|\*+$/g,"");
      const text=lines[i].slice(ci+1).trim();
      if(!text) continue;
      const existing=cardsRef.current.filter(c=>c.columnId===tcol.id);
      const last=existing[existing.length-1];
      dispatch({type:"ADD_CARD",p:{id:uid(),columnId:tcol.id,sessionId:s.session.id,content:text,source:"transcription",speaker,timestamp:Date.now()-timerStart.current,aiTags:[],userTags:[],highlightedBy:"none",isDeleted:0,createdAt:now(),updatedAt:now(),sortOrder:last?mid(last.sortOrder):"n"}});
      batch.push(speaker+": "+text);
      if(batch.length>=3||i===lines.length-1){
        const bt=batch.join("\n"); batch=[];
        runAgents(bt,s.session.id,s.columns);
      }
      await new Promise(r=>setTimeout(r,1200+Math.random()*1200));
    }
    setSimRunning(false);clearInterval(timerIv.current);
    dispatch({type:"SET_AUDIO",p:{level:0,elapsed:Date.now()-timerStart.current}});
  };

  // ── Navigate to source card ──
  const navigateToCard=useCallback((cardId)=>{
    const card=(state.cards||[]).find(c=>c.id===cardId);
    if(!card) return;
    // Make sure the column is visible and not collapsed
    const col=(state.columns||[]).find(c=>c.id===card.columnId);
    if(col&&!col.visible) dispatch({type:"TOG_VIS",p:col.id});
    if(col&&col.collapsed) dispatch({type:"TOG_COLL",p:col.id});
    // Scroll to card after a tick
    setTimeout(()=>{
      const el=document.getElementById("card-"+cardId);
      if(el){
        el.scrollIntoView({behavior:"smooth",block:"center"});
        el.style.outline="2px solid #a855f7";
        el.style.outlineOffset="2px";
        setTimeout(()=>{el.style.outline="none";el.style.outlineOffset="0";},2000);
      }
    },100);
  },[state.cards,state.columns]);

  // ── Retry failed agent task ──
  const retryTask = useCallback(async (task) => {
    if(!state.session?.id||!state.columns) return;
    const agent=AGENTS.find(a=>a.key===task.agentKey);
    const col=state.columns.find(c=>c.type===(agent?.col||task.agentKey));
    if(!col) return;

    const taskId=uid();
    const promptText=task.editedPrompt?task.prompt:(agent?agent.prompt(task.inputText||""):task.prompt);
    const sysPrompt=task.systemPrompt||(agent?.sys||"You are a helpful assistant.");
    const startedAt=Date.now();

    dispatch({type:"SET_BUSY",p:{k:col.type,v:true}});
    dispatch({type:"ADD_TASK",p:{id:taskId,agentName:task.agentName+(task.editedPrompt?" (edited)":"")+" ↻",agentKey:task.agentKey,status:"running",createdAt:now(),cardsCreated:0,inputText:task.inputText,prompt:promptText,systemPrompt:sysPrompt}});

    try{
      const result=await askClaude(sysPrompt,promptText);
      const duration=Date.now()-startedAt;
      if(!result){dispatch({type:"UPD_TASK",p:{id:taskId,u:{status:"failed",error:"No response from Claude API on retry.",completedAt:now(),duration}}});dispatch({type:"SET_BUSY",p:{k:col.type,v:false}});return;}
      const bullets=result.split("\n").map(l=>l.replace(/^[•\-\*]\s*/,"").trim()).filter(l=>l.length>5);
      let created=0;
      for(const b of bullets){
        const existing=cardsRef.current.filter(c=>c.columnId===col.id);
        const last=existing[existing.length-1];
        dispatch({type:"ADD_CARD",p:{id:uid(),columnId:col.id,sessionId:state.session.id,content:b,source:"agent",sourceAgentName:task.agentName+" ↻",aiTags:[],userTags:[],highlightedBy:"none",isDeleted:0,createdAt:now(),updatedAt:now(),sortOrder:last?mid(last.sortOrder):"n"}});
        created++;
      }
      dispatch({type:"UPD_TASK",p:{id:taskId,u:{status:"completed",cardsCreated:created,completedAt:now(),duration,resultPreview:result.slice(0,500)}}});
    }catch(e){
      dispatch({type:"UPD_TASK",p:{id:taskId,u:{status:"failed",error:e?.message||String(e),completedAt:now(),duration:Date.now()-startedAt}}});
    }
    dispatch({type:"SET_BUSY",p:{k:col.type,v:false}});
  },[state.session?.id,state.columns]);

  const onDrop=useCallback((colId,cardId)=>{
    const t=(state.cards||[]).filter(c=>c.columnId===colId).sort((a,b)=>(a.sortOrder||"").localeCompare(b.sortOrder||""));
    dispatch({type:"MOVE_CARD",p:{cid:cardId,col:colId,so:mid(t.length?t[t.length-1].sortOrder:"m")}});
  },[state.cards]);

  // ── Render ──
  if(state.view==="launcher"||!state.session){
    return <Launcher onStart={startSession} onSimulate={startSim} sessions={sessions} onOpen={openSession} onDelete={delSession} onRefresh={()=>loadIndex().then(setSessions)}/>;
  }

  const hlCards=(state.cards||[]).filter(c=>c.highlightedBy!=="none"&&!c.isDeleted);
  const visCols=(state.columns||[]).filter(c=>c.visible).sort((a,b)=>(a.sortOrder||"").localeCompare(b.sortOrder||""));
  const agentCount=(state.cards||[]).filter(c=>c.source==="agent").length;
  const runningAgents=Object.values(state.agentBusy||{}).filter(v=>v).length;
  const queuedAgents=Math.max(0,(state.agentTasks||[]).filter(t=>t.status==="running").length - runningAgents);

  return(
    <div style={{width:"100%",height:"100vh",display:"flex",flexDirection:"column",background:"#020617",color:"#e2e8f0",fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",overflow:"hidden"}}>
      {/* Top Bar */}
      <div style={{height:42,minHeight:42,borderBottom:"1px solid #1e293b",display:"flex",alignItems:"center",padding:"0 12px",gap:8,background:"#0f172a",flexShrink:0}}>
        <button onClick={async()=>{simAbort.current=true;setSimRunning(false);clearInterval(timerIv.current);if(recognitionRef.current){try{recognitionRef.current.stop();}catch(e){}}stopAudioLevel();recordingRef.current=false;if(state.session?.id){setSaveStatus("saving");await saveSession(state);setSaveStatus("saved");}dispatch({type:"SET_VIEW",p:"launcher"});}} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
          <span style={{fontSize:15,fontWeight:800,letterSpacing:-1,background:"linear-gradient(135deg,#6366f1,#ec4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>THE WALL</span>
        </button>
        <div style={{width:1,height:18,background:"#1e293b"}}/>
        {editTitle?(
          <input value={state.session.title} onChange={e=>dispatch({type:"SET_TITLE",p:e.target.value})} onBlur={()=>setEditTitle(false)} onKeyDown={e=>e.key==="Enter"&&setEditTitle(false)}
            autoFocus style={{background:"#1e293b",border:"1px solid #334155",borderRadius:4,padding:"2px 7px",color:"#e2e8f0",fontSize:12,width:180,outline:"none"}}/>
        ):<span onClick={()=>setEditTitle(true)} style={{fontSize:12,fontWeight:500,cursor:"pointer",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{state.session.title}</span>}
        <div style={{display:"flex",gap:2}}>
          {["silent","active","sidekick"].map(m=>(
            <button key={m} onClick={()=>dispatch({type:"SET_MODE",p:m})} style={{fontSize:9,padding:"2px 7px",borderRadius:7,border:"none",cursor:"pointer",fontWeight:600,textTransform:"capitalize",background:state.session.mode===m?MC[m]:"#1e293b",color:state.session.mode===m?"#fff":"#64748b"}}>{m}</button>
          ))}
        </div>
        {simRunning&&(
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"2px 7px",background:"#7f1d1d20",borderRadius:6,border:"1px solid #7f1d1d50"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"#ef4444",animation:"pulse 1.5s ease-in-out infinite"}}/>
            <span style={{fontSize:9,color:"#fca5a5",fontFamily:"monospace"}}>SIM {fmtT(state.audio?.elapsed||0)}</span>
            <button onClick={()=>{simAbort.current=true;setSimRunning(false);clearInterval(timerIv.current);}} style={{fontSize:8,background:"#7f1d1d",color:"#fca5a5",border:"none",borderRadius:3,padding:"1px 5px",cursor:"pointer"}}>Stop</button>
          </div>
        )}
        {state.audio?.recording&&!simRunning&&(
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"2px 7px",background:"#7f1d1d20",borderRadius:6}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"#ef4444",animation:"pulse 1.5s ease-in-out infinite"}}/>
            <span style={{fontSize:9,color:"#fca5a5",fontFamily:"monospace"}}>REC {fmtT(state.audio?.elapsed||0)}</span>
          </div>
        )}
        {(agentCount>0||runningAgents>0||queuedAgents>0)&&(
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"2px 10px",background:"#0891b215",borderRadius:8,border:"1px solid #0891b230"}}>
            <span style={{fontSize:11}}>🤖</span>
            <span style={{fontSize:10,color:"#22d3ee",fontWeight:600}}>{agentCount}</span>
            <span style={{fontSize:9,color:"#475569"}}>insights</span>
            {runningAgents>0&&<>
              <div style={{width:1,height:12,background:"#1e293b"}}/>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#eab308",animation:"pulse 1s infinite"}}/>
              <span style={{fontSize:10,color:"#eab308",fontWeight:600}}>{runningAgents}</span>
              <span style={{fontSize:9,color:"#475569"}}>active</span>
            </>}
            {queuedAgents>0&&<>
              <div style={{width:1,height:12,background:"#1e293b"}}/>
              <span style={{fontSize:10,color:"#64748b",fontWeight:600}}>{queuedAgents}</span>
              <span style={{fontSize:9,color:"#475569"}}>queued</span>
            </>}
          </div>
        )}
        <div style={{flex:1}}/>
        <button onClick={()=>exportSessionToFile(state)}
          style={{fontSize:10,background:"#1e293b",color:"#22c55e",border:"1px solid #334155",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:600}} title="Quick save to disk">💾</button>
        <button onClick={()=>setExportOpen(true)}
          style={{fontSize:10,background:"#1e293b",color:"#a5b4fc",border:"1px solid #334155",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontWeight:600}} title="Export options">📤 Export</button>
        <span style={{fontSize:9,color:saveStatus==="saved"?"#22c55e":saveStatus==="saving"?"#f59e0b":saveStatus==="error"?"#ef4444":"#475569"}}>{saveStatus==="saved"?"● synced":saveStatus==="saving"?"● syncing...":saveStatus==="error"?"● sync error":"○ unsaved"}</span>
        <button onClick={()=>setSettingsOpen(true)} style={{fontSize:13,background:"none",border:"none",color:"#64748b",cursor:"pointer"}}>⚙️</button>
      </div>

      {/* Columns */}
      <div style={{flex:1,display:"flex",overflow:"auto",scrollbarWidth:"thin",scrollbarColor:"#334155 transparent"}}>
        {visCols.map(col=>{
          if(col.type==="inquiry"){
            return <InquiryCol key={col.id} column={col}
              cards={(state.cards||[]).filter(c=>c.columnId===col.id&&!c.isDeleted)}
              allCards={(state.cards||[]).filter(c=>!c.isDeleted)}
              dispatch={dispatch} spkC={state.speakerColors} onNavigate={navigateToCard}/>;
          }
          if(col.type==="agent_queue"){
            return <AgentQueueCol key={col.id} column={col} tasks={state.agentTasks||[]} agentBusy={state.agentBusy} dispatch={dispatch} onRetryTask={retryTask}/>;
          }
          const colCards=col.type==="highlights"?hlCards:(state.cards||[]).filter(c=>c.columnId===col.id&&(col.type==="trash"||!c.isDeleted));
          return <Col key={col.id} column={col} cards={colCards} dispatch={dispatch} onDrop={onDrop}
            audio={col.type==="transcript"?state.audio:null}
            onTogRec={col.type==="transcript"?toggleRecord:null}
            onPauseRec={col.type==="transcript"?pauseRecord:null}
            simRunning={col.type==="transcript"?simRunning:false}
            agentBusy={state.agentBusy} spkC={state.speakerColors} speakers={knownSpeakers} onNavigate={navigateToCard}/>;
        })}
      </div>

      {/* Status */}
      <div style={{height:22,minHeight:22,borderTop:"1px solid #1e293b",display:"flex",alignItems:"center",padding:"0 12px",gap:10,background:"#0f172a",fontSize:9,color:"#475569",flexShrink:0}}>
        <span>Mode: <span style={{color:MC[state.session.mode],fontWeight:600,textTransform:"capitalize"}}>{state.session.mode}</span></span>
        <span>Cards: {(state.cards||[]).filter(c=>!c.isDeleted).length}</span>
        {simRunning&&<span style={{color:"#ef4444"}}>● Simulating</span>}
        {runningAgents>0&&<span style={{color:"#0891b2"}}>● {runningAgents} agent{runningAgents>1?"s":""} working</span>}
        <div style={{flex:1}}/>
        <span>Phase 4 — Persistence + Embeddings</span>
      </div>

      <Settings open={settingsOpen} onClose={()=>setSettingsOpen(false)} state={state} dispatch={dispatch}/>
      {exportOpen&&<ExportMenu state={state} onClose={()=>setExportOpen(false)}/>}
      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:0.5;}50%{transform:scale(1.3);opacity:0;}}`}</style>
    </div>
  );
}
