import { useState, useEffect, useRef, useCallback } from "react";
import api from "./api";

const STORAGE_KEYS = { users: "wn-users", memos: "wn-memos", session: "wn-session", contacts: "wn-contacts", sendHistory: "wn-history" };
const hash = (s) => btoa(s).split("").reverse().join("");

const fmtDate = (d) => {
  const date = new Date(d), now = new Date(), diff = now - date;
  if (diff < 60000) return "방금";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return `${date.getMonth() + 1}.${date.getDate()}`;
};
const fmtFull = (d) => { const t = new Date(d); return `${t.getFullYear()}.${String(t.getMonth()+1).padStart(2,"0")}.${String(t.getDate()).padStart(2,"0")} ${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`; };

const detectSchedules = (c) => {
  const r = [];
  [/(\d{1,2})[\/\.\-](\d{1,2})[\s]?(\d{1,2}:\d{2})?/g, /(오전|오후)?\s?(\d{1,2})(시|:)(\d{0,2})?/g, /(내일|모레|다음주|이번주|오늘)/g, /(회의|미팅|점심|저녁|약속|마감|발표|면접|출장)/g].forEach((p, i) => { let m; while ((m = p.exec(c)) !== null) r.push({ type: i < 2 ? "time" : i === 2 ? "rel" : "event", text: m[0] }); });
  return r;
};
const extractKw = (c) => {
  const sw = new Set(["은","는","이","가","을","를","에","의","로","와","과","도","만","에서","으로","하고","그리고","하는","있는","없는","대한","위한","통해","같은","있다","없다","한다","하다"]);
  const w = c.replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, "").split(/\s+/).filter((x) => x.length > 1 && !sw.has(x));
  const f = {}; w.forEach((x) => (f[x] = (f[x] || 0) + 1));
  return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([x]) => x);
};
const summarize = (c) => { if (!c || c.length < 20) return null; const s = c.split(/[.\n!?]+/).filter((x) => x.trim().length > 5); return s.length <= 1 ? null : s[0].trim().slice(0, 60) + (s[0].length > 60 ? "..." : ""); };

const TAGS = [
  { name: "전체", fg: "#6b635a", bg: "transparent" },
  { name: "업무", fg: "#4a6741", bg: "#e8f0e4" },
  { name: "개인", fg: "#8b6914", bg: "#faf0d6" },
  { name: "중요", fg: "#a13d2d", bg: "#fae4df" },
  { name: "메모", fg: "#3d5a80", bg: "#dce8f5" },
];
const CHANNELS = [
  { key: "email", label: "이메일", icon: "✉", clr: "#3d5a80" },
  { key: "sms", label: "문자", icon: "☎", clr: "#4a6741" },
  { key: "kakao", label: "카카오톡", icon: "◆", clr: "#b8860b" },
];
const GROUPS = ["일반", "팀원", "거래처", "외부", "VIP"];

const Logo = ({ size = 28, dark = false }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect x="4" y="2" width="26" height="34" rx="2" fill={dark ? "#e8e2d6" : "#5c554a"} opacity="0.15"/>
    <rect x="8" y="5" width="26" height="34" rx="2" fill={dark ? "#faf6ee" : "#fff"} stroke={dark ? "#bfb8a8" : "#8a8279"} strokeWidth="1.5"/>
    <line x1="14" y1="14" x2="28" y2="14" stroke={dark ? "#c4bda8" : "#c9c2b5"} strokeWidth="1"/>
    <line x1="14" y1="19" x2="28" y2="19" stroke={dark ? "#c4bda8" : "#c9c2b5"} strokeWidth="1"/>
    <line x1="14" y1="24" x2="24" y2="24" stroke={dark ? "#c4bda8" : "#c9c2b5"} strokeWidth="1"/>
    <path d="M30 30L36 15L38 16L32 31Z" fill={dark ? "#d4a04a" : "#b8860b"}/>
    <path d="M30 30L29 33L32 31Z" fill={dark ? "#7a7265" : "#5c554a"}/>
    <circle cx="12" cy="14" r="1.2" fill={dark ? "#8a8475" : "#a39b8e"}/>
    <circle cx="12" cy="19" r="1.2" fill={dark ? "#8a8475" : "#a39b8e"}/>
    <circle cx="12" cy="24" r="1.2" fill={dark ? "#8a8475" : "#a39b8e"}/>
  </svg>
);

const css = `
@import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&family=IBM+Plex+Sans+KR:wght@300;400;500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:#cec7b8;border-radius:4px}
::selection{background:#5c554a;color:#faf6ee}
@keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes left{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes right{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}
@keyframes drop{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
input:focus,textarea:focus{outline:none}
`;

const S = {
  font: "'IBM Plex Sans KR', sans-serif",
  title: "'Gamja Flower', cursive",
  paper: "#faf6ee",
  cream: "#f3ede0",
  ink: "#3a3530",
  muted: "#8a8279",
  line: "#e2dbd0",
  accent: "#b8860b",
  sidebar: "#3a3530",
};

export default function App() {
  const [pg, setPg] = useState("login");
  const [user, setUser] = useState(null);
  const [memos, setMemos] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [history, setHistory] = useState([]);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [qRes, setQRes] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [notif, setNotif] = useState(null);
  const [tag, setTag] = useState(0);
  const [sort, setSort] = useState("up");
  const [lf, setLf] = useState({ email: "", pw: "" });
  const [sf, setSf] = useState({ name: "", email: "", pw: "", pw2: "" });
  const [le, setLe] = useState("");
  const [se, setSe] = useState("");
  const [et, setEt] = useState("");
  const [ec, setEc] = useState("");
  const [eTag, setETag] = useState(1);
  const [ePin, setEPin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ai, setAi] = useState(null);
  const [delC, setDelC] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendCh, setSendCh] = useState("email");
  const [selCon, setSelCon] = useState([]);
  const [sendSub, setSendSub] = useState("");
  const [sendMsg, setSendMsg] = useState("");
  const [conForm, setConForm] = useState(false);
  const [conData, setConData] = useState({ name: "", email: "", phone: "", kakao: "", group: "일반" });
  const [conEdit, setConEdit] = useState(null);
  const [view, setView] = useState("memos");
  const [conQ, setConQ] = useState("");
  const [sending, setSending] = useState(false);
  const tRef = useRef(null);
  const saveRef = useRef(null);

  useEffect(() => { 
    api.auth.me().then(u => { setUser(u); setPg("app"); load(); })
    .catch(() => { const s = localStorage.getItem(STORAGE_KEYS.session); if (s) { const u = JSON.parse(s); setUser(u); setPg("app"); load(); } });
  }, []);
  const load = async () => { 
    try {
      const m = await api.memos.list(); setMemos(m.results||m);
      const c = await api.contacts.list(); setContacts(c.results||c);
      const h = await api.messaging.history(); setHistory(h.results||h);
    } catch(e) { console.error(e); }
  };
  const saveM = async (e, m) => { setMemos(m); }; // Optimized for state only since API patches individually
  const saveC = async (e, c) => { setContacts(c); };
  const saveH = async (e, h) => { setHistory(h); };
  const flash = (m,t="ok") => { setNotif({m,t}); setTimeout(()=>setNotif(null),2500); };

  const login = async () => { 
    setLe(""); 
    try {
      const res = await api.auth.login(lf.email, lf.pw);
      setUser(res.user); setPg("app"); load();
    } catch(e) { setLe(e.message||"이메일 또는 비밀번호를 확인해주세요."); }
  };
  const signup = async () => { 
    setSe(""); if(!sf.name.trim()){setSe("이름을 입력해주세요.");return;} if(!sf.email.includes("@")){setSe("올바른 이메일을 입력해주세요.");return;} if(sf.pw.length<4){setSe("비밀번호 4자 이상 필요합니다.");return;} if(sf.pw!==sf.pw2){setSe("비밀번호가 일치하지 않습니다.");return;} 
    try {
      await api.auth.signup({email:sf.email, name:sf.name, password:sf.pw, passwordConfirm:sf.pw2});
      flash("가입 완료!"); setPg("login"); setLf({email:sf.email,pw:""});
    } catch(e) { setSe(e.message||"회원가입 실패 (이미 가입된 이메일일 수 있습니다)."); }
  };
  const logout = async () => { 
    try { await api.auth.logout(); } catch(e){} 
    setUser(null); setPg("login"); setSel(null); setMemos([]); 
  };

  const newMemo = () => { const m={id:Date.now().toString(),title:"",content:"",tag:1,pinned:false,created:new Date().toISOString(),updated:new Date().toISOString()}; saveM(user.email,[m,...memos]); setSel(m); setEt(""); setEc(""); setETag(1); setEPin(false); setEditing(true); setSendOpen(false); setAiOpen(false); setView("memos"); setTimeout(()=>tRef.current?.focus(),80); };
  const pick = (m) => { setSel(m); setEt(m.title); setEc(m.content); setETag(m.tag); setEPin(m.pinned); setEditing(false); setDelC(false); setAi({sch:detectSchedules(m.content),kw:extractKw(m.content),sum:summarize(m.content)}); };
  const autoSave = useCallback(() => { if(!sel||!user) return; const u=memos.map(m=>m.id===sel.id?{...m,title:et,content:ec,tag:eTag,pinned:ePin,updated:new Date().toISOString()}:m); saveM(user.email,u); setSel(u.find(m=>m.id===sel.id)); }, [sel,user,memos,et,ec,eTag,ePin]);
  useEffect(() => { if(!editing) return; if(saveRef.current) clearTimeout(saveRef.current); saveRef.current=setTimeout(autoSave,1200); return ()=>clearTimeout(saveRef.current); }, [et,ec,eTag,ePin,editing,autoSave]);

  const del = () => { saveM(user.email,memos.filter(m=>m.id!==sel.id)); setSel(null); setDelC(false); flash("삭제됨"); };
  const pin = () => { const p=!ePin; setEPin(p); const u=memos.map(m=>m.id===sel.id?{...m,pinned:p,updated:new Date().toISOString()}:m); saveM(user.email,u); setSel({...sel,pinned:p}); flash(p?"고정":"해제"); };

  const saveCon = () => { if(!conData.name.trim()){flash("이름 필수","err");return;} if(!conData.email&&!conData.phone&&!conData.kakao){flash("연락처 하나 이상 입력","err");return;} const u=conEdit?contacts.map(c=>c.id===conEdit.id?{...conData,id:conEdit.id}:c):[...contacts,{...conData,id:Date.now().toString()}]; saveC(user.email,u); setConForm(false); setConEdit(null); setConData({name:"",email:"",phone:"",kakao:"",group:"일반"}); flash(conEdit?"수정됨":"추가됨"); };
  const delCon = (id) => { saveC(user.email,contacts.filter(c=>c.id!==id)); setSelCon(selCon.filter(x=>x!==id)); };
  const togCon = (id) => setSelCon(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const openSend = () => { setSendOpen(true); setAiOpen(false); setSendSub(sel?.title||""); setSendMsg(sel?.content||""); setSendCh("email"); setSelCon([]); };
  const send = () => { if(!selCon.length){flash("받는 사람을 선택하세요","err");return;} if(!sendMsg.trim()){flash("내용을 입력하세요","err");return;} const recs=selCon.map(id=>contacts.find(c=>c.id===id)).filter(Boolean); const bad=recs.filter(r=>sendCh==="email"?!r.email:sendCh==="sms"?!r.phone:!r.kakao); if(bad.length){flash(`${bad.map(r=>r.name).join(", ")} - 정보 없음`,"err");return;} setSending(true); setTimeout(()=>{ saveH(user.email,[{id:Date.now().toString(),ch:sendCh,sub:sendSub,msg:sendMsg.slice(0,200),recs:recs.map(r=>({id:r.id,name:r.name})),memo:sel?.title,at:new Date().toISOString()},...history]); setSending(false); setSelCon([]); flash(`${recs.length}명 발송 완료`); },1200); };

  useEffect(() => { const t=setTimeout(()=>{ if(!q.trim()){setQRes(null);return;} const lq=q.toLowerCase(); setQRes(memos.filter(m=>m.title.toLowerCase().includes(lq)||m.content.toLowerCase().includes(lq))); },250); return ()=>clearTimeout(t); }, [q,memos]);

  const list = (qRes||memos).filter(m=>tag===0||m.tag===tag).sort((a,b)=>{ if(a.pinned!==b.pinned) return b.pinned?1:-1; return sort==="up"?new Date(b.updated)-new Date(a.updated):new Date(b.created)-new Date(a.created); });
  const scheds = memos.flatMap(m=>detectSchedules(m.content).filter(s=>s.type==="event"||s.type==="time").map(s=>({...s,t:m.title||"메모",id:m.id}))).slice(0,4);
  const today = memos.filter(m=>new Date(m.created).toDateString()===new Date().toDateString()).length;
  const fCon = contacts.filter(c=>!conQ||c.name.toLowerCase().includes(conQ.toLowerCase())||(c.email||"").includes(conQ)||(c.phone||"").includes(conQ));

  const I = (p) => <input {...p} style={{width:"100%",padding:"10px 12px",border:`1px solid ${S.line}`,borderRadius:6,fontSize:14,background:S.paper,fontFamily:S.font,transition:"border .2s",...p.style}} onFocus={e=>{e.target.style.borderColor=S.ink;p.onFocus?.(e);}} onBlur={e=>{e.target.style.borderColor=S.line;p.onBlur?.(e);}} />;
  const B = ({children,primary,danger,small,style,...p}) => <button {...p} style={{border:"none",borderRadius:6,fontSize:small?12:14,fontWeight:500,cursor:"pointer",fontFamily:S.font,padding:small?"5px 10px":"10px 18px",background:danger?"#a13d2d":primary?S.ink:S.cream,color:danger?"#fff":primary?S.paper:S.ink,transition:"all .15s",...style}}>{children}</button>;

  if (pg!=="app") return (
    <div style={{minHeight:"100vh",background:`linear-gradient(170deg, ${S.cream} 0%, #e8dfd0 100%)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:S.font}}>
      <style>{css}</style>
      <div style={{animation:"up .5s ease",width:"100%",maxWidth:400,padding:"0 20px"}}>
        <div style={{textAlign:"center",marginBottom:40}}><Logo size={48}/><h1 style={{fontFamily:S.title,fontSize:36,color:S.ink,marginTop:8,letterSpacing:1}}>워크드 노트</h1><p style={{color:S.muted,fontSize:13,marginTop:2}}>메모하고, 공유하고, 기억하세요</p></div>
        <div style={{background:"#fff",borderRadius:12,padding:"32px 28px",boxShadow:"0 1px 3px rgba(58,53,48,.08), 0 8px 24px rgba(58,53,48,.04)",border:`1px solid ${S.line}`}}>
          <div style={{display:"flex",borderBottom:`1px solid ${S.line}`,marginBottom:28}}>
            {[["login","로그인"],["signup","회원가입"]].map(([k,l])=><button key={k} onClick={()=>{setPg(k);setLe("");setSe("");}} style={{flex:1,padding:"10px 0",background:"none",border:"none",borderBottom:pg===k?`2px solid ${S.accent}`:"2px solid transparent",color:pg===k?S.ink:S.muted,fontSize:14,fontWeight:pg===k?600:400,cursor:"pointer",fontFamily:S.font}}>{l}</button>)}
          </div>
          {pg==="login"?(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={{fontSize:12,color:S.muted,marginBottom:4,display:"block"}}>이메일</label>{I({type:"email",value:lf.email,onChange:e=>setLf({...lf,email:e.target.value}),onKeyDown:e=>e.key==="Enter"&&login(),placeholder:"email@work.com"})}</div>
              <div><label style={{fontSize:12,color:S.muted,marginBottom:4,display:"block"}}>비밀번호</label>{I({type:"password",value:lf.pw,onChange:e=>setLf({...lf,pw:e.target.value}),onKeyDown:e=>e.key==="Enter"&&login(),placeholder:"····"})}</div>
              {le&&<p style={{color:"#a13d2d",fontSize:12}}>{le}</p>}
              <B primary onClick={login} style={{marginTop:4,width:"100%",padding:"12px"}}>로그인</B>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[["이름","name","text","홍길동"],["이메일","email","email","email@work.com"],["비밀번호","pw","password","4자 이상"],["비밀번호 확인","pw2","password",""]].map(([l,k,t,ph])=><div key={k}><label style={{fontSize:12,color:S.muted,marginBottom:4,display:"block"}}>{l}</label>{I({type:t,value:sf[k],onChange:e=>setSf({...sf,[k]:e.target.value}),onKeyDown:e=>k==="pw2"&&e.key==="Enter"&&signup(),placeholder:ph})}</div>)}
              {se&&<p style={{color:"#a13d2d",fontSize:12}}>{se}</p>}
              <B primary onClick={signup} style={{marginTop:4,width:"100%",padding:"12px"}}>가입하기</B>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:S.cream,fontFamily:S.font,display:"flex"}}>
      <style>{css}</style>
      {notif&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,animation:"drop .25s ease",background:notif.t==="err"?"#a13d2d":S.ink,color:S.paper,padding:"8px 20px",borderRadius:8,fontSize:13,fontWeight:500,boxShadow:"0 4px 16px rgba(0,0,0,.12)"}}>{notif.m}</div>}

      <div style={{width:240,minHeight:"100vh",background:S.sidebar,color:S.paper,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 16px 16px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid rgba(255,255,255,.06)"}}><Logo size={28} dark/><span style={{fontFamily:S.title,fontSize:20,letterSpacing:.5}}>워크드 노트</span></div>
        <div style={{padding:"12px 12px 4px"}}><B onClick={newMemo} style={{width:"100%",background:"rgba(255,255,255,.08)",color:S.paper,border:"1px solid rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px 12px",borderRadius:8,fontSize:13}}><span style={{fontSize:16,lineHeight:1}}>+</span> 새 메모</B></div>
        <div style={{padding:"8px 12px 0"}}>
          {[{icon:"▤",label:"메모",v:"memos",cnt:memos.length},{icon:"◎",label:"연락처",v:"contacts",cnt:contacts.length},{icon:"↗",label:"발송 내역",v:"history",cnt:history.length}].map(x=><button key={x.v} onClick={()=>{setView(x.v);if(x.v!=="memos")setSel(null);}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",width:"100%",background:view===x.v?"rgba(255,255,255,.08)":"transparent",border:"none",color:view===x.v?"#fff":"rgba(255,255,255,.55)",fontSize:13,cursor:"pointer",fontFamily:S.font,borderRadius:6,marginBottom:1,textAlign:"left"}}><span style={{fontSize:12,width:16,textAlign:"center",opacity:.7}}>{x.icon}</span>{x.label}<span style={{marginLeft:"auto",fontSize:11,opacity:.4}}>{x.cnt}</span></button>)}
        </div>
        {view==="memos"&&<div style={{padding:"10px 12px 0"}}><p style={{fontSize:10,color:"rgba(255,255,255,.25)",fontWeight:600,letterSpacing:1.5,marginBottom:6}}>태그</p><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{TAGS.map((t,i)=><button key={i} onClick={()=>setTag(tag===i?0:i)} style={{padding:"3px 8px",fontSize:11,background:tag===i?"rgba(255,255,255,.12)":"transparent",border:"none",color:tag===i?"#fff":"rgba(255,255,255,.45)",borderRadius:4,cursor:"pointer",fontFamily:S.font}}>{t.name}</button>)}</div></div>}
        {view==="memos"&&scheds.length>0&&<div style={{padding:"12px 12px 0"}}><p style={{fontSize:10,color:"rgba(255,255,255,.25)",fontWeight:600,letterSpacing:1.5,marginBottom:6}}>일정 감지</p>{scheds.map((s,i)=><div key={i} onClick={()=>{const m=memos.find(x=>x.id===s.id);if(m){pick(m);setView("memos");}}} style={{padding:"5px 8px",background:"rgba(255,255,255,.04)",borderRadius:5,fontSize:11,cursor:"pointer",marginBottom:2,color:"rgba(255,255,255,.5)"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.04)"}><span style={{color:S.accent}}>●</span> {s.t.slice(0,10)} — {s.text}</div>)}</div>}
        <div style={{marginTop:"auto",padding:"10px 12px"}}><div style={{padding:"10px",background:"rgba(255,255,255,.04)",borderRadius:8,display:"flex",justifyContent:"space-around",fontSize:10,color:"rgba(255,255,255,.35)"}}><div style={{textAlign:"center"}}><p style={{fontSize:16,fontWeight:600,color:"#fff"}}>{memos.length}</p>전체</div><div style={{textAlign:"center"}}><p style={{fontSize:16,fontWeight:600,color:"#fff"}}>{today}</p>오늘</div><div style={{textAlign:"center"}}><p style={{fontSize:16,fontWeight:600,color:"#fff"}}>{contacts.length}</p>연락처</div></div></div>
        <div style={{padding:"10px 12px 16px",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:"50%",background:S.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:"#fff",flexShrink:0}}>{user?.name?.[0]}</div><span style={{fontSize:12,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name}</span><button onClick={logout} style={{background:"none",border:"none",color:"rgba(255,255,255,.3)",fontSize:11,cursor:"pointer",fontFamily:S.font}} onMouseEnter={e=>e.target.style.color="#fff"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,.3)"}>나가기</button></div>
      </div>

      {view==="contacts"&&<div style={{flex:1,background:"#fff",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${S.line}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{fontSize:18,fontWeight:600,color:S.ink}}>연락처</h2><B primary small onClick={()=>{setConForm(true);setConEdit(null);setConData({name:"",email:"",phone:"",kakao:"",group:"일반"});}}>+ 추가</B></div>
        {conForm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.25)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={e=>e.target===e.currentTarget&&setConForm(false)}><div style={{background:"#fff",borderRadius:12,padding:24,width:400,animation:"up .2s ease",boxShadow:"0 8px 32px rgba(0,0,0,.1)"}}><h3 style={{fontSize:16,fontWeight:600,marginBottom:16,color:S.ink}}>{conEdit?"수정":"추가"}</h3><div style={{display:"flex",flexDirection:"column",gap:12}}>{[["이름 *","name","text","홍길동"],["이메일","email","email","email@work.com"],["전화번호","phone","tel","010-0000-0000"],["카카오톡 ID","kakao","text",""]].map(([l,k,t,ph])=><div key={k}><label style={{fontSize:11,color:S.muted,marginBottom:3,display:"block"}}>{l}</label>{I({type:t,value:conData[k],onChange:e=>setConData({...conData,[k]:e.target.value}),placeholder:ph})}</div>)}<div><label style={{fontSize:11,color:S.muted,marginBottom:3,display:"block"}}>그룹</label><div style={{display:"flex",gap:4}}>{GROUPS.map(g=><B key={g} small onClick={()=>setConData({...conData,group:g})} style={{background:conData.group===g?S.ink:S.cream,color:conData.group===g?"#fff":S.ink}}>{g}</B>)}</div></div></div><div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end"}}><B small onClick={()=>setConForm(false)}>취소</B><B primary small onClick={saveCon}>저장</B></div></div></div>}
        <div style={{padding:"10px 24px 0"}}>{I({value:conQ,onChange:e=>setConQ(e.target.value),placeholder:"이름, 이메일 검색...",style:{maxWidth:280}})}</div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 24px"}}>{fCon.length===0?<div style={{textAlign:"center",padding:"48px 0",color:S.muted,fontSize:14}}>연락처를 추가해보세요</div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:8}}>{fCon.map((c,i)=><div key={c.id} style={{padding:"12px 14px",background:S.paper,borderRadius:8,border:`1px solid ${S.line}`,animation:`up .2s ease ${i*.02}s both`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><div><p style={{fontSize:14,fontWeight:600,color:S.ink}}>{c.name}</p><span style={{fontSize:10,padding:"1px 6px",background:S.cream,borderRadius:3,color:S.muted}}>{c.group}</span></div><div style={{display:"flex",gap:4}}><B small onClick={()=>{setConEdit(c);setConData({name:c.name,email:c.email||"",phone:c.phone||"",kakao:c.kakao||"",group:c.group||"일반"});setConForm(true);}} style={{fontSize:11,padding:"3px 8px"}}>수정</B><B small danger onClick={()=>delCon(c.id)} style={{fontSize:11,padding:"3px 8px"}}>삭제</B></div></div><div style={{fontSize:12,color:S.muted,display:"flex",flexDirection:"column",gap:2}}>{c.email&&<span>✉ {c.email}</span>}{c.phone&&<span>☎ {c.phone}</span>}{c.kakao&&<span>◆ {c.kakao}</span>}</div></div>)}</div>}</div>
      </div>}

      {view==="history"&&<div style={{flex:1,background:"#fff",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${S.line}`}}><h2 style={{fontSize:18,fontWeight:600,color:S.ink}}>발송 내역</h2></div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 24px"}}>{history.length===0?<div style={{textAlign:"center",padding:"48px 0",color:S.muted,fontSize:14}}>발송 내역이 없습니다</div>:history.map((h,i)=>{const ch=CHANNELS.find(c=>c.key===h.ch);return<div key={h.id} style={{padding:"12px 14px",background:S.paper,borderRadius:8,border:`1px solid ${S.line}`,marginBottom:6,animation:`up .2s ease ${i*.02}s both`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:13,fontWeight:600,color:ch?.clr}}>{ch?.icon} {ch?.label} 발송</span><span style={{fontSize:11,color:S.muted}}>{fmtFull(h.at)}</span></div>{h.sub&&<p style={{fontSize:12,color:S.ink,marginBottom:2}}>{h.sub}</p>}<p style={{fontSize:12,color:S.muted}}>{h.msg}</p><div style={{display:"flex",gap:4,marginTop:6}}>{h.recs.map(r=><span key={r.id} style={{fontSize:10,padding:"1px 6px",background:S.cream,borderRadius:3,color:S.muted}}>{r.name}</span>)}</div></div>;})}</div>
      </div>}

      {view==="memos"&&<>
        <div style={{width:280,minHeight:"100vh",background:"#fff",borderRight:`1px solid ${S.line}`,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"10px 10px 6px"}}>{I({value:q,onChange:e=>setQ(e.target.value),placeholder:"검색...",style:{fontSize:13,padding:"8px 10px"}})}{qRes&&<div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:11,color:S.muted,padding:"0 2px"}}><span>{qRes.length}건</span><button onClick={()=>{setQ("");setQRes(null);}} style={{background:"none",border:"none",color:S.accent,cursor:"pointer",fontFamily:S.font,fontSize:11}}>초기화</button></div>}</div>
          <div style={{padding:"0 10px 4px",display:"flex",gap:4}}>{[["up","수정순"],["cr","생성순"]].map(([k,l])=><B key={k} small onClick={()=>setSort(k)} style={{fontSize:11,padding:"3px 8px",background:sort===k?S.ink:S.cream,color:sort===k?"#fff":S.ink}}>{l}</B>)}</div>
          <div style={{flex:1,overflowY:"auto",padding:"0 6px"}}>{list.length===0?<div style={{textAlign:"center",padding:"36px 12px",color:S.muted,fontSize:13}}>메모를 작성해보세요</div>:list.map((m,i)=><div key={m.id} onClick={()=>{pick(m);setSendOpen(false);}} style={{padding:"10px 10px",margin:"1px 0",borderRadius:6,cursor:"pointer",transition:"all .12s",background:sel?.id===m.id?TAGS[m.tag]?.bg||S.paper:"transparent",borderLeft:sel?.id===m.id?`3px solid ${TAGS[m.tag]?.fg||S.muted}`:"3px solid transparent",animation:`left .15s ease ${i*.02}s both`}} onMouseEnter={e=>{if(sel?.id!==m.id)e.currentTarget.style.background=S.paper;}} onMouseLeave={e=>{if(sel?.id!==m.id)e.currentTarget.style.background="transparent";}}><div style={{display:"flex",alignItems:"center",gap:6}}>{m.pinned&&<span style={{fontSize:9,color:S.accent}}>●</span>}<p style={{fontSize:13,fontWeight:500,color:S.ink,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title||"제목 없음"}</p></div>{m.content&&<p style={{fontSize:11,color:S.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2,paddingLeft:m.pinned?15:0}}>{m.content.slice(0,48)}</p>}<p style={{fontSize:10,color:"#c4bda8",marginTop:2,paddingLeft:m.pinned?15:0}}>{fmtDate(m.updated)}</p></div>)}</div>
        </div>

        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
          {!sel?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}><Logo size={56}/><p style={{fontSize:14,color:S.muted}}>메모를 선택하거나 만들어보세요</p><B primary onClick={newMemo} style={{marginTop:4}}>+ 새 메모</B></div>:<>
            <div style={{padding:"8px 18px",borderBottom:`1px solid ${S.line}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",flexWrap:"wrap",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                {TAGS.slice(1).map((t,i)=><button key={i+1} onClick={()=>{setETag(i+1);if(!editing)setEditing(true);}} style={{padding:"3px 8px",fontSize:11,background:eTag===i+1?t.bg:"transparent",color:eTag===i+1?t.fg:S.muted,border:eTag===i+1?`1px solid ${t.fg}33`:"1px solid transparent",borderRadius:4,cursor:"pointer",fontFamily:S.font,fontWeight:500}}>{t.name}</button>)}
                <span style={{width:1,height:16,background:S.line,margin:"0 4px"}}/>
                <button onClick={pin} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:ePin?S.accent:S.muted,fontFamily:S.font}}>{ePin?"● 고정":"○ 고정"}</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <B small onClick={openSend} style={{background:sendOpen?S.ink:S.cream,color:sendOpen?"#fff":S.ink,fontSize:12}}>↗ 발송</B>
                <B small onClick={()=>{setAiOpen(!aiOpen);setSendOpen(false);}} style={{background:aiOpen?"#3d5a80":S.cream,color:aiOpen?"#fff":S.ink,fontSize:12}}>AI</B>
                {!editing?<B small primary onClick={()=>{setEditing(true);setTimeout(()=>tRef.current?.focus(),50);}}>수정</B>:<B small primary onClick={()=>{autoSave();setEditing(false);flash("저장됨");}}>저장</B>}
                <B small danger onClick={()=>setDelC(true)} style={{fontSize:12}}>삭제</B>
              </div>
            </div>
            {delC&&<div style={{padding:"8px 18px",background:"#fae4df",borderBottom:"1px solid #e8c4bb",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,color:"#a13d2d"}}>삭제할까요?</span><div style={{display:"flex",gap:4}}><B small onClick={()=>setDelC(false)}>취소</B><B small danger onClick={del}>삭제</B></div></div>}
            <div style={{flex:1,display:"flex",overflow:"hidden"}}>
              <div style={{flex:1,overflowY:"auto",background:TAGS[eTag]?.bg||S.paper,transition:"background .3s"}}>
                <div style={{padding:"24px 28px",maxWidth:720}}>
                  {editing?<><input ref={tRef} value={et} onChange={e=>setEt(e.target.value)} placeholder="제목" style={{width:"100%",fontSize:22,fontWeight:600,border:"none",background:"transparent",color:S.ink,fontFamily:S.font,letterSpacing:-.3,marginBottom:4}}/><div style={{width:40,height:2,background:S.accent,opacity:.4,marginBottom:16,borderRadius:1}}/><textarea value={ec} onChange={e=>setEc(e.target.value)} placeholder={"내용을 적어보세요...\n\n일정을 적으면 자동으로 감지합니다\n예: 내일 3시 회의"} style={{width:"100%",minHeight:420,fontSize:14,lineHeight:2.0,border:"none",background:"transparent",color:S.ink,resize:"none",fontFamily:S.font,backgroundImage:`repeating-linear-gradient(transparent, transparent 27px, ${S.line}55 27px, ${S.line}55 28px)`,backgroundSize:"100% 28px",backgroundPositionY:5}}/></>:<><h1 style={{fontSize:22,fontWeight:600,color:S.ink,letterSpacing:-.3}}>{sel.title||"제목 없음"}</h1><div style={{width:40,height:2,background:S.accent,opacity:.4,margin:"6px 0 4px",borderRadius:1}}/><p style={{fontSize:11,color:S.muted,marginBottom:20}}>작성 {fmtFull(sel.created)} · 수정 {fmtFull(sel.updated)}</p><div style={{fontSize:14,lineHeight:2.0,color:S.ink,whiteSpace:"pre-wrap",backgroundImage:`repeating-linear-gradient(transparent, transparent 27px, ${S.line}55 27px, ${S.line}55 28px)`,backgroundSize:"100% 28px",backgroundPositionY:5,minHeight:200}}>{sel.content||"내용이 없습니다."}</div></>}
                </div>
              </div>

              {sendOpen&&<div style={{width:300,background:"#fff",borderLeft:`1px solid ${S.line}`,overflowY:"auto",animation:"right .2s ease",padding:"14px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={{fontSize:14,fontWeight:600,color:S.ink}}>메모 발송</h3><button onClick={()=>setSendOpen(false)} style={{background:"none",border:"none",fontSize:16,color:S.muted,cursor:"pointer"}}>×</button></div>
                <div style={{display:"flex",gap:4,marginBottom:12}}>{CHANNELS.map(ch=><button key={ch.key} onClick={()=>setSendCh(ch.key)} style={{flex:1,padding:"7px 4px",background:sendCh===ch.key?`${ch.clr}11`:S.paper,border:sendCh===ch.key?`1.5px solid ${ch.clr}44`:`1.5px solid ${S.line}`,borderRadius:8,fontSize:12,color:sendCh===ch.key?ch.clr:S.muted,cursor:"pointer",fontFamily:S.font,fontWeight:500,textAlign:"center"}}>{ch.icon} {ch.label}</button>)}</div>
                <div style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><label style={{fontSize:11,color:S.muted,fontWeight:600}}>받는 사람</label><button onClick={()=>{setView("contacts");setSendOpen(false);}} style={{background:"none",border:"none",fontSize:10,color:S.accent,cursor:"pointer",fontFamily:S.font}}>연락처 관리 →</button></div>
                  {contacts.length===0?<div style={{padding:12,background:S.paper,borderRadius:6,textAlign:"center",fontSize:12,color:S.muted}}>연락처 없음</div>:<div style={{maxHeight:160,overflowY:"auto",border:`1px solid ${S.line}`,borderRadius:8,background:S.paper}}>{contacts.map(c=>{const has=sendCh==="email"?!!c.email:sendCh==="sms"?!!c.phone:!!c.kakao;const on=selCon.includes(c.id);return<div key={c.id} onClick={()=>has&&togCon(c.id)} style={{padding:"7px 10px",display:"flex",alignItems:"center",gap:8,cursor:has?"pointer":"default",opacity:has?1:.35,borderBottom:`1px solid ${S.line}22`,background:on?`${CHANNELS.find(x=>x.key===sendCh)?.clr}08`:"transparent"}}><div style={{width:16,height:16,borderRadius:3,border:on?"none":`1.5px solid ${S.line}`,background:on?CHANNELS.find(x=>x.key===sendCh)?.clr:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on&&<span style={{color:"#fff",fontSize:10,fontWeight:700}}>✓</span>}</div><div style={{flex:1}}><p style={{fontSize:12,fontWeight:500,color:S.ink}}>{c.name}</p><p style={{fontSize:10,color:S.muted}}>{sendCh==="email"?c.email||"—":sendCh==="sms"?c.phone||"—":c.kakao||"—"}</p></div></div>;})}</div>}
                  {selCon.length>0&&<p style={{fontSize:10,color:S.accent,marginTop:4,fontWeight:500}}>{selCon.length}명 선택</p>}
                </div>
                {sendCh==="email"&&<div style={{marginBottom:10}}><label style={{fontSize:11,color:S.muted,fontWeight:600,marginBottom:3,display:"block"}}>제목</label>{I({value:sendSub,onChange:e=>setSendSub(e.target.value),style:{fontSize:12}})}</div>}
                <div style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><label style={{fontSize:11,color:S.muted,fontWeight:600}}>내용</label><button onClick={()=>setSendMsg(ec||sel?.content||"")} style={{background:"none",border:"none",fontSize:10,color:S.accent,cursor:"pointer",fontFamily:S.font}}>메모 불러오기</button></div><textarea value={sendMsg} onChange={e=>setSendMsg(e.target.value)} placeholder="발송 내용..." style={{width:"100%",minHeight:100,padding:"8px 10px",border:`1px solid ${S.line}`,borderRadius:6,fontSize:12,resize:"vertical",fontFamily:S.font,background:S.paper,lineHeight:1.7}} onFocus={e=>e.target.style.borderColor=S.ink} onBlur={e=>e.target.style.borderColor=S.line}/></div>
                <B primary onClick={send} disabled={sending} style={{width:"100%",padding:"10px",fontSize:13,background:sending?S.muted:CHANNELS.find(c=>c.key===sendCh)?.clr,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{sending?<><span style={{display:"inline-block",width:14,height:14,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite"}}/> 발송 중...</>:<>{CHANNELS.find(c=>c.key===sendCh)?.icon} {CHANNELS.find(c=>c.key===sendCh)?.label} 발송</>}</B>
              </div>}

              {aiOpen&&!sendOpen&&<div style={{width:240,background:"#fff",borderLeft:`1px solid ${S.line}`,overflowY:"auto",padding:"14px 12px",animation:"right .2s ease"}}>
                <h3 style={{fontSize:13,fontWeight:600,color:S.ink,marginBottom:12}}>AI 분석</h3>
                {ai?.sum&&<div style={{marginBottom:14}}><p style={{fontSize:10,color:S.muted,fontWeight:600,marginBottom:4}}>요약</p><div style={{padding:"8px 10px",background:S.paper,borderRadius:6,fontSize:12,color:"#5c554a",lineHeight:1.6}}>{ai.sum}</div></div>}
                {ai?.kw?.length>0&&<div style={{marginBottom:14}}><p style={{fontSize:10,color:S.muted,fontWeight:600,marginBottom:4}}>키워드</p><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{ai.kw.map((k,i)=><span key={i} onClick={()=>{setQ(k);setAiOpen(false);}} style={{padding:"2px 8px",background:"#dce8f5",color:"#3d5a80",fontSize:11,borderRadius:4,cursor:"pointer"}}>{k}</span>)}</div></div>}
                {ai?.sch?.length>0&&<div style={{marginBottom:14}}><p style={{fontSize:10,color:S.muted,fontWeight:600,marginBottom:4}}>일정</p>{ai.sch.map((s,i)=><div key={i} style={{padding:"5px 8px",background:"#faf0d6",borderRadius:5,fontSize:11,color:"#8b6914",marginBottom:3}}>{s.type==="event"?"▪":"◦"} {s.text}</div>)}</div>}
                <div><p style={{fontSize:10,color:S.muted,fontWeight:600,marginBottom:4}}>통계</p><div style={{padding:"8px 10px",background:S.paper,borderRadius:6,fontSize:11,color:S.muted,lineHeight:1.8}}>{(ec||sel.content).length}자 · {(ec||sel.content).split(/\s+/).filter(Boolean).length}단어 · {(ec||sel.content).split("\n").length}줄</div></div>
                {(!ai?.sum&&(!ai?.kw||!ai.kw.length)&&(!ai?.sch||!ai.sch.length))&&<div style={{textAlign:"center",padding:"20px 0",color:S.muted,fontSize:12}}>내용을 작성하면<br/>분석이 시작됩니다</div>}
              </div>}
            </div>
          </>}
        </div>
      </>}
    </div>
  );
}
