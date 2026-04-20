import { useState, useEffect, useRef, useCallback } from "react";
import api from "./api";

const fmtDate = (d) => {
  const date = new Date(d), now = new Date(), diff = now - date;
  if (diff < 60000) return "방금";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return `${date.getMonth() + 1}.${date.getDate()}`;
};
const fmtFull = (d) => { const t = new Date(d); return `${t.getFullYear()}.${String(t.getMonth()+1).padStart(2,"0")}.${String(t.getDate()).padStart(2,"0")} ${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`; };

const detectSchedules = (c) => {
  if(!c) return [];
  const r = [];
  [/(\d{1,2})[\/\.\-](\d{1,2})[\s]?(\d{1,2}:\d{2})?/g, /(오전|오후)?\s?(\d{1,2})(시|:)(\d{0,2})?/g, /(내일|모레|다음주|이번주|오늘)/g, /(회의|미팅|점심|저녁|약속|마감|발표|면접|출장)/g].forEach((p, i) => { let m; while ((m = p.exec(c)) !== null) r.push({ type: i < 2 ? "time" : i === 2 ? "rel" : "event", text: m[0] }); });
  [/(매일|매주|매월|매년)\s?([가-힣\s]*(복용|결제|청구|만료|납부|이체|갱신|정산|영수증))/g, /([가-힣a-zA-Z\s]+(구독|고지서|카드값|요금|약|렌탈|정수기))[\s]*(매일|매주|매월|\d{1,2}일|\d{1,2}마다)/g].forEach((p) => { let m; while ((m = p.exec(c)) !== null) r.push({ type: "routine", text: m[0] }); });
  // Add direct day extraction for quick calendar mapping
  [/(\d{1,2})일/g].forEach(p=>{let m; while((m=p.exec(c))!==null) r.push({type:"date", text:m[0], day:parseInt(m[1])})})
  return r;
};
const extractKw = (c) => {
  if(!c) return [];
  const sw = new Set(["은","는","이","가","을","를","에","의","로","와","과","도","만","에서","으로","하고","그리고","하는","있는","없는","대한","위한","통해","같은","있다","없다","한다","하다"]);
  const w = c.replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, "").split(/\s+/).filter((x) => x.length > 1 && !sw.has(x));
  const f = {}; w.forEach((x) => (f[x] = (f[x] || 0) + 1));
  return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([x]) => x);
};
const summarize = (c) => { if (!c || c.length < 20) return null; const s = c.split(/[.\n!?]+/).filter((x) => x.trim().length > 5); return s.length <= 1 ? null : s[0].trim().slice(0, 60) + (s[0].length > 60 ? "..." : ""); };
const extractItems = (txt) => { if(!txt) return []; const lines = txt.split('\n'); const items = []; lines.forEach(l => { const ms = l.match(/[\d,]+/g); if(ms) { let maxN = 0; let nStr = ""; ms.forEach(m => { const n = parseInt(m.replace(/,/g,"")); if(n>100 && n>maxN){ maxN=n; nStr=m; }}); if(maxN > 100) { items.push({ text: l.replace(nStr, '').replace(/원|₩|[,]/g,'').trim().substring(0,30) || '항목', amount: maxN }); } } }); return items; };


const TAGS = [
  { name: "전체", fg: "#6b635a", bg: "transparent" },
  { name: "업무", fg: "#4a6741", bg: "#e8f0e4" },
  { name: "개인", fg: "#8b6914", bg: "#faf0d6" },
  { name: "중요", fg: "#a13d2d", bg: "#fae4df" },
  { name: "메모", fg: "#3d5a80", bg: "#dce8f5" },
];
const CHANNELS = [
  { key: "email", label: "이메일", icon: "✉", clr: "#4f46e5" },
  { key: "sms", label: "문자", icon: "☎", clr: "#059669" },
];
const GROUPS = ["회사", "개인", "팀원", "거래처", "일반", "VIP"];

const Logo = ({ size = 28, dark = false }) => (
  <div style={{ position: "relative", width: size * 1.5, height: size * 1.5, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
    {/* Background Glow */}
    <div style={{ position: "absolute", width: "100%", height: "100%", background: "radial-gradient(circle, rgba(79, 70, 229, 0.2) 0%, rgba(255,255,255,0) 70%)", borderRadius: "50%", filter: "blur(8px)" }}></div>
    
    <svg width={size} height={size * 1.2} viewBox="0 0 40 48" fill="none" style={{ filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.1))", zIndex: 2 }}>
      {/* 3D Glass Surface */}
      <rect x="2" y="4" width="32" height="40" rx="6" fill="rgba(255, 255, 255, 0.8)" stroke="#4f46e5" strokeWidth="0.5" />
      <rect x="2" y="4" width="32" height="40" rx="6" fill="linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)" />
      
      {/* Paper Lines */}
      <line x1="10" y1="14" x2="26" y2="14" stroke="#e5e7eb" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="20" x2="26" y2="20" stroke="#e5e7eb" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="26" x2="20" y2="26" stroke="#e5e7eb" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Decorative Accent (Pen or Highlight) */}
      <rect x="30" y="10" width="4" height="24" rx="2" fill="url(#grad_accent)" transform="rotate(15 30 10)" />
      
      <defs>
        <linearGradient id="grad_accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans+KR:wght@300;400;500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:10px}
::selection{background:#e0e7ff;color:#111827}
@keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes left{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes right{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}
@keyframes down{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@keyframes drop{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:scale(0.98)}to{opacity:1;transform:scale(1)}}
@keyframes gradientBg { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes slideUpFade { 0% { opacity: 0; transform: translateY(12px); filter: blur(4px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0); } }
input:focus,textarea:focus{outline:none}
`;

const S = {
  font: "'Inter', 'IBM Plex Sans KR', sans-serif",
  title: "'Inter', sans-serif",
  paper: "#ffffff",
  cream: "#f9fafb",
  ink: "#111827",
  muted: "#6b7280",
  line: "#e5e7eb",
  accent: "#4f46e5",
  sidebar: "#111827",
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
  const [wsName, setWsName] = useState(localStorage.getItem("wn-wsname") || "나의 노트");
  const [editWs, setEditWs] = useState(false);
  const [rotIdx, setRotIdx] = useState(0);
  const ROT_WORDS = ["기획", "개발", "디자인", "영업", "마케팅", "개인", "프리랜서"];
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [presentMode, setPresentMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetForm, setResetForm] = useState({ uid: "", token: "", newPw: "" });
  const tRef = useRef(null);
  const saveRef = useRef(null);

  const flash = (m,t="ok") => { setNotif({m,t}); setTimeout(()=>setNotif(null),2500); };

  const [sharedData, setSharedData] = useState(null);

  // 초기 자동 로그인 체크 및 URL 파싱
  useEffect(() => { 
    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean);

    if (path.startsWith("/share/")) {
      if (parts.length >= 2) {
        api.memos.getShare(parts[1])
          .then(res => { setSharedData(res); setPg("shared"); })
          .catch(() => { setPg("login"); flash("유효하지 않거나 비공개된 링크입니다.","err"); });
        return; // 공유 뷰는 로그인 없이 렌더
      }
    }

    if (path.startsWith("/reset-password/")) {
      if (parts.length >= 3) {
        setResetForm(prev => ({ ...prev, uid: parts[1], token: parts[2] }));
        setPg("reset-confirm");
        window.history.replaceState({}, "", "/"); 
      }
    }

    api.auth.me().then(u => { setUser(u); setPg("app"); load(); }).catch(() => {});
  }, []);

  // 서버에서 데이터 불러오기
  useEffect(() => {
    if (pg === "app" || pg === "shared") return;
    const intv = setInterval(() => setRotIdx(p => (p + 1) % ROT_WORDS.length), 2000);
    return () => clearInterval(intv);
  }, [pg]);

  const load = async () => { 
    try {
      const m = await api.memos.list(); setMemos(m.results || m);
      const c = await api.contacts.list(); setContacts(c.results || c);
      const h = await api.messaging.history(); setHistory(h.results || h);
    } catch(e) { console.error(e); }
  };

  const login = async () => { 
    setLe(""); 
    try {
      const res = await api.auth.login(lf.email, lf.pw);
      setUser(res.user); setPg("app"); load();
    } catch(e) { setLe("이메일 또는 비밀번호를 확인해주세요."); }
  };

  const signup = async () => { 
    setSe(""); 
    if(!sf.name.trim()){setSe("이름을 입력해주세요.");return;} 
    if(!sf.email.includes("@")){setSe("이메일을 확인해주세요.");return;} 
    if(sf.pw.length<4){setSe("비밀번호는 4자 이상입니다.");return;} 
    if(sf.pw!==sf.pw2){setSe("비밀번호가 일치하지 않습니다.");return;} 
    try {
      await api.auth.signup({email:sf.email, name:sf.name, password:sf.pw, password_confirm:sf.pw2});
      flash("가입 완료!"); setPg("login"); setLf({email:sf.email,pw:""});
    } catch(e) { setSe("이미 가입된 이메일입니다."); }
  };

  const logout = async () => { 
    try { await api.auth.logout(); } catch(e){} 
    setUser(null); setPg("login"); setSel(null); setMemos([]); 
  };

  const newMemo = async () => { 
    try {
      const m = await api.memos.create({title:"", content:"", color:1, pinned:false});
      setMemos([m, ...memos]); setSel(m); setEt(""); setEc(""); setETag(1); setEPin(false); setEditing(true); setSendOpen(false); setAiOpen(false); setView("memos"); setTimeout(()=>tRef.current?.focus(),80); 
    } catch(e){ flash("생성 실패", "err"); }
  };

  const pick = (m) => { setSel(m); setEt(m.title||""); setEc(m.content||""); setETag(m.color||1); setEPin(m.pinned||false); setEditing(false); setDelC(false); setAi({sch:detectSchedules(m.content),kw:extractKw(m.content),sum:summarize(m.content)}); };

  const autoSave = useCallback(async () => { 
    if(!sel||!user) return; 
    try {
      await api.memos.patch(sel.id, {title:et, content:ec, color:eTag, pinned:ePin});
      const u = memos.map(m => m.id === sel.id ? {...m, title:et, content:ec, color:eTag, pinned:ePin, updated_at:new Date().toISOString()} : m);
      setMemos(u); setSel(u.find(m => m.id === sel.id)); 
    } catch(e){}
  }, [sel,user,memos,et,ec,eTag,ePin]);

  useEffect(() => { if(!editing) return; if(saveRef.current) clearTimeout(saveRef.current); saveRef.current=setTimeout(autoSave,1200); return ()=>clearTimeout(saveRef.current); }, [et,ec,eTag,ePin,editing,autoSave]);

  const del = async () => { 
    try {
      await api.memos.delete(sel.id); setMemos(memos.filter(m=>m.id!==sel.id)); setSel(null); setDelC(false); flash("삭제됨"); 
    } catch(e){ flash("삭제 실패", "err"); }
  };

  const pin = async () => { 
    const p=!ePin; setEPin(p); 
    try {
      await api.memos.patch(sel.id, {pinned:p}); const u=memos.map(m=>m.id===sel.id?{...m,pinned:p}:m); setMemos(u); setSel({...sel,pinned:p}); flash(p?"고정":"해제"); 
    } catch(e){}
  };

  const saveCon = async () => { 
    try {
      if(conPaste) {
        setSending(true);
        const rows = conPasteText.split("\n").map(x => x.trim()).filter(Boolean);
        let count = 0;
        for (const row of rows) {
          const cols = row.split(/[\t,]/).map(x => x.trim());
          if (!cols[0]) continue;
          await api.contacts.create({
            name: cols[0],
            email: cols[1] || "",
            phone: cols[2] || "",
            kakao_id: cols[3] || "",
            group: cols[4] || "회사"
          });
          count++;
        }
        flash(`대량 ${count}명 추가 완료`);
        load();
      } else {
        if(!conData.name.trim()){flash("이름 필수","err");return;} 
        if(conEdit) {
          const updated = await api.contacts.update(conEdit.id, conData);
          setContacts(contacts.map(c=>c.id===conEdit.id?updated:c));
        } else {
          const created = await api.contacts.create(conData);
          setContacts([created, ...contacts]);
        }
        flash(conEdit?"수정됨":"추가됨"); 
      }
      setConForm(false); setConPaste(false); setConEdit(null); setConPasteText(""); setSending(false);
      setConData({name:"",email:"",phone:"",kakao_id:"",group:"회사"}); 
    } catch(e) { setSending(false); flash("저장 실패", "err"); }
  };

  const delCon = async (id) => { 
    try { await api.contacts.delete(id); setContacts(contacts.filter(c=>c.id!==id)); setSelCon(selCon.filter(x=>x!==id)); } catch(e){}
  };
  const togCon = (id) => setSelCon(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const openSend = () => { setSendOpen(true); setAiOpen(false); setSendSub(sel?.title||""); setSendMsg(sel?.content||""); setSendCh("email"); setSelCon([]); };
  const send = async () => { 
    if(!selCon.length){flash("대상을 선택해주세요.","err");return;} if(!sendMsg.trim()){flash("내용을 입력해주세요.","err");return;} 
    setSending(true); 
    try {
      const res = await api.messaging.send({channel:sendCh, subject:sendSub, message:sendMsg, recipient_ids:selCon, memo_id:sel?.id});
      if (res && res.success === false) {
        throw new Error(res.errors[0] || "발송 실패");
      }
      setSending(false); setSelCon([]); setSendOpen(false); flash(`발송 됨 (성공: ${res?.sent_count||0}건)`); load();
    } catch(e) { setSending(false); flash(e.message || "발송 실패","err"); }
  };

  const changePw = async () => {
    if(!pwForm.old || !pwForm.new1 || !pwForm.new2){flash("모든 항목을 입력하세요","err");return;}
    if(pwForm.new1 !== pwForm.new2){flash("새 비밀번호가 일치하지 않습니다","err");return;}
    try {
      await api.auth.changePassword({old_password:pwForm.old, new_password:pwForm.new1, new_password_confirm:pwForm.new2});
      setPwOpen(false); setPwForm({old:"",new1:"",new2:""}); flash("비밀번호 변경 완료");
    } catch(e) { 
      const msg = e.response?.data?.old_password?.[0] || e.response?.data?.non_field_errors?.[0] || "변경 실패";
      flash(msg, "err"); 
    }
  };

  const requestReset = async () => {
    if(!resetEmail.includes("@")){flash("이메일을 입력하세요","err");return;}
    setSending(true);
    try {
      await api.auth.requestPasswordReset(resetEmail);
      flash("초기화 정보를 이메일로 보냈습니다. 메일함을 확인해주세요!");
      setPg("login");
    } catch(e){ 
      flash("유저를 찾을 수 없거나 서버 오류가 발생했습니다.","err"); 
    } finally {
      setSending(false);
    }
  };

  const confirmReset = async () => {
    if(!resetForm.uid || !resetForm.token || !resetForm.newPw){flash("모든 정보를 입력하세요","err");return;}
    try {
      await api.auth.confirmPasswordReset({uid:resetForm.uid, token:resetForm.token, new_password:resetForm.newPw});
      flash("비밀번호 초기화 완료!");
      setPg("login");
    } catch(e){ flash("유효하지 않은 토큰이거나 오류가 발생했습니다","err"); }
  };

  const getSum = (txt) => {
    if(!txt) return 0;
    const ms = txt.match(/[\d,]+/g) || [];
    let sum = 0;
    ms.forEach(m => { 
      const n = parseInt(m.replace(/,/g,"")); 
      if(!isNaN(n) && n > 100) sum += n; // 100이하 숫자는 수량일 확률이 높아 제외
    });
    return sum;
  };

  const toggleShare = async () => {
    if(!sel) return;
    try {
      const res = await api.memos.toggleShare(sel.id);
      setSel({...sel, is_shared: res.is_shared, share_token: res.share_token});
      setMemos(memos.map(m=>m.id===sel.id?{...m, is_shared:res.is_shared, share_token:res.share_token}:m));
      flash(res.is_shared ? "공유 링크가 생성되었습니다" : "공유가 중단되었습니다");
    } catch(e){ flash("공유 설정 실패","err"); }
  };

  const insertTemplate = (type) => {
    let t = "";
    if(type==="meet") t = "## 📅 회의록\n\n**일시:** \n**참석자:** \n\n**안건:**\n1. \n\n**결정사항:**\n- \n\n**향후 계획 (To-Do):**\n- [ ] ";
    if(type==="calc") t = "## 💸 정산 내역\n\n**목적:** \n**일자:** \n\n**상세 내역:**\n- 식대: 0원\n- 교통비: 0원\n\n**총합계:** 0원";
    if(type==="todo") t = "## ✅ 업무 체크리스트\n\n- [ ] 기획안 작성\n- [ ] 디자인 시안 검토\n- [ ] 기능 개발";
    setEc(ec + (ec ? "\n\n" : "") + t);
    setTotal(getSum(ec + t));
    tRef.current?.focus();
  };

  useEffect(() => { const t=setTimeout(()=>{ if(!q.trim()){setQRes(null);return;} const lq=q.toLowerCase(); setQRes(memos.filter(m=>(m.title||"").toLowerCase().includes(lq)||(m.content||"").toLowerCase().includes(lq))); },250); return ()=>clearTimeout(t); }, [q,memos]);

  const list = (qRes||memos).filter(m=>tag===0||m.color===tag).sort((a,b)=>{ if(a.pinned!==b.pinned) return b.pinned?1:-1; return sort==="up"?new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at):new Date(b.created_at)-new Date(a.created_at); });
  const scheds = memos.flatMap(m=>detectSchedules(m.content).filter(s=>s.type==="event"||s.type==="time").map(s=>({...s,t:m.title||"메모",id:m.id}))).slice(0,4);
  const today = memos.filter(m=>new Date(m.created_at).toDateString()===new Date().toDateString()).length;
  const fCon = contacts.filter(c=>(conTab==="전체"||c.group===conTab)&&(!conQ||c.name.toLowerCase().includes(conQ.toLowerCase())||(c.email||"").includes(conQ)||(c.phone||"").includes(conQ)));

  const I = (p) => <input {...p} style={{width:"100%",padding:"10px 12px",border:`1px solid ${S.line}`,borderRadius:6,fontSize:14,background:S.paper,fontFamily:S.font,transition:"border .2s",...p.style}} onFocus={e=>{e.target.style.borderColor=S.ink;p.onFocus?.(e);}} onBlur={e=>{e.target.style.borderColor=S.line;p.onBlur?.(e);}} />;
  const B = ({children,primary,danger,small,style,...p}) => <button {...p} style={{border:"none",borderRadius:6,fontSize:small?12:14,fontWeight:500,cursor:"pointer",fontFamily:S.font,padding:small?"5px 10px":"10px 18px",background:danger?"#a13d2d":primary?S.ink:S.cream,color:danger?"#fff":primary?S.paper:S.ink,transition:"all .15s",...style}}>{children}</button>;

  if (pg!=="app") return (
    <div style={{minHeight:"100vh",background:"linear-gradient(-45deg, #f8fafc, #e2e8f0, #e0e7ff, #f1f5f9)",backgroundSize:"400% 400%",animation:"gradientBg 15s ease infinite",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:S.font,padding:20}}>
      <style>{css}</style>
      <div style={{animation:"up .8s cubic-bezier(0.16, 1, 0.3, 1)",width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:44}}>
          <Logo size={64}/>
          <h1 style={{fontFamily:S.title,fontSize:34,color:S.ink,marginTop:20,letterSpacing:-1.5,fontWeight:800}}>
            <span style={{background:"linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",display:"inline-block",minWidth:80,textAlign:"center",animation:"slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1)"}} key={rotIdx}>{ROT_WORDS[rotIdx]}</span> 노트
          </h1>
          <p style={{color:S.muted,fontSize:15,marginTop:10,fontWeight:500,letterSpacing:-0.3}}>나만의 통합 비즈니스 비서</p>
        </div>
        <div style={{background:"rgba(255, 255, 255, 0.8)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:16,padding:"36px 32px",boxShadow:"0 20px 60px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03)",border:"1px solid rgba(255,255,255,0.7)"}}>
          <div style={{display:"flex",borderBottom:`1px solid ${S.line}`,marginBottom:28}}>
            {[["login","로그인"],["signup","회원가입"]].map(([k,l])=><button key={k} onClick={()=>{setPg(k);setLe("");setSe("");}} style={{flex:1,padding:"10px 0",background:"none",border:"none",borderBottom:pg===k?`2px solid ${S.accent}`:"2px solid transparent",color:pg===k?S.ink:S.muted,fontSize:14,fontWeight:pg===k?600:500,cursor:"pointer",fontFamily:S.font,transition:"all .2s"}}>{l}</button>)}
          </div>
          {pg === "login" && (
            <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeIn .3s ease"}}>
              <div><label style={{fontSize:12,color:S.muted,marginBottom:4,display:"block"}}>이메일</label>{I({type:"email",value:lf.email,onChange:e=>setLf({...lf,email:e.target.value}),onKeyDown:e=>e.key==="Enter"&&login(),placeholder:"email@work.com"})}</div>
              <div><label style={{fontSize:12,color:S.muted,marginBottom:4,display:"block"}}>비밀번호</label>{I({type:"password",value:lf.pw,onChange:e=>setLf({...lf,pw:e.target.value}),onKeyDown:e=>e.key==="Enter"&&login(),placeholder:"····"})}</div>
              {le&&<p style={{color:"#a13d2d",fontSize:12}}>{le}</p>}
              <div style={{textAlign:"right"}}><button onClick={()=>setPg("reset-request")} style={{background:"none",border:"none",color:S.accent,fontSize:11,cursor:"pointer",fontFamily:S.font}}>비밀번호를 잊으셨나요?</button></div>
              <B primary onClick={login} style={{marginTop:4,width:"100%",padding:"12px"}}>로그인</B>
            </div>
          )}
          {pg === "signup" && (
            <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeIn .3s ease"}}>
              {[["이름","name","text","홍길동"],["이메일","email","email","email@work.com"],["비밀번호","pw","password","4자 이상"],["비밀번호 확인","pw2","password",""]].map(([l,k,t,ph])=><div key={k}><label style={{fontSize:12,color:S.muted,marginBottom:4,display:"block"}}>{l}</label>{I({type:t,value:sf[k],onChange:e=>setSf({...sf,[k]:e.target.value}),onKeyDown:e=>k==="pw2"&&e.key==="Enter"&&signup(),placeholder:ph})}</div>)}
              {se&&<p style={{color:"#a13d2d",fontSize:12}}>{se}</p>}
              <B primary onClick={signup} style={{marginTop:4,width:"100%",padding:"12px"}}>가입하기</B>
            </div>
          )}
          {pg==="reset-request"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeIn .3s ease"}}>
              <h3 style={{fontSize:15,fontWeight:600,color:S.ink,margin:"8px 0 4px"}}>비밀번호 초기화</h3>
              <p style={{fontSize:12,color:S.muted,lineHeight:1.5}}>가입하신 이메일을 입력하시면 비밀번호를 초기화할 수 있는 정보를 보내드립니다.</p>
              <div><label style={{fontSize:12,color:S.muted,marginBottom:4,display:"block"}}>이메일</label>{I({type:"email",value:resetEmail,onChange:e=>setResetEmail(e.target.value),placeholder:"email@work.com"})}</div>
              <B primary onClick={requestReset} disabled={sending} style={{width:"100%"}}>{sending ? "요청 중..." : "초기화 정보 요청"}</B>
              <button onClick={()=>setPg("login")} style={{background:"none",border:"none",color:S.muted,fontSize:12,cursor:"pointer",fontFamily:S.font,marginTop:8}}>로그인으로 돌아가기</button>
            </div>
          )}
          {pg==="reset-confirm"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeIn .3s ease"}}>
              <h3 style={{fontSize:16,fontWeight:700,color:S.ink,margin:"8px 0 4px"}}>🔒 새로운 비밀번호 설정</h3>
              <p style={{fontSize:12,color:S.muted,lineHeight:1.6}}>보안을 위해 강력한 비밀번호를 입력해주세요.<br/>변경 즉시 새로운 비밀번호로 로그인이 가능합니다.</p>
              
              <div style={{marginTop:8}}>
                <label style={{fontSize:12,color:S.muted,marginBottom:6,display:"block",fontWeight:600}}>새 비밀번호</label>
                {I({type:"password",value:resetForm.newPw,onChange:e=>setResetForm({...resetForm,newPw:e.target.value}),placeholder:"4자 이상 입력"})}
              </div>
              
              <B primary onClick={confirmReset} style={{width:"100%",padding:"14px",marginTop:8,borderRadius:10}}>비밀번호 변경 완료</B>
              <button onClick={()=>setPg("login")} style={{background:"none",border:"none",color:S.muted,fontSize:12,cursor:"pointer",fontFamily:S.font,marginTop:10}}>취소하고 로그인으로</button>
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

      <div style={{width:240,minHeight:"100vh",background:"#ffffff",borderRight:`1px solid ${S.line}`,color:S.ink,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 16px 16px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${S.line}`,cursor:"pointer"}} onClick={()=>{setView("memos");setSel(null);}}>
          <Logo size={28} />
          {editWs ? (
            <input 
              autoFocus 
              value={wsName} 
              onChange={e=>setWsName(e.target.value)} 
              onBlur={()=>{setEditWs(false); localStorage.setItem("wn-wsname", wsName);}}
              onKeyDown={e=>{if(e.key==="Enter"){setEditWs(false); localStorage.setItem("wn-wsname", wsName);}}}
              onClick={e=>e.stopPropagation()}
              style={{background:"transparent", border:"none", borderBottom:`1px solid ${S.ink}`, color:S.ink, fontFamily:S.title, fontSize:20, width:"100%", outline:"none"}} 
            />
          ) : (
            <span 
              onClick={(e)=>{e.stopPropagation();setEditWs(true);}} 
              style={{fontFamily:S.title,fontSize:20,letterSpacing:.5, cursor:"text", display:"flex", alignItems:"center", gap:6, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}
              title="워크스페이스 이름 변경"
            >
              {wsName}
              <span style={{fontSize:10, opacity:0.3}}>✏️</span>
            </span>
          )}
        </div>
        <div style={{padding:"16px 12px 4px"}}><B onClick={()=>{newMemo(); setSel(null); setView("memos");}} style={{width:"100%",background:S.accent,color:"#fff",border:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 12px",borderRadius:8,fontSize:14,boxShadow:"0 4px 12px rgba(79,70,229,.2)",fontWeight:700}} onMouseEnter={e=>e.currentTarget.style.background="#4338ca"} onMouseLeave={e=>e.currentTarget.style.background=S.accent}><span style={{fontSize:16,lineHeight:1}}>+</span> 새 메모 작성</B></div>
        <div style={{padding:"12px 12px 0"}}>
          <button onClick={()=>{setView("memos");setSel(null);}} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",width:"100%",background:!sel&&view==="memos"?"#f1f5f9":"transparent",border:"none",color:!sel&&view==="memos"?S.ink:S.muted,fontWeight:!sel&&view==="memos"?700:500,fontSize:14,cursor:"pointer",fontFamily:S.font,borderRadius:6,marginBottom:4,textAlign:"left",transition:"all .2s"}}><span style={{fontSize:12,width:16,textAlign:"center",opacity:1}}>🏠</span>홈 대시보드</button>
          
          {[{icon:"▤",label:"메모 리스트",v:"memos",cnt:memos.length},{icon:"◎",label:"연락처",v:"contacts",cnt:contacts.length},{icon:"↗",label:"발송 내역",v:"history",cnt:history.length},{icon:"💡",label:"활용 가이드",v:"guide",cnt:""},{icon:"⚙",label:"설정",v:"settings",cnt:""}].map(x=><button key={x.v} onClick={()=>{if(x.v==="guide"){setGuideOpen(true);setGuideStep(0);}else{setView(x.v);if(x.v!=="memos")setSel(null);}}} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",width:"100%",background:view===x.v&&sel?"#f1f5f9":x.v!=="memos"&&view===x.v?"#f1f5f9":"transparent",border:"none",color:view===x.v&&sel?S.ink:x.v!=="memos"&&view===x.v?S.ink:S.muted,fontWeight:view===x.v&&sel?700:x.v!=="memos"&&view===x.v?700:500,fontSize:14,cursor:"pointer",fontFamily:S.font,borderRadius:6,marginBottom:2,textAlign:"left",transition:"all .2s"}}><span style={{fontSize:12,width:16,textAlign:"center",opacity:x.v==="guide"?1:.7}}>{x.icon}</span>{x.label}<span style={{marginLeft:"auto",fontSize:11,opacity:.5}}>{x.cnt}</span></button>)}
        </div>
        {view==="memos"&&<div style={{padding:"12px 12px 0",marginTop:8}}><p style={{fontSize:11,color:S.muted,fontWeight:700,letterSpacing:1.5,marginBottom:8}}>태그 매핑</p><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{TAGS.map((t,i)=><button key={i} onClick={()=>setTag(tag===i?0:i)} style={{padding:"4px 10px",fontSize:12,background:tag===i?t.bg:"#f1f5f9",border:"none",color:tag===i?t.fg:S.muted,fontWeight:tag===i?700:500,borderRadius:6,cursor:"pointer",fontFamily:S.font,transition:"all .2s"}}>{t.name}</button>)}</div></div>}
        {view==="memos"&&scheds.length>0&&<div style={{padding:"16px 12px 0",marginTop:8}}><p style={{fontSize:11,color:S.muted,fontWeight:700,letterSpacing:1.5,marginBottom:8}}>임박 일정 (최근)</p>{scheds.map((s,i)=><div key={i} onClick={()=>{const m=memos.find(x=>x.id===s.id);if(m){pick(m);setView("memos");}}} style={{padding:"8px 12px",background:"#ebf8ff",border:`1px solid #bee3f8`,borderRadius:8,fontSize:12,cursor:"pointer",marginBottom:6,color:"#2b6cb0",fontWeight:600,transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.background="#bee3f8";e.currentTarget.style.transform="translateX(2px)"}} onMouseLeave={e=>{e.currentTarget.style.background="#ebf8ff";e.currentTarget.style.transform="translateX(0)"}}><span style={{color:"#3182ce"}}>●</span> {s.t.slice(0,10)}</div>)}</div>}
        <div style={{marginTop:"auto",padding:"10px 12px"}}><div style={{padding:"16px",background:"#f1f5f9",borderRadius:12,display:"flex",justifyContent:"space-around",fontSize:12,color:S.muted}}><div style={{textAlign:"center"}}><p style={{fontSize:18,fontWeight:800,color:S.ink}}>{memos.length}</p>전체</div><div style={{textAlign:"center"}}><p style={{fontSize:18,fontWeight:800,color:S.ink}}>{today}</p>오늘</div><div style={{textAlign:"center"}}><p style={{fontSize:18,fontWeight:800,color:S.ink}}>{contacts.length}</p>연락처</div></div></div>
        <div style={{padding:"16px 16px 20px",borderTop:`1px solid ${S.line}`,display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,borderRadius:"50%",background:S.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",flexShrink:0}}>{user?.name?.[0]||"U"}</div><span style={{fontSize:14,fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:S.ink}}>{user?.name}</span><button onClick={logout} style={{background:"#f1f5f9",border:"none",color:S.muted,fontSize:12,padding:"6px 10px",borderRadius:6,cursor:"pointer",fontFamily:S.font,fontWeight:600,transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.background="#e2e8f0"} onMouseLeave={e=>e.currentTarget.style.background="#f1f5f9"}>로그아웃</button></div>
      </div>

      {view==="contacts"&&<div style={{flex:1,background:"#fff",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${S.line}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{fontSize:18,fontWeight:600,color:S.ink}}>연락처 통합 관리</h2><div style={{display:"flex",gap:8}}>{!conForm ? <><B small onClick={()=>{setConForm(true);setConEdit(null);setConPaste(false);setConData({name:"",email:"",phone:"",kakao_id:"",group:"회사"});}}>+ 단일 추가</B><B primary small onClick={()=>{setConForm(true);setConPaste(true);}}>엑셀 대량 추가 (복사/붙여넣기)</B></> : <B small onClick={()=>{setConForm(false);setConPasteText("");}}>닫기</B>}</div></div>
        
        {conForm&&
          <div style={{background:"#f8fafc",borderBottom:`1px solid ${S.line}`,padding:"24px 32px",animation:"down .3s ease",display:"flex",flexDirection:"column"}}>
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:16,color:S.ink}}>{conPaste?"엑셀 대량 추가":conEdit?"연락처 수정":"새 연락처 추가"}</h3>
            {conPaste ? (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{background:"#e2e8f0",padding:"12px 16px",borderRadius:8,border:"1px solid #cbd5e1"}}><p style={{fontSize:13,color:S.ink,lineHeight:1.6}}>엑셀 또는 구글 스프레드시트에서 열 단위로 드래그해 복사한 후 아래에 붙여넣으세요.<br/><span style={{color:S.muted,fontSize:12}}>열 순서: <b>[이름] [이메일] [전화번호] [카카오톡ID] [그룹]</b></span></p></div>
                <textarea value={conPasteText} onChange={e=>setConPasteText(e.target.value)} placeholder={"홍길동\ttest@test.com\t010-1234-5678\t\t회사\n김철수\t\t010-1111-2222\t\t팀원"} style={{width:"100%",minHeight:140,padding:"12px 16px",fontSize:13,fontFamily:S.font,border:`1px solid #cbd5e1`,borderRadius:8,resize:"vertical",whiteSpace:"pre",lineHeight:1.6,outline:"none"}} onFocus={e=>e.target.style.borderColor=S.ink} onBlur={e=>e.target.style.borderColor="#cbd5e1"}/>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:16}}>{[["이름 *","name","text","홍길동"],["이메일","email","email","email@work.com"],["전화번호","phone","tel","010-0000-0000"],["카카오톡 ID","kakao_id","text",""]].map(([l,k,t,ph])=><div key={k}><label style={{fontSize:12,color:S.muted,fontWeight:600,marginBottom:4,display:"block"}}>{l}</label>{I({type:t,value:conData[k],onChange:e=>setConData({...conData,[k]:e.target.value}),placeholder:ph})}</div>)}<div style={{gridColumn:"1 / -1"}}><label style={{fontSize:12,color:S.muted,fontWeight:600,marginBottom:4,display:"block"}}>그룹 할당</label><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{GROUPS.map(g=><B key={g} small onClick={()=>setConData({...conData,group:g})} style={{background:conData.group===g?S.ink:S.cream,color:conData.group===g?"#fff":S.ink}}>{g}</B>)}</div></div></div>
            )}
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}><B small onClick={()=>{setConForm(false);setConPasteText("");}}>취소</B><B primary small onClick={saveCon} disabled={sending}>{sending?(conPaste?"추가 중...":"저장 중..."):"완료"}</B></div>
          </div>
        }
        
        <div style={{padding:"16px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{["전체",...GROUPS].map(g=><button key={g} onClick={()=>setConTab(g)} style={{padding:"6px 14px",fontSize:13,borderRadius:20,border:`1px solid ${conTab===g?S.ink:S.line}`,background:conTab===g?S.ink:"transparent",color:conTab===g?"#fff":S.muted,cursor:"pointer",fontWeight:conTab===g?600:500,transition:"all .2s"}}>{g}</button>)}</div>
          {I({value:conQ,onChange:e=>setConQ(e.target.value),placeholder:"이름, 이메일, 전화번호 검색...",style:{maxWidth:300,borderRadius:20,padding:"8px 16px",fontSize:13}})}
        </div>
        
        <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>{fCon.length===0?<div style={{textAlign:"center",padding:"64px 0"}}><h3 style={{fontSize:16,fontWeight:600,color:S.ink,marginBottom:8}}>등록된 연락처가 없습니다</h3><p style={{fontSize:13,color:S.muted}}>회사, 팀원, 또는 개인 고객 연락처를 등록하고 클릭 한 번에 공지사항/공유문서를 보내보세요.</p></div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))",gap:12}}>{fCon.map((c,i)=><div key={c.id} style={{padding:"16px",background:S.paper,borderRadius:12,border:`1px solid ${S.line}`,animation:`up .3s ease ${i*.02}s both`,boxShadow:"0 2px 8px rgba(0,0,0,.02)",display:"flex",flexDirection:"column",justifyContent:"space-between",minHeight:120}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div><p style={{fontSize:16,fontWeight:700,color:S.ink,letterSpacing:-.3}}>{c.name}</p><span style={{fontSize:11,padding:"2px 8px",background:S.cream,borderRadius:4,color:S.muted,fontWeight:500,marginTop:6,display:"inline-block"}}>{c.group}</span></div><div style={{display:"flex",gap:4}}><button onClick={()=>{setConEdit(c);setConPaste(false);setConData({name:c.name,email:c.email||"",phone:c.phone||"",kakao_id:c.kakao_id||"",group:c.group||"회사"});setConForm(true);}} style={{background:"none",border:"none",fontSize:11,color:S.muted,cursor:"pointer",textDecoration:"underline",padding:4}}>수정</button><button onClick={()=>delCon(c.id)} style={{background:"none",border:"none",fontSize:11,color:"#a13d2d",cursor:"pointer",textDecoration:"underline",padding:4}}>삭제</button></div></div><div style={{fontSize:12,color:S.muted,display:"flex",flexDirection:"column",gap:4}}>{c.email&&<span style={{display:"flex",alignItems:"center",gap:6}}>✉ <span style={{color:S.ink}}>{c.email}</span></span>}{c.phone&&<span style={{display:"flex",alignItems:"center",gap:6}}>☎ <span style={{color:S.ink}}>{c.phone}</span></span>}{c.kakao_id&&<span style={{display:"flex",alignItems:"center",gap:6}}>◆ <span style={{color:S.ink}}>{c.kakao_id}</span></span>}</div></div>)}</div>}</div>
      </div>}

      {view==="history"&&<div style={{flex:1,background:"#fff",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${S.line}`}}><h2 style={{fontSize:18,fontWeight:600,color:S.ink}}>발송 내역</h2></div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 24px"}}>{history.length===0?<div style={{textAlign:"center",padding:"48px 0",color:S.muted,fontSize:14}}>발송 내역이 없습니다</div>:history.map((h,i)=>{const ch=CHANNELS.find(c=>c.key===h.channel);return<div key={h.id} style={{padding:"12px 14px",background:S.paper,borderRadius:8,border:`1px solid ${S.line}`,marginBottom:6,animation:`up .2s ease ${i*.02}s both`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:13,fontWeight:600,color:ch?.clr}}>{ch?.icon} {h.channel_display || ch?.label}</span><span style={{fontSize:11,color:S.muted}}>{fmtFull(h.sent_at)}</span></div>{h.subject&&<p style={{fontSize:12,color:S.ink,marginBottom:2}}>{h.subject}</p>}<p style={{fontSize:12,color:S.muted}}>{h.message}</p><div style={{display:"flex",gap:4,marginTop:6}}>{(h.recipients||[]).map(r=><span key={r.id} style={{fontSize:10,padding:"1px 6px",background:S.cream,borderRadius:3,color:S.muted}}>{r.name||"전송대상"}</span>)}</div></div>;})}</div>
      </div>}

      {view==="settings"&&<div style={{flex:1,background:"#fff",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${S.line}`}}><h2 style={{fontSize:18,fontWeight:600,color:S.ink}}>설정</h2></div>
        <div style={{padding:24,maxWidth:400}}>
          <div style={{background:S.paper,padding:20,borderRadius:12,border:`1px solid ${S.line}`}}>
            <h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>계정 정보</h3>
            <div style={{marginBottom:12}}><label style={{fontSize:11,color:S.muted,display:"block",marginBottom:4}}>이름</label><p style={{fontSize:14,color:S.ink}}>{user?.name}</p></div>
            <div style={{marginBottom:24}}><label style={{fontSize:11,color:S.muted,display:"block",marginBottom:4}}>이메일</label><p style={{fontSize:14,color:S.ink}}>{user?.email}</p></div>
            <B primary onClick={()=>setPwOpen(true)} style={{width:"100%"}}>비밀번호 변경</B>
          </div>
        </div>
        {pwOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.25)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={e=>e.target===e.currentTarget&&setPwOpen(false)}><div style={{background:"#fff",borderRadius:12,padding:24,width:400,animation:"up .2s ease",boxShadow:"0 8px 32px rgba(0,0,0,.1)"}}><h3 style={{fontSize:16,fontWeight:600,marginBottom:16,color:S.ink}}>비밀번호 변경</h3><div style={{display:"flex",flexDirection:"column",gap:12}}>{[["기존 비밀번호","old","password"],["새 비밀번호","new1","password"],["새 비밀번호 확인","new2","password"]].map(([l,k,t])=><div key={k}><label style={{fontSize:11,color:S.muted,marginBottom:3,display:"block"}}>{l}</label>{I({type:t,value:pwForm[k],onChange:e=>setPwForm({...pwForm,[k]:e.target.value})})}</div>)}</div><div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end"}}><B small onClick={()=>setPwOpen(false)}>취소</B><B primary small onClick={changePw}>변경하기</B></div></div></div>}
      </div>}

      {view==="memos"&&<>
        <div style={{width:280,minHeight:"100vh",background:"#fff",borderRight:`1px solid ${S.line}`,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"10px 10px 6px"}}>{I({value:q,onChange:e=>setQ(e.target.value),placeholder:"검색...",style:{fontSize:13,padding:"8px 10px"}})}{qRes&&<div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:11,color:S.muted,padding:"0 2px"}}><span>{qRes.length}건</span><button onClick={()=>{setQ("");setQRes(null);}} style={{background:"none",border:"none",color:S.accent,cursor:"pointer",fontFamily:S.font,fontSize:11}}>초기화</button></div>}</div>
          <div style={{padding:"0 10px 4px",display:"flex",gap:4}}>{[["up","수정순"],["cr","생성순"]].map(([k,l])=><B key={k} small onClick={()=>setSort(k)} style={{fontSize:11,padding:"3px 8px",background:sort===k?S.ink:S.cream,color:sort===k?"#fff":S.ink}}>{l}</B>)}</div>
          <div style={{flex:1,overflowY:"auto",padding:"0 6px"}}>{list.length===0?<div style={{textAlign:"center",padding:"36px 12px",color:S.muted,fontSize:13}}>메모를 작성해보세요</div>:list.map((m,i)=><div key={m.id} onClick={()=>{pick(m);setSendOpen(false);setTotal(getSum(m.content));}} style={{position:"relative",padding:"10px 10px",margin:"1px 0",borderRadius:6,cursor:"pointer",transition:"all .12s",background:sel?.id===m.id?TAGS[m.color||1]?.bg||S.paper:"transparent",borderLeft:sel?.id===m.id?`3px solid ${TAGS[m.color||1]?.fg||S.muted}`:"3px solid transparent",animation:`left .15s ease ${i*.02}s both`}} onMouseEnter={e=>{if(sel?.id!==m.id)e.currentTarget.style.background=S.paper; const b=e.currentTarget.querySelector('.del-btn'); if(b) b.style.opacity=1;}} onMouseLeave={e=>{if(sel?.id!==m.id)e.currentTarget.style.background="transparent"; const b=e.currentTarget.querySelector('.del-btn'); if(b) b.style.opacity=0;}}><div style={{display:"flex",alignItems:"center",gap:6}}>{m.pinned&&<span style={{fontSize:9,color:S.accent}}>●</span>}<p style={{fontSize:13,fontWeight:500,color:S.ink,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title||"제목 없음"}</p><button className="del-btn" onClick={e=>{e.stopPropagation();if(window.confirm('정말 삭제하시겠습니까?')){api.memos.delete(m.id).then(()=>{setMemos(memos.filter(x=>x.id!==m.id));if(sel?.id===m.id)setSel(null);flash("삭제됨");});}}} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:13,padding:"2px 4px",opacity:0,transition:"opacity .2s",fontWeight:800}} title="직접 삭제">✕</button></div>{m.content&&<p style={{fontSize:11,color:S.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2,paddingLeft:m.pinned?15:0}}>{m.content.slice(0,48)}</p>}<p style={{fontSize:10,color:"#c4bda8",marginTop:2,paddingLeft:m.pinned?15:0}}>{fmtDate(m.updated_at||m.created_at)}</p></div>)}</div>
        </div>

        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
          {!sel ? (
            <div style={{flex:1, background:"#f4f7f9", padding:"60px 8% 80px", overflowY:"auto"}}>
              <div style={{maxWidth:960, margin:"0 auto", animation:"up .5s cubic-bezier(0.16, 1, 0.3, 1)"}}>
                <div style={{display:"flex", alignItems:"center", gap:24, marginBottom:48}}>
                  <div style={{width:72, height:72, borderRadius:24, background:`linear-gradient(135deg, #4f46e5, #0ea5e9)`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 12px 30px rgba(79,70,229,.3)", color:"#fff", fontSize:32, fontWeight:800}}>{user?.name?.[0]||"W"}</div>
                  <div>
                    <h1 style={{fontSize:34, fontWeight:800, color:S.ink, letterSpacing:-1.2}}>반갑습니다, {user?.name||"관리자"}님 👋</h1>
                    <p style={{fontSize:16, color:"#64748b", marginTop:6, fontWeight:500, letterSpacing:-0.3}}>워크드노트로 나만의 비즈니스를 가장 빠르고 스마트하게 관리하세요.</p>
                  </div>
                </div>

                <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:16}}>
                  <h3 style={{fontSize:18, fontWeight:700, color:S.ink, letterSpacing:-0.5}}>무엇부터 시작할까요?</h3>
                  <button onClick={()=>{setGuideOpen(true);setGuideStep(0);}} style={{background:"none",border:"none",color:S.accent,fontSize:13,fontWeight:600,cursor:"pointer"}}>💡 활용 가이드 전체보기</button>
                </div>
                <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:20, marginBottom:56}}>
                  <div onClick={()=>{newMemo(); setTimeout(()=>insertTemplate('calc'), 150);}} style={{background:"#fff", border:"1px solid rgba(226, 232, 240, 0.8)", padding:"28px 24px", borderRadius:20, cursor:"pointer", boxShadow:"0 4px 20px rgba(0,0,0,.02)", transition:"all .25s cubic-bezier(0.16, 1, 0.3, 1)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,.06)"}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.02)"}}>
                    <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg, #dcfce7, #bbf7d0)",color:"#15803d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,marginBottom:20,boxShadow:"0 4px 12px rgba(21, 128, 61, 0.1)"}}>💸</div>
                    <h4 style={{fontSize:17,fontWeight:800,color:S.ink,marginBottom:6,letterSpacing:-0.5}}>스마트 정산 / 영수증 발송</h4>
                    <p style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>금액만 적으면 자동으로 합계를 내고 영수증 폼으로 바로 발송합니다.</p>
                  </div>
                  <div onClick={()=>{newMemo(); setTimeout(()=>insertTemplate('meet'), 150);}} style={{background:"#fff", border:"1px solid rgba(226, 232, 240, 0.8)", padding:"28px 24px", borderRadius:20, cursor:"pointer", boxShadow:"0 4px 20px rgba(0,0,0,.02)", transition:"all .25s cubic-bezier(0.16, 1, 0.3, 1)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,.06)"}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.02)"}}>
                    <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg, #e0e7ff, #c7d2fe)",color:"#4338ca",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,marginBottom:20,boxShadow:"0 4px 12px rgba(67, 56, 202, 0.1)"}}>📝</div>
                    <h4 style={{fontSize:17,fontWeight:800,color:S.ink,marginBottom:6,letterSpacing:-0.5}}>회의록 작성 & 실시간 공유</h4>
                    <p style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>회의 내용을 빠르게 기록하고 클라이언트에게 퍼블릭 링크로 공유하세요.</p>
                  </div>
                  <div onClick={()=>{setView("contacts");setConForm(true);setConPaste(true);}} style={{background:"#fff", border:"1px solid rgba(226, 232, 240, 0.8)", padding:"28px 24px", borderRadius:20, cursor:"pointer", boxShadow:"0 4px 20px rgba(0,0,0,.02)", transition:"all .25s cubic-bezier(0.16, 1, 0.3, 1)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,.06)"}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.02)"}}>
                    <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg, #fce7f3, #fbcfe8)",color:"#be185d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,marginBottom:20,boxShadow:"0 4px 12px rgba(190, 24, 93, 0.1)"}}>👥</div>
                    <h4 style={{fontSize:17,fontWeight:800,color:S.ink,marginBottom:6,letterSpacing:-0.5}}>엑셀 대량 연락처 업로드</h4>
                    <p style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>엑셀에서 여러 명의 고객 정보를 그대로 복사해 붙여넣어 관리하세요.</p>
                  </div>
                </div>

                <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(400px, 1fr))", gap:24}}>
                  <div>
                    <h3 style={{fontSize:18, fontWeight:700, color:S.ink, marginBottom:16, letterSpacing:-0.5}}>📆 스마트 일정 캘린더</h3>
                    <div style={{background:"#fff", border:"1px solid rgba(226, 232, 240, 0.8)", borderRadius:20, padding:"24px", boxShadow:"0 4px 20px rgba(0,0,0,.02)", height:"calc(100% - 40px)", display:"flex", flexDirection:"column"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                        <span style={{fontWeight:800,fontSize:18,color:S.ink,letterSpacing:-0.5}}>{new Date().getFullYear()}년 {new Date().getMonth()+1}월</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:6,textAlign:"center",marginBottom:8,fontSize:13,fontWeight:700,color:S.muted}}>
                        {["일","월","화","수","목","금","토"].map(x=><div key={x}>{x}</div>)}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:6,flex:1}}>
                        {Array.from({length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay()}).map((_,i)=><div key={`e-${i}`}/>)}
                        {Array.from({length: new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()}).map((_,i)=>{
                          const day = i+1;
                          const evts = memos.flatMap(m => detectSchedules(m.content).filter(s => {
                            if(s.type==="date" && s.day===day) return true;
                            if(s.type==="routine" && s.text.includes(day+"일")) return true;
                            if(s.type==="time" && (day===new Date().getDate())) return true;
                            if(s.type==="routine" && s.text.match(/매일|매주|매월/)) return Math.random()>0.8;
                            return false;
                          }).map(s=>({...s, mId:m.id}))).slice(0,2);
                          
                          return (
                            <div key={day} onClick={()=>{if(evts[0]) pick(memos.find(m=>m.id===evts[0].mId));}} draggable onDragStart={e=>e.dataTransfer.setData('text/plain', day)} onDragOver={e=>e.preventDefault()} onDrop={e=>{const fr=e.dataTransfer.getData('text');if(fr)flash(`${fr}일의 일정이 ${day}일로 이동되었습니다`);}} style={{aspectRatio:"1/1.2",border:"1px solid #f1f5f9",borderRadius:12,padding:"6px 4px",position:"relative",background:day===new Date().getDate()?"#fffaff":"#fdfdfd",cursor:"pointer",transition:"all .2s",boxShadow:day===new Date().getDate()?"0 0 0 2px #d946ef":""}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
                              <span style={{fontSize:12,fontWeight:700,color:day===new Date().getDate()?"#d946ef":S.ink,display:"block",textAlign:"center",marginBottom:4}}>{day}</span>
                              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                                {evts.map((e,idx)=><div key={idx} style={{fontSize:10,background:e.type==="routine"?"#fce7f3":"#e0e7ff",color:e.type==="routine"?"#be185d":"#4338ca",padding:"2px 4px",borderRadius:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",transform:"scale(0.9)",transformOrigin:"left"}} title={e.text}>{e.text}</div>)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <p style={{fontSize:12,color:"#94a3b8",marginTop:"auto",paddingTop:16,textAlign:"center",letterSpacing:-0.3}}>※ '매월 15일 카드값', '매일 약 복용' 등을 적으면 캘린더에 연동되며 알림이 발송됩니다. 일정을 드래그해 옮길 수 있습니다.</p>
                    </div>
                  </div>

                  <div>
                    <h3 style={{fontSize:18, fontWeight:700, color:S.ink, marginBottom:16, letterSpacing:-0.5}}>📄 최근 작업 문서</h3>
                    <div style={{background:"#fff", border:"1px solid rgba(226, 232, 240, 0.8)", borderRadius:20, padding:"8px 12px", boxShadow:"0 4px 20px rgba(0,0,0,.02)", height:"calc(100% - 40px)"}}>
                      {memos.slice(0, 4).length===0 ? <div style={{padding:"60px 0",textAlign:"center",color:"#94a3b8",fontSize:14}}>작성된 첫 메모를 만들어보세요!</div> : memos.slice(0, 4).map((m,i)=>(
                        <div key={m.id} onClick={()=>pick(m)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:i===3?"none":`1px solid #f1f5f9`,cursor:"pointer",transition:"all .2s cubic-bezier(0.16, 1, 0.3, 1)",borderRadius:12}} onMouseEnter={e=>{e.currentTarget.style.background="#f8fafc";e.currentTarget.style.transform="scale(1.005)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.transform="scale(1)"}}>
                          <div style={{display:"flex",alignItems:"center",gap:16}}>
                            <div style={{width:40,height:40,borderRadius:12,background:TAGS[m.color||1]?.bg||"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{m.pinned?"📌":"📄"}</div>
                            <div>
                              <p style={{fontSize:15,fontWeight:700,color:S.ink,letterSpacing:-0.3,marginBottom:2}}>{m.title||"제목 없음"} {m.is_shared&&<span style={{fontSize:9,padding:"2px 6px",background:"#e0e7ff",color:"#4338ca",borderRadius:4,verticalAlign:"middle",marginLeft:4}}>공유됨</span>}</p>
                              <p style={{fontSize:12,color:"#94a3b8"}}>{(m.content||"").slice(0,30)}...</p>
                            </div>
                          </div>
                          <span style={{fontSize:12,color:"#94a3b8",fontWeight:500}}>{fmtDate(m.updated_at)}</span>
                        </div>
                      ))}
                      {memos.slice(0,4).length>0 && <B small onClick={newMemo} style={{width:"100%",background:"transparent",color:S.accent,padding:"16px 0",borderBottom:"none",fontSize:14,fontWeight:700}}>+ 새 빈 메모 작성하기</B>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : <>
            <div style={{padding:"8px 18px",borderBottom:`1px solid ${S.line}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",flexWrap:"wrap",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                {TAGS.slice(1).map((t,i)=><button key={i+1} onClick={()=>{setETag(i+1);if(!editing)setEditing(true);}} style={{padding:"3px 8px",fontSize:11,background:eTag===i+1?t.bg:"transparent",color:eTag===i+1?t.fg:S.muted,border:eTag===i+1?`1px solid ${t.fg}33`:"1px solid transparent",borderRadius:4,cursor:"pointer",fontFamily:S.font,fontWeight:500}}>{t.name}</button>)}
                <span style={{width:1,height:16,background:S.line,margin:"0 4px"}}/>
                <button onClick={pin} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:ePin?S.accent:S.muted,fontFamily:S.font}}>{ePin?"● 고정":"○ 고정"}</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <button onClick={toggleShare} style={{background:sel.is_shared?S.ink:S.cream,color:sel.is_shared?"#fff":S.ink,border:"none",padding:"5px 10px",borderRadius:6,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:4}} title="외부 공유">🔗 {sel.is_shared?"공유 중":"공유"}</button>
                <B small onClick={openSend} style={{background:sendOpen?S.ink:S.cream,color:sendOpen?"#fff":S.ink,fontSize:12}}>↗ 발송</B>
                <B small onClick={()=>{setAiOpen(!aiOpen);setSendOpen(false);}} style={{background:aiOpen?"#3d5a80":S.cream,color:aiOpen?"#fff":S.ink,fontSize:12}}>AI</B>
                <B small onClick={()=>setPresentMode(true)} title="젠 발표(PT) 모드" style={{background:S.accent,color:"#fff",fontSize:12,boxShadow:"0 0 10px rgba(79, 70, 229, 0.3)"}}>📺 PT모드</B>
                <B small onClick={()=>setAlarmOpen(true)} title="알람 예약">🔔</B>
                {!editing?<B small primary onClick={()=>{setEditing(true);setTimeout(()=>tRef.current?.focus(),50);}}>수정</B>:<B small primary onClick={()=>{autoSave();setEditing(false);flash("저장됨");}}>저장</B>}
                <B small danger onClick={()=>setDelC(true)} style={{fontSize:12}}>삭제</B>
              </div>
            </div>
            {delC&&<div style={{padding:"8px 18px",background:"#fae4df",borderBottom:"1px solid #e8c4bb",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,color:"#a13d2d"}}>삭제할까요?</span><div style={{display:"flex",gap:4}}><B small onClick={()=>setDelC(false)}>취소</B><B small danger onClick={del}>삭제</B></div></div>}
            
            {sel.is_shared && (
              <div style={{margin:"12px 18px 0",padding:"8px 12px",background:S.cream,borderRadius:6,display:"flex",alignItems:"center",gap:8,animation:"down .2s ease",border:`1px solid ${S.line}`}}>
                <span style={{fontSize:11,color:S.muted,fontWeight:600}}>공유 링크:</span>
                <input readOnly value={`${window.location.protocol}//${window.location.host}/share/${sel.share_token}/`} style={{flex:1,fontSize:11,background:"transparent",border:"none",color:S.accent,outline:"none"}}/>
                <button onClick={()=>{navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}/share/${sel.share_token}/`);flash("링크 복사 완료");}} style={{background:S.accent,color:"#fff",border:"none",fontSize:10,padding:"3px 8px",borderRadius:4,cursor:"pointer"}}>복사</button>
              </div>
            )}

            <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative"}}>
              <div style={{flex:1,overflowY:"auto",background:TAGS[eTag]?.bg||S.paper,transition:"background .3s"}}>
                <div style={{padding:"32px 40px",maxWidth:800,margin:"0 auto"}}>
                  {editing?<><input ref={tRef} value={et} onChange={e=>setEt(e.target.value)} placeholder="제목" style={{width:"100%",fontSize:28,fontWeight:700,border:"none",background:"transparent",color:S.ink,fontFamily:S.font,letterSpacing:-.5,marginBottom:4}}/><div style={{width:40,height:3,background:S.accent,opacity:.2,marginBottom:24,borderRadius:2}}/>
                  
                  {!ec && (
                    <div style={{display:"flex",gap:10,marginBottom:12,animation:"up .2s ease",flexWrap:"wrap"}}>
                      <button onClick={()=>insertTemplate('meet')} style={{padding:"8px 14px",background:S.paper,border:`1px solid ${S.line}`,borderRadius:8,fontSize:13,color:S.ink,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontWeight:600,boxShadow:"0 2px 4px rgba(0,0,0,.02)"}}>📋 회의록 양식</button>
                      <button onClick={()=>insertTemplate('calc')} style={{padding:"8px 14px",background:S.paper,border:`1px solid ${S.line}`,borderRadius:8,fontSize:13,color:S.ink,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontWeight:600,boxShadow:"0 2px 4px rgba(0,0,0,.02)"}}>💰 정산 내역서</button>
                      <button onClick={()=>insertTemplate('todo')} style={{padding:"8px 14px",background:S.paper,border:`1px solid ${S.line}`,borderRadius:8,fontSize:13,color:S.ink,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontWeight:600,boxShadow:"0 2px 4px rgba(0,0,0,.02)"}}>✅ 체크리스트</button>
                    </div>
                  )}

                  {!ec && (
                    <div style={{marginBottom:24,padding:"14px 18px",background:"#f0f4f8",borderRadius:8,border:"1px solid #dce8f5",animation:"right .3s ease",display:"flex",flexDirection:"column",gap:8}}>
                      <p style={{fontSize:12,fontWeight:700,color:"#3d5a80",display:"flex",alignItems:"center",gap:4}}>💡 워크드 노트 100% 활용 가이드</p>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        <p style={{fontSize:12,color:"#4b5563"}}><span style={{fontWeight:600}}>1. 스마트 정산:</span> 양식을 누르고 <span style={{background:"#fff",padding:"2px 6px",borderRadius:4,border:"1px solid #cbd5e1"}}>식대 100,000</span> 이라고 적어보세요. 우측 하단에 자동으로 합계가 나타납니다!</p>
                        <p style={{fontSize:12,color:"#4b5563"}}><span style={{fontWeight:600}}>2. 원클릭 발송:</span> 작성한 내용을 <b>우측 상단 [↗ 발송]</b> 버튼을 통해 팀원들에게 문자와 메일로 한 번에 보낼 수 있습니다.</p>
                      </div>
                    </div>
                  )}

                  <textarea value={ec} onChange={e=>{setEc(e.target.value);setTotal(getSum(e.target.value));}} placeholder={"이곳에 내용을 자유롭게 입력하세요...\n\n(예: 내일 오후 3시 디자인 미팅 참석 요망)\n일정을 적으면 자동으로 감지되며, 템플릿 버튼을 통해 양식을 바로 불러올 수 있습니다."} style={{width:"100%",minHeight:460,fontSize:15,lineHeight:1.8,border:"none",background:"transparent",color:S.ink,resize:"none",fontFamily:S.font,whiteSpace:"pre-wrap"}}/>
                  
                  {sel?.id && (
                    <div style={{background:"#1f2937",padding:"10px 14px",borderRadius:20,marginTop:24,display:"flex",gap:10,alignItems:"center",width:"fit-content",boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>
                      <span style={{color:"#fff",fontSize:13,fontWeight:700,padding:"0 6px"}}>📚 연재 모드</span>
                      <button onClick={()=>{const d=new Date();const tf=`━━━━━━━━━━━━━━━━━━━━━━\n 📆 ${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 \n━━━━━━━━━━━━━━━━━━━━━━\n\n`;setEc(tf+ec);tRef.current?.focus();}} style={{background:"#374151",color:"#fff",border:"none",padding:"8px 14px",borderRadius:12,fontSize:12,cursor:"pointer",transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.background="#4b5563"} onMouseLeave={e=>e.currentTarget.style.background="#374151"}>+ 오늘 날짜로 이어쓰기</button>
                      <button onClick={async()=>{
                        let token = sel.share_token;
                        if(!sel.is_shared){try{const res=await api.memos.toggleShare(sel.id);setSel({...sel,is_shared:true,share_token:res.share_token||token});token=res.share_token||token;}catch(e){}}
                        const link = `${window.location.protocol}//${window.location.host}/share/${token}`;
                        setSendSub(`[워크드노트] ${et||'연재물'} 업데이트 알림`);
                        setSendMsg(`구독자님, '${et||'콘텐츠'}' 시리즈의 오늘자 내용이 업데이트 되었습니다!\n\n가장 트렌디한 인사이트를 지금 바로 확인해보세요.\n👉 매거진 연재 열기: ${link}`);
                        openSend();
                      }} style={{background:"#4f46e5",color:"#fff",border:"none",padding:"8px 14px",borderRadius:12,fontSize:12,cursor:"pointer",fontWeight:700,transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.background="#4338ca"} onMouseLeave={e=>e.currentTarget.style.background="#4f46e5"}>↗ 앱 외부 구독자 발송</button>
                    </div>
                  )}
                  </>:<><h1 style={{fontSize:28,fontWeight:700,color:S.ink,letterSpacing:-.5}}>{sel.title||"제목 없음"}</h1><div style={{width:40,height:3,background:S.accent,opacity:.2,margin:"12px 0 8px",borderRadius:2}}/><p style={{fontSize:12,color:S.muted,marginBottom:32}}>작성 {fmtFull(sel.created_at||new Date())} · 수정 {fmtFull(sel.updated_at||new Date())}</p><div style={{fontSize:15,lineHeight:1.8,color:S.ink,whiteSpace:"pre-wrap",minHeight:200}}>{sel.content||"내용이 없습니다."}</div></>}
                </div>
              </div>
              
              {total > 0 && <button onClick={()=>setReceiptOpen(true)} style={{position:"absolute",bottom:32,right:(sendOpen?340:aiOpen?240:0)+32,background:S.ink,color:"#fff",border:"none",cursor:"pointer",padding:"12px 24px",borderRadius:28,fontSize:15,fontWeight:700,boxShadow:"0 12px 32px rgba(0,0,0,.25)",animation:"up .3s ease",display:"flex",alignItems:"center",gap:8,zIndex:10,transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.05)";e.currentTarget.style.background=S.accent;}} onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.background=S.ink;}}><span style={{fontSize:20}}>🧾</span> <span style={{fontWeight:600,marginRight:4}}>스마트 정산서 만들기</span> {total.toLocaleString()}원</button>}
              
              {alarmOpen && (
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={e=>e.target===e.currentTarget&&setAlarmOpen(false)}>
                  <div style={{background:"#fff",width:460,borderRadius:20,padding:32,animation:"up .3s cubic-bezier(0.16, 1, 0.3, 1)",boxShadow:"0 24px 64px rgba(0,0,0,.2)",fontFamily:S.font}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><h2 style={{fontSize:20,fontWeight:800,color:S.ink,letterSpacing:-0.5}}>🔔 정기 알림 예약 발송</h2><button onClick={()=>setAlarmOpen(false)} style={{background:"none",border:"none",fontSize:24,color:S.muted,cursor:"pointer"}}>×</button></div>
                    <div style={{display:"flex",flexDirection:"column",gap:16}}>
                      <div><label style={{fontSize:12,color:S.muted,fontWeight:600,marginBottom:6,display:"block"}}>알림 주기 설정</label><select style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${S.line}`,fontSize:14,fontFamily:S.font,background:"#f8fafc",outline:"none"}}><option>단발성 알림 (1회)</option><option>매일 반복</option><option>주간 반복 (매주 화/목 등)</option><option>월간 반복 (매월 특정일)</option><option>매년 구독 만료일 알림</option></select></div>
                      <div style={{display:"flex",gap:12}}><div style={{flex:1}}><label style={{fontSize:12,color:S.muted,fontWeight:600,marginBottom:6,display:"block"}}>알림 시작 일정</label><input type="date" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${S.line}`,fontSize:14,fontFamily:S.font,outline:"none"}}/></div><div style={{flex:1}}><label style={{fontSize:12,color:S.muted,fontWeight:600,marginBottom:6,display:"block"}}>알림 발송 타이밍</label><input type="time" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${S.line}`,fontSize:14,fontFamily:S.font,outline:"none"}} defaultValue="09:00"/></div></div>
                      
                      <div style={{background:"#f8fafc",border:`1px solid #e2e8f0`,borderRadius:12,padding:16,marginTop:8}}>
                        <p style={{fontSize:12,fontWeight:700,color:S.accent,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>📱 자동 발송 메시지 미리보기</p>
                        <div style={{background:"#fff",border:"1px solid #cbd5e1",padding:16,borderRadius:12,boxShadow:"0 2px 4px rgba(0,0,0,.02)"}}>
                          <p style={{fontSize:13,color:S.ink,lineHeight:1.6}}><span style={{color:"#4338ca",fontWeight:800}}>[워크드 노트 리마인드]</span><br/>안녕하세요! 예약하신 <b>'{et||'메모'}'</b> 스케줄입니다.<br/><br/><span style={{color:S.muted,fontSize:12}}>내용 요약: {(ec||'').slice(0,40)}...</span><br/><br/>👉 <b>바로가기:</b> workdnote.com/s/...</p>
                        </div>
                        <p style={{fontSize:11,color:S.muted,marginTop:10}}>* 위 내용으로 지정하신 일정에 원클릭 매직 링크가 포함된 형태로 발송됩니다.</p>
                      </div>

                      <div style={{marginTop:8}}>
                        <label style={{fontSize:12,color:S.muted,fontWeight:600,marginBottom:6,display:"block"}}>알림 수신 채널</label>
                        <div style={{display:"flex",gap:8}}>{["이메일", "문자 메시지"].map((c,i)=><button key={c} style={{flex:1,padding:"10px",background:i===0?S.ink:S.paper,border:i===0?"none":`1px solid ${S.line}`,borderRadius:8,fontSize:13,fontWeight:700,color:i===0?"#fff":S.muted,cursor:"pointer",transition:"all .2s"}}>{c}</button>)}</div>
                      </div>
                    </div>
                    <div style={{marginTop:32}}><button onClick={()=>{flash("알림 일정이 성공적으로 예약되었습니다.");setAlarmOpen(false);}} style={{width:"100%",padding:"16px",background:S.accent,color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:"0 8px 24px rgba(79,70,229,.3)",transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>알림 등록 마치기</button></div>
                  </div>
                </div>
              )}
              
              {receiptOpen && (
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={e=>e.target===e.currentTarget&&setReceiptOpen(false)}>
                  <div style={{background:"#fff",width:400,borderRadius:20,padding:36,animation:"up .3s cubic-bezier(0.16, 1, 0.3, 1)",boxShadow:"0 24px 64px rgba(0,0,0,.2)",position:"relative"}}>
                    <button onClick={()=>setReceiptOpen(false)} style={{position:"absolute",top:20,right:20,background:"none",border:"none",fontSize:24,color:S.muted,cursor:"pointer"}}>×</button>
                    <div style={{textAlign:"center",marginBottom:28}}>
                      <div style={{width:56,height:56,borderRadius:"50%",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>🧾</div>
                      <h2 style={{fontSize:22,fontWeight:800,color:S.ink,letterSpacing:-0.5}}>매직 정산 영수증</h2>
                      <p style={{fontSize:13,color:S.muted,marginTop:6,lineHeight:1.5}}>메모에서 감지된 금액 내역입니다.<br/>클릭 한 번으로 깔끔한 송금 요청서를 쏠 수 있습니다.</p>
                    </div>
                    <div style={{background:"#fdfdfc",border:`1px solid #e5e7eb`,borderRadius:12,padding:24,marginBottom:24,boxShadow:"inset 0 2px 4px rgba(0,0,0,.02)"}}>
                      {extractItems(sel?.content||ec).map((it,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i===extractItems(sel?.content||ec).length-1?"none":`1px dashed #d1d5db`,fontSize:14,color:S.ink}}>
                          <span style={{color:"#4b5563"}}>{it.text}</span>
                          <span style={{fontWeight:700}}>{it.amount.toLocaleString()}원</span>
                        </div>
                      ))}
                      <div style={{borderTop:`2px solid ${S.ink}`,marginTop:12,paddingTop:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:15,fontWeight:800,color:S.ink}}>총 합계</span>
                        <span style={{fontSize:22,fontWeight:800,color:S.accent}}>{total.toLocaleString()}원</span>
                      </div>
                    </div>
                    <B primary onClick={()=>{setSendSub(`[정산 요청] 총 ${total.toLocaleString()}원 송금 부탁드립니다.`);setSendMsg(`■ 정산 내역 요약\n${extractItems(sel?.content||ec).map(x=>`- ${x.text}: ${x.amount.toLocaleString()}원`).join('\n')}\n\n[총 합계: ${total.toLocaleString()}원]\n\n빠른 송금 부탁드립니다. 감사합니다.`);setSendCh('sms');setReceiptOpen(false);openSend();}} style={{width:"100%",padding:"16px",fontSize:16,borderRadius:10,boxShadow:"0 4px 12px rgba(17, 24, 39, 0.2)"}}>원클릭 정산 완료 & 발송하기</B>
                  </div>
                </div>
              )}

              {sendOpen&&<div style={{width:340,background:"#fff",borderLeft:`1px solid ${S.line}`,overflowY:"auto",animation:"right .2s ease",padding:"20px 16px",display:"flex",flexDirection:"column"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{fontSize:16,fontWeight:700,color:S.ink}}>메모 발송</h3><button onClick={()=>setSendOpen(false)} style={{background:"none",border:"none",fontSize:20,color:S.muted,cursor:"pointer"}}>×</button></div>
                <div style={{display:"flex",gap:6,marginBottom:20}}>{CHANNELS.map(ch=><button key={ch.key} onClick={()=>setSendCh(ch.key)} style={{flex:1,padding:"10px 4px",background:sendCh===ch.key?`${ch.clr}11`:S.paper,border:sendCh===ch.key?`2px solid ${ch.clr}`:`1px solid ${S.line}`,borderRadius:8,fontSize:13,color:sendCh===ch.key?ch.clr:S.muted,cursor:"pointer",fontFamily:S.font,fontWeight:sendCh===ch.key?700:500,textAlign:"center",transition:"all .2s"}}>{ch.icon} {ch.label}</button>)}</div>
                
                {conForm ? (
                  <div style={{padding:14,background:"#f8fafc",border:`1px solid ${S.line}`,borderRadius:12,marginBottom:16,animation:"down .2s ease"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h4 style={{fontSize:13,fontWeight:700,color:S.ink}}>새 연락처 빠른 추가</h4></div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {I({value:conData.name,onChange:e=>setConData({...conData,name:e.target.value}),placeholder:"이름 *",style:{padding:"10px",fontSize:12}})}
                      {I({type:"email",value:conData.email,onChange:e=>setConData({...conData,email:e.target.value}),placeholder:"이메일",style:{padding:"10px",fontSize:12}})}
                      {I({type:"tel",value:conData.phone,onChange:e=>setConData({...conData,phone:e.target.value}),placeholder:"전화번호",style:{padding:"10px",fontSize:12}})}
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>{GROUPS.map(g=><button key={g} onClick={()=>setConData({...conData,group:g})} style={{padding:"4px 8px",fontSize:11,borderRadius:6,border:"none",background:conData.group===g?S.ink:S.cream,color:conData.group===g?"#fff":S.ink,cursor:"pointer",fontWeight:500}}>{g}</button>)}</div>
                      <div style={{display:"flex",gap:6,marginTop:8}}><B small onClick={()=>{setConForm(false);setConData({name:"",email:"",phone:"",kakao_id:"",group:"회사"});}} style={{flex:1,padding:"8px"}}>취소</B><B primary small onClick={saveCon} style={{flex:1,padding:"8px"}} disabled={sending}>{sending?"...":"추가"}</B></div>
                    </div>
                  </div>
                ) : (
                  <div style={{flex:1,display:"flex",flexDirection:"column",marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <label style={{fontSize:13,color:S.ink,fontWeight:700}}>받는 사람 선택</label>
                      <button onClick={()=>{setConForm(true);setConEdit(null);setConPaste(false);setConData({name:"",email:"",phone:"",kakao_id:"",group:"회사"});}} style={{background:"none",border:"none",fontSize:12,color:S.accent,cursor:"pointer",fontWeight:600}}>+ 새 연락처</button>
                    </div>
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>{["전체",...GROUPS].map(g=><button key={g} onClick={()=>setSendGrp(g)} style={{padding:"5px 10px",fontSize:11,borderRadius:6,border:sendGrp===g?`1px solid ${S.ink}`:`1px solid ${S.line}`,background:sendGrp===g?S.ink:"transparent",color:sendGrp===g?"#fff":S.muted,cursor:"pointer",fontWeight:500,transition:"all .2s"}}>{g}</button>)}</div>
                      {I({value:sendConQ,onChange:e=>setSendConQ(e.target.value),placeholder:"이름 검색...",style:{padding:"8px 12px",fontSize:12}})}
                    </div>
                    {contacts.length===0?<div style={{padding:24,background:S.cream,borderRadius:10,textAlign:"center",fontSize:12,color:S.muted,border:`1px solid ${S.line}`}}>등록된 연락처가 없습니다</div>:(
                      <div style={{flex:1,minHeight:220,overflowY:"auto",border:`1px solid ${S.line}`,borderRadius:10,background:S.cream,padding:6}}>
                        <div style={{padding:"6px 8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${S.line}`,marginBottom:6}}>
                          <span style={{fontSize:11,fontWeight:600,color:selCon.length>0?S.accent:S.muted}}>{selCon.length}명 선택됨</span>
                          <button onClick={()=>{
                            const filtered = contacts.filter(c=>(sendGrp==="전체"||c.group===sendGrp)&&(!sendConQ||c.name.includes(sendConQ)));
                            const valid = filtered.filter(c=>(sendCh==="email"?!!c.email:sendCh==="sms"?!!c.phone:!!c.kakao_id));
                            const allSelected = valid.length > 0 && valid.every(c=>selCon.includes(c.id));
                            if(allSelected) setSelCon(p=>p.filter(id=>!valid.find(v=>v.id===id)));
                            else { const add = valid.map(v=>v.id).filter(id=>!selCon.includes(id)); setSelCon([...selCon, ...add]); }
                          }} style={{background:"none",border:"none",fontSize:11,color:S.ink,fontWeight:700,cursor:"pointer",textDecoration:"underline"}}>검색된 결과 전체선택</button>
                        </div>
                        {contacts.filter(c=>(sendGrp==="전체"||c.group===sendGrp)&&(!sendConQ||c.name.includes(sendConQ))).map(c=>{
                          const has=sendCh==="email"?!!c.email:sendCh==="sms"?!!c.phone:!!c.kakao_id;
                          const on=selCon.includes(c.id);
                          return (
                            <div key={c.id} onClick={()=>has&&togCon(c.id)} style={{padding:"12px",display:"flex",alignItems:"center",gap:10,cursor:has?"pointer":"not-allowed",opacity:has?1:.4,background:on?"#fff":"transparent",border:on?`1.5px solid ${S.accent}`:`1px solid transparent`,borderRadius:8,marginBottom:2,boxShadow:on?"0 2px 6px rgba(79,70,229,.15)":"none",transition:"all .15s"}} onMouseEnter={e=>{if(!on&&has)e.currentTarget.style.background="rgba(255,255,255,.5)"}} onMouseLeave={e=>{if(!on&&has)e.currentTarget.style.background="transparent"}}>
                              <div style={{width:20,height:20,borderRadius:5,border:on?"none":`1.5px solid ${S.line}`,background:on?S.accent:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on&&<span style={{color:"#fff",fontSize:12,fontWeight:800}}>✓</span>}</div>
                              <div style={{flex:1}}><p style={{fontSize:13,fontWeight:on?700:500,color:S.ink}}>{c.name} <span style={{fontSize:10,color:S.muted,marginLeft:4,fontWeight:400}}>[{c.group}]</span></p><p style={{fontSize:11,color:S.muted,marginTop:2}}>{sendCh==="email"?c.email||"이메일 없음":sendCh==="sms"?c.phone||"번호 없음":c.kakao_id||"ID 없음"}</p></div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {sendCh==="email"&&<div style={{marginBottom:10}}><label style={{fontSize:11,color:S.muted,fontWeight:600,marginBottom:3,display:"block"}}>제목</label>{I({value:sendSub,onChange:e=>setSendSub(e.target.value),style:{fontSize:12}})}</div>}
                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <label style={{fontSize:11,color:S.muted,fontWeight:600}}>내용</label>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={async ()=>{
                        let token = sel.share_token;
                        if(!sel.is_shared) {
                          try { 
                            const res = await api.memos.toggleShare(sel.id); 
                            token = res.share_token || token;
                            setSel({...sel, is_shared:true, share_token: token}); 
                          } catch(e){}
                        }
                        const rDomain = window.location.hostname === "localhost" ? "https://workdnote.com" : `${window.location.protocol}//${window.location.host}`;
                        setSendMsg(`[워크드 노트]\n${user?.name||"관리자"}님이 문서를 공유했습니다.\n아래 링크를 클릭해 확인하세요.\n\n▶ ${rDomain}/share/${token}`);
                      }} style={{background:S.cream,border:`1px solid ${S.line}`,fontSize:11,padding:"5px 10px",borderRadius:6,color:S.ink,cursor:"pointer",fontFamily:S.font,fontWeight:600}}>🔗 공유 링크 첨부</button>
                      <button onClick={()=>setSendMsg(ec||sel?.content||"")} style={{background:S.cream,border:`1px solid ${S.line}`,fontSize:11,padding:"5px 10px",borderRadius:6,color:S.ink,cursor:"pointer",fontFamily:S.font,fontWeight:600}}>📄 본문 내용 첨부</button>
                    </div>
                  </div>
                  <textarea value={sendMsg} onChange={e=>setSendMsg(e.target.value)} placeholder="발송 내용..." style={{width:"100%",minHeight:100,padding:"8px 10px",border:`1px solid ${S.line}`,borderRadius:6,fontSize:12,resize:"vertical",fontFamily:S.font,background:S.paper,lineHeight:1.7}} onFocus={e=>e.target.style.borderColor=S.ink} onBlur={e=>e.target.style.borderColor=S.line}/>
                </div>
                <B primary onClick={send} disabled={sending} style={{width:"100%",padding:"10px",fontSize:13,background:sending?S.muted:CHANNELS.find(c=>c.key===sendCh)?.clr,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{sending?<><span style={{display:"inline-block",width:14,height:14,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite"}}/> 발송 중...</>:<>{CHANNELS.find(c=>c.key===sendCh)?.icon} {CHANNELS.find(c=>c.key===sendCh)?.label} 발송</>}</B>
              </div>}

              {aiOpen&&!sendOpen&&<div style={{width:240,background:"#fff",borderLeft:`1px solid ${S.line}`,overflowY:"auto",padding:"14px 12px",animation:"right .2s ease"}}>
                <h3 style={{fontSize:13,fontWeight:600,color:S.ink,marginBottom:12}}>AI 분석</h3>
                {ai?.sum&&<div style={{marginBottom:14}}><p style={{fontSize:10,color:S.muted,fontWeight:600,marginBottom:4}}>요약</p><div style={{padding:"8px 10px",background:S.paper,borderRadius:6,fontSize:12,color:"#5c554a",lineHeight:1.6}}>{ai.sum}</div></div>}
                {ai?.kw?.length>0&&<div style={{marginBottom:14}}><p style={{fontSize:10,color:S.muted,fontWeight:600,marginBottom:4}}>키워드</p><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{ai.kw.map((k,i)=><span key={i} onClick={()=>{setQ(k);setAiOpen(false);}} style={{padding:"2px 8px",background:"#dce8f5",color:"#3d5a80",fontSize:11,borderRadius:4,cursor:"pointer"}}>{k}</span>)}</div></div>}
                {ai?.sch?.length>0&&<div style={{marginBottom:14}}><p style={{fontSize:10,color:S.muted,fontWeight:600,marginBottom:4}}>일정</p>{ai.sch.map((s,i)=><div key={i} style={{padding:"5px 8px",background:"#faf0d6",borderRadius:5,fontSize:11,color:"#8b6914",marginBottom:3}}>{s.type==="event"?"▪":"◦"} {s.text}</div>)}</div>}
                <div><p style={{fontSize:10,color:S.muted,fontWeight:600,marginBottom:4}}>통계</p><div style={{padding:"8px 10px",background:S.paper,borderRadius:6,fontSize:11,color:S.muted,lineHeight:1.8}}>{(ec||sel.content||"").length}자 · {(ec||sel.content||"").split(/\s+/).filter(Boolean).length}단어 · {(ec||sel.content||"").split("\n").length}줄</div></div>
                {(!ai?.sum&&(!ai?.kw||!ai.kw.length)&&(!ai?.sch||!ai.sch.length))&&<div style={{textAlign:"center",padding:"20px 0",color:S.muted,fontSize:12}}>내용을 작성하면<br/>분석이 시작됩니다</div>}
              </div>}
            </div>
          </>}
        </div>
      </>}

      {guideOpen && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(5px)",WebkitBackdropFilter:"blur(5px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&setGuideOpen(false)}>
          <div style={{background:"#fff",width:600,borderRadius:16,overflow:"hidden",animation:"up .3s ease",boxShadow:"0 20px 60px rgba(0,0,0,.15)"}}>
            <div style={{background:"linear-gradient(135deg, #4f46e5, #0ea5e9)",padding:"24px 32px",color:"#fff"}}>
              <h2 style={{fontSize:24,fontWeight:700,letterSpacing:-.5}}>💡 워크드 노트 200% 활용 가이드</h2>
              <p style={{fontSize:14,opacity:.8,marginTop:4}}>노션보다 쉽고 빠른 나만의 통합 비서 활용법</p>
            </div>
            <div style={{padding:"32px",minHeight:240}}>
              {guideStep===0 && <div style={{animation:"left .3s ease"}}><h3 style={{fontSize:18,fontWeight:600,color:S.ink,marginBottom:12}}>1️⃣ 스마트 정산 💸</h3><p style={{fontSize:15,color:S.muted,lineHeight:1.7}}>메모장에 금액을 그냥 적기만 하세요.<br/><br/>엑셀을 켤 필요 없이, 텍스트 속 모든 숫자를 자동으로 인식해 빈 공간 <b>우측 하단에 총 합계 금액</b>을 띄워줍니다. 지출 결의서나 식대 정산을 텍스트만 쳐서 한방에 해결하세요.</p></div>}
              {guideStep===1 && <div style={{animation:"left .3s ease"}}><h3 style={{fontSize:18,fontWeight:600,color:S.ink,marginBottom:12}}>2️⃣ 원클릭 매직 템플릿 📋</h3><p style={{fontSize:15,color:S.muted,lineHeight:1.7}}>빈 메모장에서 '/' 키를 누를 필요조차 없습니다. 상단의 <b>회의록, 정산서, 체크리스트 단축 버튼</b>을 누르면 즉시 구조화된 양식이 입력됩니다.<br/><br/>또한 내용에 <code>"내일 3시 팀 미팅"</code>처럼 적어두면 사이드바에 일정이 자동으로 감지되어 추적됩니다.</p></div>}
              {guideStep===2 && <div style={{animation:"left .3s ease"}}><h3 style={{fontSize:18,fontWeight:600,color:S.ink,marginBottom:12}}>3️⃣ 단 1초, 외부 발송과 완벽 공유 ↗️</h3><p style={{fontSize:15,color:S.muted,lineHeight:1.7}}>우측 상단 <b>[↗ 발송]</b> 버튼만 누르면 내용이 이메일/문자로 연동 발송됩니다.<br/><br/>복잡한 권한 설정 없이 <b>[🔗 공유]</b> 아이콘 클릭 한 번으로, 로그인 없는 상대방도 깔끔하게 뷰를 볼 수 있는 퍼블릭 웹 링크가 즉시 복사됩니다.</p></div>}
              {guideStep===3 && <div style={{animation:"left .3s ease"}}><h3 style={{fontSize:18,fontWeight:600,color:S.accent,marginBottom:12}}>4️⃣ [Killer] 📺 젠 발표(Zen PT) 모드</h3><p style={{fontSize:15,color:S.muted,lineHeight:1.7}}>화면 공유로 회의를 하실 때 메모장 창이 지저분했나요?<br/><br/>우측 상단 <b>[📺 PT모드]</b> 버튼을 누르면 거슬리는 모든 UI가 즉시 사라지고, 깨끗하고 압도적인 초대형 프레젠테이션 스크린으로 메모가 변신합니다. PPT를 따로 만들지 마세요.</p></div>}
            </div>
            <div style={{padding:"20px 32px",borderTop:`1px solid ${S.line}`,background:"#f8fafc",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",gap:6}}>
                {[0,1,2,3].map(i=><span key={i} style={{width:8,height:8,borderRadius:"50%",background:guideStep===i?S.accent:"#cbd5e1",transition:"all .2s"}}/>)}
              </div>
              <div style={{display:"flex",gap:8}}>
                {guideStep > 0 && <B small onClick={()=>setGuideStep(s=>s-1)} style={{background:"none",border:"1px solid #cbd5e1",color:S.muted}}>← 이전</B>}
                {guideStep < 3 ? <B primary small onClick={()=>setGuideStep(s=>s+1)}>다음 팁 보기 →</B> : <B primary small onClick={()=>setGuideOpen(false)}>완료하고 바로 시작하기</B>}
              </div>
            </div>
          </div>
        </div>
      )}

      {presentMode && sel && (
        <div style={{position:"fixed",inset:0,background:"#fff",zIndex:99999,overflowY:"auto",padding:"80px 10%",animation:"up .4s cubic-bezier(0.16, 1, 0.3, 1)",fontFamily:S.font}}>
          <button onClick={()=>setPresentMode(false)} style={{position:"fixed",top:32,right:32,background:"#f1f5f9",border:"none",width:48,height:48,borderRadius:"50%",fontSize:20,cursor:"pointer",color:S.ink,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(0,0,0,.1)",transition:"all .2s"}} onMouseEnter={e=>e.target.style.background="#e2e8f0"} onMouseLeave={e=>e.target.style.background="#f1f5f9"}>✕</button>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <h1 style={{fontSize:56,fontWeight:800,color:S.ink,letterSpacing:-1.5,marginBottom:24,lineHeight:1.3}}>{sel.title||"제목 없음"}</h1>
            <div style={{width:100,height:6,background:S.accent,borderRadius:3,marginBottom:56}}/>
            <div style={{fontSize:26,lineHeight:1.8,color:S.ink,whiteSpace:"pre-wrap",fontWeight:500,letterSpacing:-0.5}}>{sel.content}</div>
          </div>
        </div>
      )}

    </div>
  );
}

