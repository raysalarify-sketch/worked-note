import React, { useState, useEffect, useRef, useCallback } from "react";
import * as api from "./api";

// Designer's Design System
const S = {
  font: "'Inter', 'IBM Plex Sans KR', sans-serif",
  title: "'Inter', sans-serif",
  paper: "#ffffff",
  cream: "#f5f5f7",
  ink: "#1a1a1a",
  muted: "#86868b",
  line: "#d2d2d7",
  accent: "#1a1a1a",
  sidebar: "#ffffff",
  glass: "rgba(255, 255, 255, 0.8)",
  shadow: "0 20px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.02)",
};

const TAGS = [
  { name: "전체", bg: "#f1f5f9", fg: "#64748b" },
  { name: "기획", bg: "#e0f2fe", fg: "#0369a1" },
  { name: "개발", bg: "#f0fdf4", fg: "#15803d" },
  { name: "디자인", bg: "#faf5ff", fg: "#7e22ce" },
  { name: "영업", bg: "#fff7ed", fg: "#c2410c" },
  { name: "마케팅", bg: "#fef2f2", fg: "#b91c1c" },
  { name: "중요", bg: "#fff1f2", fg: "#be123c" }
];

const GROUPS = ["회사", "협력사", "팀원", "개인", "미분류"];
const CHANNELS = [
  { key: "email", label: "이메일", icon: "✉", clr: "#4f46e5" },
  { key: "sms", label: "SMS", icon: "📱", clr: "#0ea5e9" },
  { key: "kakao", label: "카카오톡", icon: "◆", clr: "#f59e0b" }
];

const fmtDate = (d) => { if(!d) return ""; const date=new Date(d); return `${date.getMonth()+1}월 ${date.getDate()}일`; };
const fmtFull = (d) => { if(!d) return ""; const date=new Date(d); return `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`; };

const detectSchedules = (txt) => {
  if(!txt) return [];
  const res = [];
  const dRegex = /(\d{1,2})[월.-]\s*(\d{1,2})[일\s]*/g;
  let m;
  while((m = dRegex.exec(txt)) !== null) res.push({ type: "date", month: parseInt(m[1]), day: parseInt(m[2]), text: m[0] });
  if(txt.includes("미팅") || txt.includes("회의")) res.push({ type: "event", text: "회의 일정이 감지됨" });
  if(txt.includes("매일") || txt.includes("매주")) res.push({ type: "routine", text: "정기 일정이 감지됨" });
  return res;
};

const extractItems = (txt) => {
  if(!txt) return [];
  const lines = txt.split('\n');
  const items = [];
  lines.forEach(l => {
    const m = l.match(/(.+?)[:\s]+([\d,]+)원?/);
    if(m) {
      const amt = parseInt(m[2].replace(/,/g, ""));
      if(amt > 0) items.push({ text: m[1].trim(), amount: amt });
    }
  });
  return items;
};

const Logo = ({size=32}) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="10" fill={S.ink}/>
    <circle cx="15" cy="20" r="4" stroke="white" strokeWidth="2.5"/>
    <circle cx="25" cy="20" r="4" stroke="white" strokeWidth="2.5"/>
  </svg>
);

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  const [ai, setAi] = useState(null);
  const [delC, setDelC] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendCh, setSendCh] = useState("email");
  const [selCon, setSelCon] = useState([]);
  const [sendSub, setSendSub] = useState("");
  const [sendMsg, setSendMsg] = useState("");
  const [conForm, setConForm] = useState(false);
  const [conPaste, setConPaste] = useState(false);
  const [conPasteText, setConPasteText] = useState("");
  const [conData, setConData] = useState({ name: "", email: "", phone: "", kakao_id: "", group: "회사" });
  const [conEdit, setConEdit] = useState(null);
  const [view, setView] = useState("memos");
  const [conQ, setConQ] = useState("");
  const [conTab, setConTab] = useState("전체");
  const [sendConQ, setSendConQ] = useState("");
  const [sendGrp, setSendGrp] = useState("전체");
  const [total, setTotal] = useState(0);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [alarmOpen, setAlarmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [pwForm, setPwForm] = useState({ old: "", new1: "", new2: "" });
  const [pwOpen, setPwOpen] = useState(false);
  const [wsName, setWsName] = useState(localStorage.getItem("wn-wsname") || "(oo) Note");
  const [editWs, setEditWs] = useState(false);
  const [rotIdx, setRotIdx] = useState(0);
  const ROT_WORDS = ["기획", "개발", "디자인", "영업", "마케팅", "개인", "비즈니스"];
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [presentMode, setPresentMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetForm, setResetForm] = useState({ uid: "", token: "", newPw: "" });
  const [sharedData, setSharedData] = useState(null);
  
  const tRef = useRef(null);
  const saveRef = useRef(null);

  const flash = (m,t="ok") => { setNotif({m,t}); setTimeout(()=>setNotif(null),2500); };

  useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean);
    if(path.startsWith("/share/") && parts.length >= 2){
      api.memos.getShare(parts[1]).then(res => { setSharedData(res); setPg("shared"); }).catch(()=>setPg("login"));
      return;
    }
    if(path.startsWith("/reset-password/") && parts.length >= 3){
      setResetForm(p => ({...p, uid:parts[1], token:parts[2]}));
      setPg("reset-confirm"); window.history.replaceState({}, "", "/");
    }
    api.auth.me().then(u => { setUser(u); setPg("app"); load(); }).catch(()=>{});
  }, []);

  const load = async () => {
    try {
      const m = await api.memos.list(); setMemos(m.results || m);
      const c = await api.contacts.list(); setContacts(c.results || c);
      const h = await api.messaging.history(); setHistory(h.results || h);
    } catch(e){}
  };

  const login = async () => {
    setLe(""); setSending(true);
    try {
      const res = await api.auth.login(lf.email, lf.pw);
      setUser(res.user); setPg("app"); load();
    } catch(e){ setLe("이메일 또는 비밀번호를 확인해주세요."); } finally { setSending(false); }
  };

  const signup = async () => {
    setSe("");
    if(!sf.name.trim()){setSe("이름을 입력해주세요.");return;}
    if(!sf.email.includes("@")){setSe("이메일을 확인해주세요.");return;}
    if(sf.pw.length<4){setSe("비밀번호는 4자 이상입니다.");return;}
    try {
      await api.auth.signup({email:sf.email, name:sf.name, password:sf.pw, password_confirm:sf.pw2});
      flash("가입 완료!"); setPg("login"); setLf({email:sf.email,pw:""});
    } catch(e){ setSe("이미 가입된 이메일이거나 오류가 발생했습니다."); }
  };

  const logout = () => { api.auth.logout(); setUser(null); setPg("login"); };

  const newMemo = async () => {
    try {
      const m = await api.memos.create({title:"", content:"", color:1, pinned:false});
      setMemos([m, ...memos]); setSel(m); setEt(""); setEc(""); setETag(1); setEPin(false); setEditing(true); setView("memos");
      setTimeout(()=>tRef.current?.focus(), 80);
    } catch(e){ flash("생성 실패", "err"); }
  };

  const pick = (m) => { setSel(m); setEt(m.title||""); setEc(m.content||""); setETag(m.color||1); setEPin(m.pinned||false); setEditing(false); setDelC(false); };
  
  const autoSave = useCallback(async () => {
    if(!sel || !user) return;
    try {
      await api.memos.patch(sel.id, {title:et, content:ec, color:eTag, pinned:ePin});
      const u = memos.map(m=>m.id===sel.id?{...m, title:et, content:ec, color:eTag, pinned:ePin, updated_at:new Date().toISOString()}:m);
      setMemos(u);
    } catch(e){}
  }, [sel,user,memos,et,ec,eTag,ePin]);

  useEffect(() => { 
    if(!editing) return; 
    if(saveRef.current) clearTimeout(saveRef.current); 
    saveRef.current = setTimeout(autoSave, 1200); 
    return () => clearTimeout(saveRef.current); 
  }, [et,ec,eTag,ePin,editing,autoSave]);

  const del = async () => {
    if(!sel) return;
    try { await api.memos.delete(sel.id); setMemos(memos.filter(m=>m.id!==sel.id)); setSel(null); flash("삭제됨"); } catch(e){}
  };

  const pin = async () => {
    const p = !ePin; setEPin(p);
    if(sel) try { await api.memos.patch(sel.id, {pinned:p}); setMemos(memos.map(m=>m.id===sel.id?{...m,pinned:p}:m)); } catch(e){}
  };

  const saveCon = async () => {
    setSending(true);
    try {
      if(conEdit) await api.contacts.patch(conEdit.id, conData);
      else await api.contacts.create(conData);
      setConForm(false); load(); flash("저장 완료");
    } catch(e){ flash("저장 실패", "err"); } finally { setSending(true); }
  };

  const send = async () => {
    if(selCon.length===0){flash("수신자를 선택하세요","err");return;}
    setSending(true);
    try {
      await api.messaging.send({ channel:sendCh, recipients:selCon, subject:sendSub, message:sendMsg, memo_id:sel?.id });
      setSending(false); setSelCon([]); setSendOpen(false); flash("발송 완료"); load();
    } catch(e){ setSending(false); flash("발송 실패","err"); }
  };

  const requestReset = async () => {
    if(!resetEmail.includes("@")){flash("이메일을 입력하세요","err");return;}
    try { await api.auth.requestPasswordReset(resetEmail); flash("이메일을 확인해주세요!"); setPg("login"); } catch(e){ flash("오류 발생","err"); }
  };

  const confirmReset = async () => {
    if(!resetForm.uid || !resetForm.token || !resetForm.newPw){flash("정보를 입력하세요","err");return;}
    try { await api.auth.confirmPasswordReset({uid:resetForm.uid, token:resetForm.token, new_password:resetForm.newPw}); flash("초기화 완료"); setPg("login"); } catch(e){ flash("오류 발생","err"); }
  };

  const getSum = (txt) => {
    const ms = txt?.match(/[\d,]+원?/g) || [];
    let s = 0;
    ms.forEach(m => { const n = parseInt(m.replace(/[,원]/g,"")); if(!isNaN(n) && n > 100) s += n; });
    return s;
  };

  const insertTemplate = (type) => {
    let t = "";
    if(type==="meet") t = "## 📅 회의록\n\n**일시:** \n**참석자:** \n\n**내용:**\n- ";
    if(type==="calc") t = "## 💸 정산\n\n- 식대: 10,000원\n- 교통비: 5,000원";
    setEc(ec + (ec?"\n\n":"") + t); setTotal(getSum(ec+t)); tRef.current?.focus();
  };

  const I = (p) => <input {...p} style={{width:"100%",padding:"12px",border:`1px solid ${S.line}`,borderRadius:8,fontSize:14,background:S.paper,fontFamily:S.font,transition:"all .2s",outline:"none",...p.style}} onFocus={e=>{e.target.style.borderColor=S.ink;e.target.style.boxShadow="0 0 0 4px rgba(0,0,0,0.05)"}} onBlur={e=>{e.target.style.borderColor=S.line;e.target.style.boxShadow="none"}} />;
  const B = ({children,primary,danger,small,style,...p}) => <button {...p} style={{border:"none",borderRadius:8,fontSize:small?12:14,fontWeight:600,cursor:"pointer",fontFamily:S.font,padding:small?"6px 12px":"12px 24px",background:danger?"#e11d48":primary?S.ink:S.cream,color:danger?"#fff":primary?S.paper:S.ink,transition:"all .2s",...style}} onMouseEnter={e=>{if(!p.disabled) e.currentTarget.style.opacity=0.9}} onMouseLeave={e=>{e.currentTarget.style.opacity=1}}>{children}</button>;

  // Views Partitioning
  // Cinematic Showcase Logic
  const [demoStep, setDemoStep] = useState(0);
  useEffect(() => {
    if (pg !== "login") return;
    const it = setInterval(() => setDemoStep(s => (s + 1) % 3), 4000);
    return () => clearInterval(it);
  }, [pg]);

  if (pg === "login") return (
    <div style={{ display: "flex", height: "100vh", background: "#fff", overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>
      {!isMobile && (
        <div style={{ flex: 1.2, background: S.ink, padding: "80px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", borderRight: `1px solid ${S.line}`, color: "#fff" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.1, background: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)", backgroundSize: "40px 40px" }} />
          <div style={{ position: "relative", zIndex: 1, maxWidth: 640 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40, animation: "slideUpFade 0.8s ease" }}>
              <Logo size={40} />
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3 }}>(oo) NOTE</span>
            </div>
            <div style={{ height: 320, position: "relative" }}>
              {demoStep === 0 && (
                <div style={{ animation: "slideUpFade 0.8s ease" }}>
                  <h1 style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, marginBottom: 24, letterSpacing: -3 }}>기록이<br />돈이 됩니다.</h1>
                  <p style={{ fontSize: 20, color: "rgba(255,255,255,0.6)", marginBottom: 40, lineHeight: 1.6 }}>숫자만 적으면 (oo)이 즉시 계산하고<br />전문적인 인보이스로 변환합니다.</p>
                </div>
              )}
              {demoStep === 1 && (
                <div style={{ animation: "slideUpFade 0.8s ease" }}>
                  <h1 style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, marginBottom: 24, letterSpacing: -3 }}>지능형<br />연결의 힘.</h1>
                  <p style={{ fontSize: 20, color: "rgba(255,255,255,0.6)", marginBottom: 40, lineHeight: 1.6 }}>당신의 생각을 과거의 기록과<br />연결하여 더 큰 인사이트를 제공합니다.</p>
                </div>
              )}
              {demoStep === 2 && (
                <div style={{ animation: "slideUpFade 0.8s ease" }}>
                  <h1 style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, marginBottom: 24, letterSpacing: -3 }}>메모가 곧<br />작품이다.</h1>
                  <p style={{ fontSize: 20, color: "rgba(255,255,255,0.6)", marginBottom: 40, lineHeight: 1.6 }}>젠(Zen) 모드로 몰입하고,<br />단 한 번의 터치로 PT를 시작하세요.</p>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 60 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: demoStep === i ? 40 : 8, height: 8, borderRadius: 4, background: demoStep === i ? "#fff" : "rgba(255,255,255,0.2)", transition: "all 0.4s ease" }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {isMobile && (
        <div style={{ padding: "40px 20px", textAlign: "center", background: S.ink, color: "#fff" }}>
           <Logo size={48} style={{ margin: "0 auto 20px" }} />
           <h2 style={{ fontSize: 24, fontWeight: 800 }}>(oo) Note</h2>
        </div>
      )}

      <div style={{ flex: isMobile ? 1 : 0.8, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: isMobile ? "90%" : 400, padding: isMobile ? "20px 0" : 40, animation: "slideUpFade 1s ease" }}>
          {!isMobile && <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, letterSpacing: -1 }}>Welcome Back</h2>}
          <p style={{ color: S.muted, marginBottom: 40, fontSize: 16, lineHeight: 1.5 }}>{isMobile ? "계정에 로그인하세요." : "가장 스마트한 노트 앱 (oo) 에 오신 것을 환영합니다."}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "block" }}>Email</label>
              {I({ value: lf.email, onChange: e => setLf({ ...lf, email: e.target.value }), placeholder: "name@example.com", style: { padding: "14px" } })}
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "block" }}>Password</label>
              {I({ type: "password", value: lf.pw, onChange: e => setLf({ ...lf, pw: e.target.value }), placeholder: "••••••••", style: { padding: "14px" } })}
            </div>
            {le && <p style={{ color: "#e11d48", textAlign: "center", fontSize: 13, fontWeight: 600 }}>{le}</p>}
            <B primary onClick={login} disabled={sending}>{sending ? "Signing In..." : "Sign In"}</B>
            <div style={{ textAlign: "center", marginTop: 12 }}>
               <button onClick={()=>setPg("signup")} style={{ background: "none", border: "none", color: S.ink, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Create Account</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (pg === "app") return (
    <div style={{ height: "100vh", display: "flex", background: S.cream, fontFamily: S.font, flexDirection: isMobile ? "column" : "row" }}>
      {notif && <div style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: S.ink, color: "#fff", padding: "12px 24px", borderRadius: 12, fontWeight: 600, boxShadow: S.shadow }}>{notif.m}</div>}
      
      {/* Sidebar - Mobile Responsive */}
      {(!isMobile || !sel) && (
        <div style={{ width: isMobile ? "100%" : 260, borderRight: `1px solid ${S.line}`, background: "#fff", display: "flex", flexDirection: "column", height: isMobile ? "auto" : "100vh" }}>
          <div style={{ padding: "24px", display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={28} />
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -1 }}>(oo) Note</span>
          </div>
          {isMobile && view === "memos" && <div style={{ padding: "0 16px 20px" }}><B primary style={{ width: "100%" }} onClick={newMemo}>+ 새 메모 작성</B></div>}
          
          {!isMobile && (
            <div style={{ padding: "0 16px 20px" }}>
              <B primary style={{ width: "100%", justifyContent: "center" }} onClick={newMemo}>+ 새 메모 작성</B>
            </div>
          )}

          <div style={{ flex: 1, padding: "0 12px", overflowY: "auto" }}>
            <div style={{ padding: "10px" }}>{I({ value: q, onChange: e => setQ(e.target.value), placeholder: "검색..." })}</div>
            {memos.map((m, i) => (
              <div key={i} onClick={()=>pick(m)} style={{ padding: "16px 18px", cursor: "pointer", background: sel?.id===m.id?S.cream:"transparent", transition: "0.2s", borderRadius: 10, marginBottom: 4 }}>
                <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.title || "제목 없음"}</p>
                <p style={{ fontSize: 12, color: S.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.content?.slice(0, 40)}</p>
              </div>
            ))}
          </div>
          
          {!isMobile && (
            <div style={{ padding: "20px", borderTop: `1px solid ${S.line}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: S.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{user?.name?.[0]}</div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{user?.name}</span>
              <button onClick={logout} style={{ marginLeft: "auto", background: "none", border: "none", color: S.muted, fontSize: 12, cursor: "pointer" }}>로그아웃</button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {(sel || !isMobile) && (
        <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", position: "relative", height: "100vh" }}>
          {/* Editor Header */}
          <div style={{ height: 64, borderBottom: `1px solid ${S.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "0 16px" : "0 32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
               {isMobile && <button onClick={()=>setSel(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>←</button>}
               <span style={{ fontWeight: 700, fontSize: 15 }}>{sel ? (sel.title || "무제") : "워크스페이스"}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
               {!isMobile && <B small onClick={()=>setAiOpen(!aiOpen)}>✨ AI</B>}
               <B small onClick={()=>setPresentMode(true)}>📺 PT</B>
               <B primary small onClick={()=>setSendOpen(true)}>↗</B>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "30px 20px" : "60px 80px" }}>
              {sel ? (
                <div style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>
                  <input
                    ref={tRef}
                    value={et}
                    onChange={e => setEt(e.target.value)}
                    onFocus={()=>setEditing(true)}
                    style={{ fontSize: isMobile ? 28 : 42, fontWeight: 800, border: "none", width: "100%", marginBottom: 24, letterSpacing: -1, outline: "none" }}
                    placeholder="제목"
                  />
                  <textarea
                    value={ec}
                    onChange={e => { setEc(e.target.value); setTotal(getSum(e.target.value)); }}
                    onFocus={()=>setEditing(true)}
                    style={{ width: "100%", height: "60vh", border: "none", fontSize: isMobile ? 16 : 18, lineHeight: 1.8, resize: "none", outline: "none", fontFamily: S.font, background: "transparent" }}
                    placeholder="적어보세요..."
                  />
                </div>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: S.muted }}>
                   <div style={{ textAlign: "center" }}>
                     <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
                     <p>메모를 선택하세요.</p>
                   </div>
                </div>
              )}
            </div>

            {/* AI Insight Sidebar - Desktop Only */}
            {!isMobile && sel && (
              <div style={{ width: 280, borderLeft: `1px solid ${S.line}`, background: "#fcfcfc", padding: "32px 24px", animation: "right .5s ease" }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 20 }}>💡 INSIGHT</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ background: "#fff", padding: 12, borderRadius: 10, boxShadow: S.shadow, border: `1px solid ${S.line}`, fontSize: 12 }}>
                    관련 태그: #기획 #개발
                  </div>
                </div>
              </div>
            )}
          </div>

            {/* Smart Calc Popup */}
            {total > 0 && (
              <div style={{ position: "fixed", bottom: 40, right: 40, background: S.ink, color: "#fff", padding: "12px 24px", borderRadius: 32, boxShadow: S.shadow, display: "flex", gap: 12, alignItems: "center", animation: "slideUpFade 0.5s ease" }}>
                <span style={{ opacity: 0.7, fontSize: 13 }}>스마트 정산:</span>
                <span style={{ fontWeight: 800, fontSize: 18 }}>₩{total.toLocaleString()}</span>
                <button style={{ background: "rgba(255,255,255,0.2)", border: "none", padding: "4px 10px", borderRadius: 8, color: "#fff", fontSize: 11, cursor: "pointer" }} onClick={()=>setReceiptOpen(true)}>영수증</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {presentMode && sel && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 10000, padding: "100px 15%", overflowY: "auto" }}>
           <button onClick={()=>setPresentMode(false)} style={{ position: "fixed", top: 40, right: 40, width: 48, height: 48, borderRadius: "50%", background: S.cream, border: "none", fontSize: 24, cursor: "pointer" }}>✕</button>
           <h1 style={{ fontSize: 64, fontWeight: 800, marginBottom: 40, letterSpacing: -3 }}>{sel.title || "무제"}</h1>
           <div style={{ fontSize: 28, lineHeight: 1.8, color: S.ink, whiteSpace: "pre-wrap" }}>{sel.content}</div>
        </div>
      )}
    </div>
  );

  // Return fallback for shared/other views
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: S.cream }}>
       <style>{`
          @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          @keyframes drop { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=IBM+Plex+Sans+KR:wght@300;400;600;700&display=swap');
          .floating-balloon::after { content: ''; position: absolute; left: -6px; top: 50%; transform: translateY(-50%); border-width: 6px 6px 6px 0; border-style: solid; border-color: transparent ${S.line} transparent transparent; }
       `}</style>
       <div className="card" style={{ background: "#fff", padding: 40, borderRadius: 20, boxShadow: S.shadow, width: 400 }}>
          <h2 style={{ marginBottom: 20 }}>{pg === "signup" ? "회원가입" : "비밀번호 찾기"}</h2>
          {pg === "signup" ? (
             <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {I({ placeholder: "이름", value: sf.name, onChange: e => setSf({ ...sf, name: e.target.value }) })}
                {I({ placeholder: "이메일", value: sf.email, onChange: e => setSf({ ...sf, email: e.target.value }) })}
                {I({ type: "password", placeholder: "비밀번호", value: sf.pw, onChange: e => setSf({ ...sf, pw: e.target.value }) })}
                {se && <p style={{ color: "red", fontSize: 12 }}>{se}</p>}
                <B primary onClick={signup}>가입하기</B>
                <button onClick={() => setPg("login")} style={{ background: "none", border: "none", color: S.muted, cursor: "pointer" }}>로그인으로 이동</button>
             </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
               <p style={{ fontSize: 14, color: S.muted }}>가입하신 이메일로 비밀번호 재설정 정보를 보내드립니다.</p>
               {I({ placeholder: "email@example.com", value: resetEmail, onChange: e => setResetEmail(e.target.value) })}
               <B primary onClick={requestReset}>초기화 메일 요청</B>
               <button onClick={() => setPg("login")} style={{ background: "none", border: "none", color: S.muted, cursor: "pointer" }}>로그인으로 이동</button>
            </div>
          )}
       </div>
    </div>
  );
}
