import { useState, useEffect, useRef, useCallback } from "react";
import api from "./api";

const fmtDate = (d) => {
  const date = new Date(d), now = new Date(), diff = now - date;
  if (diff < 60000) return "방금";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return `${date.getMonth() + 1}.${date.getDate()}`;
};

const Logo = ({ size = 28 }) => (
  <div style={{ position: "relative", width: size * 1.5, height: size * 1.5, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width={size} height={size * 1.2} viewBox="0 0 40 48" fill="none">
      <rect x="2" y="4" width="32" height="40" rx="6" fill="rgba(255, 255, 255, 0.9)" stroke="#4f46e5" strokeWidth="1" />
      <line x1="10" y1="14" x2="26" y2="14" stroke="#e5e7eb" strokeWidth="2" />
      <line x1="10" y1="22" x2="26" y2="22" stroke="#e5e7eb" strokeWidth="2" />
      <line x1="10" y1="30" x2="20" y2="30" stroke="#e5e7eb" strokeWidth="2" />
      <rect x="28" y="10" width="4" height="20" rx="2" fill="#4f46e5" transform="rotate(15 28 10)" />
    </svg>
  </div>
);

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box; -webkit-tap-highlight-color: transparent;}
body{font-family: 'Inter', 'IBM Plex Sans KR', sans-serif; background: #fff; color: #111827;}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:10px}
@keyframes up{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0;transform:scale(0.98)}to{opacity:1;transform:scale(1)}}
input:focus,textarea:focus{outline:none}
.card{background:#fff; border-radius:16px; border:1px solid #e2e8f0; padding:20px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);}
@media (max-width: 768px) {
  .sidebar { display: none !important; }
  .note-editor.mobile-active { position: fixed; inset: 0; z-index: 1000; animation: up .3s ease; }
}
`;

const S = {
  font: "'Inter', 'IBM Plex Sans KR', sans-serif",
  paper: "#ffffff", cream: "#f9fafb", ink: "#111827", muted: "#64748b", line: "#e2e8f0", accent: "#4f46e5",
};

const CATEGORY_MAP = {
  routine: { label: "루틴", color: "#4f46e5", icon: "⏰" },
  health: { label: "건강", color: "#059669", icon: "💊" },
  schedule: { label: "일정", color: "#d97706", icon: "📅" },
  person: { label: "연락처", color: "#dc2626", icon: "👥" },
  finance: { label: "재정", color: "#7c3aed", icon: "💳" },
  work: { label: "업무", color: "#3b82f6", icon: "💼" },
  idea: { label: "아이디어", color: "#db2777", icon: "💡" },
};

const ROT_WORDS = ["기획", "개발", "디자인", "영업", "마케팅", "개인"];

export default function App() {
  const [pg, setPg] = useState("login");
  const [view, setView] = useState("briefing");
  const [user, setUser] = useState(null);
  const [memos, setMemos] = useState([]);
  const [sel, setSel] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [lifeCards, setLifeCards] = useState(null);
  const [isMob, setIsMob] = useState(window.innerWidth < 768);
  const [notif, setNotif] = useState(null);
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [et, setEt] = useState("");
  const [ec, setEc] = useState("");
  const [rotIdx, setRotIdx] = useState(0);

  const [lf, setLf] = useState({ email: "", pw: "" });
  const [sf, setSf] = useState({ name: "", email: "", password: "", password_confirm: "" });
  const [ff, setFf] = useState({ email: "" });

  const [coms, setComs] = useState([]);
  const [nc, setNc] = useState("");
  const [colbs, setColbs] = useState([]);
  const [ne, setNe] = useState("");
  const [upw, setUpw] = useState(""); // 잠금 해제용 비밀번호

  const flash = (m, t = "ok") => { setNotif({ m, t }); setTimeout(() => setNotif(null), 3000); };

  useEffect(() => {
    const handleResize = () => setIsMob(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    
    // URL 기반 공유 페이지 감지
    const path = window.location.pathname;
    if (path.startsWith("/shared/")) {
      const slug = path.split("/")[2];
      loadSharedMemo(slug);
    }
    
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadSharedMemo = async (slug) => {
    try {
      const res = await api.memos.getShared(slug, upw);
      setSel(res); setView("shared"); setPg("shared");
    } catch (e) { flash("메모를 불러올 수 없습니다.", "err"); }
  };

  const attemptUnlock = async () => {
    try {
      const res = await api.memos.get(sel.id, upw);
      setSel(res); setEt(res.title); setEc(res.content);
      if (res.is_locked && res.content.includes("🔒")) {
        flash("비밀번호가 올바르지 않습니다.", "err");
      } else {
        flash("잠금이 해제되었습니다.");
      }
    } catch (e) { flash("해제 중 오류 발생", "err"); }
  };

  const toggleLock = async () => {
    const pw = prompt("설정할 비밀번호를 입력하세요 (빈칸이면 해제):");
    try {
      const res = await api.memos.toggleLock(sel.id, pw);
      flash(res.is_locked ? "비밀번호가 설정되었습니다." : "비밀번호가 제거되었습니다.");
      refresh(); setSel(null);
    } catch (e) { flash("설정 중 오류 발생", "err"); }
  };

  const importMemo = async () => {
    if (!user) return setPg("signup"); // 미가입 시 가입 유도
    setSending(true);
    try {
      await api.memos.importShared(sel.share_slug);
      flash("내 보관함에 저장되었습니다! 알람이 활성화됩니다.");
      setPg("app"); setView("memos"); refresh();
    } catch (e) { flash("가져오기 실패", "err"); }
    finally { setSending(false); }
  };

  const postComment = async () => {
    if(!nc.trim()) return;
    try {
      let res;
      if (view === "shared") {
        res = await api.memos.postSharedComment(sel.share_slug, { content: nc, author_name: user ? "" : "방문자" });
      } else {
        res = await api.memos.addComment(sel.id, { content: nc });
      }
      setComs([res, ...coms]); setNc("");
      flash("댓글이 등록되었습니다.");
    } catch (e) { flash("댓글 등록 실패", "err"); }
  };

  useEffect(() => {
    if (sel && sel.comments) setComs(sel.comments);
    if (sel && sel.collaborators) setColbs(sel.collaborators);
  }, [sel]);

  useEffect(() => {
    api.auth.me().then(u => { setUser(u); setPg("app"); refresh(); }).catch(() => {});
    const intv = setInterval(() => setRotIdx(p => (p + 1) % ROT_WORDS.length), 2000);
    return () => clearInterval(intv);
  }, []);

  const refresh = async () => {
    try {
      const b = await api.briefing.today(); setBriefing(b);
      const l = await api.lifecards.list(); setLifeCards(l);
      const m = await api.memos.list(tag); setMemos(m);
      
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      b.routines.forEach(r => {
        if (r.time === timeStr && Notification.permission === "granted" && !r.is_checked) {
          new Notification("Smart Note 루틴 알림", { body: r.task, icon: "/favicon.ico" });
        }
      });
    } catch (e) {}
  };

  const login = async () => {
    setSending(true);
    try {
      const res = await api.auth.login(lf.email.toLowerCase().trim(), lf.pw);
      setUser(res.user); setPg("app"); refresh();
    } catch (e) { flash("이메일 또는 비밀번호가 올바르지 않습니다.", "err"); }
    finally { setSending(false); }
  };

  const saveMemo = async () => {
    if(!sel) return;
    setSending(true);
    try {
      const data = { title: et, content: ec };
      if(sel.id === "new") {
        const m = await api.memos.create(data); setSel(m);
      } else {
        await api.memos.patch(sel.id, data);
      }
      flash("AI가 메모를 분석하여 정리했습니다.");
      refresh();
    } catch (e) { flash("저장 중 오류 발생", "err"); }
    finally { setSending(false); }
  };

  const signup = async () => {
    if (sf.password.length < 4) return flash("비밀번호는 4자 이상이어야 합니다.", "err");
    if (sf.password !== sf.password_confirm) return flash("비밀번호가 일치하지 않습니다.", "err");
    setSending(true);
    try {
      await api.auth.signup(sf);
      flash("가입 성공! 로그인해 주세요."); setPg("login");
    } catch (e) { flash("가입 중 오류가 발생했습니다.", "err"); }
    finally { setSending(false); }
  };

  const forgot = async () => {
    setSending(true);
    try {
      await api.auth.forgotRequest(ff.email.toLowerCase().trim());
      flash("이메일로 재설정 링크를 보냈습니다."); setPg("login");
    } catch (e) { flash("가입되지 않은 이메일입니다.", "err"); }
    finally { setSending(false); }
  };

  const I = (p) => <input {...p} style={{ width: "100%", padding: "14px", border: `1px solid ${S.line}`, borderRadius: 12, fontSize: 15, background: "rgba(255,255,255,0.8)", ...p.style }} />;
  const B = ({ children, primary, small, style, ...p }) => <button {...p} style={{ border: "none", borderRadius: 12, fontSize: small ? 13 : 15, fontWeight: 700, cursor: "pointer", padding: small ? "10px 16px" : "16px 24px", background: primary ? S.accent : S.cream, color: primary ? "#fff" : S.ink, transition: "all .2s", ...style }}>{children}</button>;

  if (pg === "shared" && sel) return (
    <div style={{ minHeight: "100vh", background: `url('/brain/8fd7e4c9-fbe7-47f7-a304-ed807290cc3e/ai_smart_note_bg_1776684402748.png') center/cover no-repeat`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 700, animation: "up .8s ease" }}>
         <div style={{ textAlign: "center", marginBottom: 32 }}>
            <Logo size={50} />
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginTop: 12 }}>공유된 스마트 노트</h2>
         </div>
         
         <div className="card" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(30px)", borderRadius: 32, padding: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ marginBottom: 32 }}>
               <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 16 }}>{sel.title || "제목 없음"}</h1>
               <div style={{ whiteSpace: "pre-wrap", fontSize: 18, lineHeight: 1.8, color: S.ink }}>{sel.content}</div>
            </div>

            <div style={{ background: "rgba(79,70,229,0.05)", padding: 24, borderRadius: 20, marginBottom: 32, border: `1px solid ${S.accent}20` }}>
               <h3 style={{ fontSize: 14, fontWeight: 900, color: S.accent, marginBottom: 12 }}>✨ 이 메모의 AI 루틴</h3>
               {sel.routines?.length ? sel.routines.map((r, i) => (
                  <div key={i} style={{ fontSize: 14, marginBottom: 6 }}>🕒 <b>{r.time}</b> - {r.task}</div>
               )) : <p style={{ fontSize: 13, color: S.muted }}>등록된 루틴이 없습니다.</p>}
               <B primary onClick={importMemo} style={{ width: "100%", marginTop: 20 }}>내 Note로 등록하고 동일한 알람 받기</B>
            </div>

            <div style={{ borderTop: `1px solid ${S.line}`, paddingTop: 24 }}>
               <p style={{ fontSize: 14, fontWeight: 900, marginBottom: 16 }}>💬 댓글 {coms.length}개</p>
               <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                  <input value={nc} onChange={e => setNc(e.target.value)} placeholder="의견을 남겨보세요..." style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${S.line}` }} />
                  <B primary onClick={postComment}>남기기</B>
               </div>
               <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {coms.map(c => (
                     <div key={c.id} style={{ marginBottom: 16, background: "#fff", padding: 16, borderRadius: 16, border: `1px solid ${S.line}` }}>
                        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}>{c.author_name}</div>
                        <div style={{ fontSize: 14, color: S.ink }}>{c.content}</div>
                     </div>
                  ))}
               </div>
            </div>
            
            <div style={{ textAlign: "center", marginTop: 32 }}>
               <button onClick={() => setPg("login")} style={{ background: "none", border: "none", color: S.muted, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>나도 워크드 노트 시작하기 →</button>
            </div>
         </div>
      </div>
    </div>
  );

  if (pg !== "app") return (
    <div style={{ minHeight: "100vh", background: `url('/brain/8fd7e4c9-fbe7-47f7-a304-ed807290cc3e/ai_smart_note_bg_1776684402748.png') center/cover no-repeat`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 420, animation: "up .8s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Logo size={70} />
          <h1 style={{ fontSize: 45, fontWeight: 900, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ color: S.accent }}>({ROT_WORDS[rotIdx]})</span>
            <span style={{ background: "linear-gradient(to right, #111827, #4b5563)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Note</span>
          </h1>
          <p className="typewriter" style={{ color: S.muted, fontSize: 18, fontWeight: 600, marginTop: 12 }}>당신의 모든 일상을 담는 스마트 비서</p>
        </div>
        
        <div className="card" style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(30px)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 32, padding: 32 }}>
          <div style={{ display: "flex", background: "rgba(0,0,0,0.05)", padding: 6, borderRadius: 18, marginBottom: 32 }}>
            {["login", "signup"].map(k => (
              <button key={k} onClick={() => setPg(k)} style={{ flex: 1, padding: 12, background: pg === k ? "#fff" : "none", border: "none", borderRadius: 14, fontWeight: 800, color: pg === k ? S.accent : S.muted, cursor: "pointer", boxShadow: pg === k ? "0 4px 12px rgba(0,0,0,0.05)" : "none", transition: "all .3s" }}>{k === "login" ? "로그인" : "회원가입"}</button>
            ))}
          </div>

          {pg === "login" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {I({ type: "email", value: lf.email, onChange: e => setLf({ ...lf, email: e.target.value }), placeholder: "이메일 주소" })}
              {I({ type: "password", value: lf.pw, onChange: e => setLf({ ...lf, pw: e.target.value }), placeholder: "비밀번호" })}
              <B primary onClick={login} disabled={sending}>{sending ? "인증 중..." : "동기화 시작"}</B>
              <button onClick={() => setPg("forgot")} style={{ background: "none", border: "none", color: S.muted, fontSize: 13, cursor: "pointer", fontWeight: 700 }}>비밀번호를 잊으셨나요?</button>
            </div>
          )}

          {pg === "signup" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {I({ value: sf.name, onChange: e => setSf({ ...sf, name: e.target.value }), placeholder: "성명" })}
              {I({ type: "email", value: sf.email, onChange: e => setSf({ ...sf, email: e.target.value }), placeholder: "이메일 계정" })}
              <div style={{ position: "relative" }}>
                {I({ type: "password", value: sf.password, onChange: e => setSf({ ...sf, password: e.target.value }), placeholder: "비밀번호" })}
                <span style={{ fontSize: 11, color: S.accent, fontWeight: 700, position: "absolute", bottom: -20, left: 4 }}>* 보안을 위해 4자 이상 입력해 주세요.</span>
              </div>
              <div style={{ marginTop: 12 }}>
                {I({ type: "password", value: sf.password_confirm, onChange: e => setSf({ ...sf, password_confirm: e.target.value }), placeholder: "비밀번호 재입력" })}
              </div>
              <B primary onClick={signup} disabled={sending} style={{ marginTop: 8 }}>{sending ? "세팅 중..." : "AI 비서와 함께 시작하기"}</B>
            </div>
          )}

          {pg === "forgot" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <p style={{ textAlign: "center", fontSize: 14, color: S.muted, lineHeight: 1.6 }}>등록하신 이메일을 입력해 주세요.<br/>재설정 링크를 보내드립니다.</p>
              {I({ type: "email", value: ff.email, onChange: e => setFf({ ...ff, email: e.target.value }), placeholder: "이메일 주소" })}
              <B primary onClick={forgot} disabled={sending}>메일 요청하기</B>
              <button onClick={() => setPg("login")} style={{ background: "none", border: "none", color: S.muted, fontSize: 13, cursor: "pointer", fontWeight: 700 }}>로그인으로 돌아가기</button>
            </div>
          )}
        </div>
      </div>
      {notif && <div style={{ position: "fixed", bottom: 40, left: "50%", transform: "translateX(-50%)", background: notif.t === "err" ? "#ef4444" : S.accent, color: "#fff", padding: "16px 32px", borderRadius: 50, zIndex: 10000, fontWeight: 800, animation: "up .3s ease", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>{notif.m}</div>}
      <style>{`
        .typewriter {
          overflow: hidden;
          border-right: 2px solid ${S.accent};
          white-space: nowrap;
          margin: 0 auto;
          animation: typing 3.5s steps(40, end), blink-caret .75s step-end infinite;
          max-width: fit-content;
        }
        @keyframes typing { from { width: 0 } to { width: 100% } }
        @keyframes blink-caret { from, to { border-color: transparent } 50% { border-color: ${S.accent}; } }
      `}</style>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: S.cream, overflow: "hidden", fontFamily: S.font }}>
      <style>{css}</style>
      
      {/* Sidebar */}
      {!isMob && (
        <div style={{ width: 260, borderRight: `1px solid ${S.line}`, display: "flex", flexDirection: "column", background: "#fff" }}>
          <div style={{ padding: "32px 24px", display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={28} />
            <span style={{ fontWeight: 800, fontSize: 18, color: S.accent }}>Smart Note</span>
          </div>
          <div style={{ padding: "0 12px", flex: 1 }}>
            <B primary style={{ width: "calc(100% - 16px)", margin: "0 8px 24px", padding: 14 }} onClick={() => { setSel({ id: "new" }); setEt(""); setEc(""); setView("memos"); }}>+ 새 메모 쓰기</B>
            {[["briefing", "🏠 오늘의 브리핑"], ["lifecards", "💳 라이프카드"], ["memos", "📄 전체 메모"]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ width: "100%", padding: "14px 18px", background: view === v ? "rgba(79,70,229,0.06)" : "none", color: view === v ? S.accent : S.ink, border: "none", borderRadius: 12, textAlign: "left", fontWeight: 700, cursor: "pointer", marginBottom: 4 }}>{l}</button>
            ))}
            <div style={{ marginTop: 24, padding: "0 12px" }}>
              <p style={{ fontSize: 11, color: S.muted, fontWeight: 800, marginBottom: 12 }}>AI 분류</p>
              {Object.entries(CATEGORY_MAP).map(([k, cfg]) => (
                <button key={k} onClick={() => { setTag(k); setView("memos"); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 8px", background: "none", border: "none", cursor: "pointer", opacity: tag === k ? 1 : 0.6 }}>
                  <span>{cfg.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: 24, borderTop: `1px solid ${S.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: S.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{user?.name?.[0] || user?.username?.[0]}</div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{user?.name || user?.username}</span>
            </div>
            <button onClick={() => api.auth.logout().then(() => window.location.reload())} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${S.line}`, background: "#fff", color: S.muted, cursor: "pointer", fontSize: 12 }}>로그아웃</button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        
        {/* Mobile Header */}
        {isMob && (
          <div style={{ height: 60, background: "#fff", display: "flex", alignItems: "center", padding: "0 16px", borderBottom: `1px solid ${S.line}` }}>
            <Logo size={20} />
            <span style={{ marginLeft: 8, fontWeight: 800, color: S.accent }}>Smart Note</span>
            <div style={{ marginLeft: "auto" }}>
              <button onClick={() => { setSel({ id: "new" }); setEt(""); setEc(""); }} style={{ background: S.accent, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700 }}>+ 쓰기</button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: isMob ? 16 : 40 }}>
          
          {/* View: Briefing */}
          {view === "briefing" && briefing && (
            <div style={{ maxWidth: 800, margin: "0 auto", animation: "up .5s ease" }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{briefing.greeting}</h2>
              <p style={{ color: S.muted, marginBottom: 32 }}>오늘 AI비서가 정리한 일정과 루틴입니다.</p>
              
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: 20 }}>
                <div className="card">
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>⏰ 데일리 루틴</h3>
                  {briefing.routines.map(r => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${S.line}` }}>
                      <input type="checkbox" checked={r.is_checked} onChange={() => api.briefing.check(r.id).then(refresh)} style={{ width: 18, height: 18 }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{r.time}</span>
                      <span style={{ fontSize: 14, opacity: r.is_checked ? 0.4 : 1, textDecoration: r.is_checked ? "line-through" : "none" }}>{r.task}</span>
                    </div>
                  ))}
                  {briefing.routines.length === 0 && <p style={{ fontSize: 13, color: S.muted }}>등록된 루틴이 없습니다.</p>}
                </div>
                <div className="card">
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>📅 주요 일정</h3>
                  {briefing.schedules.map((s, i) => (
                    <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${S.line}` }}>
                      <span style={{ fontSize: 12, color: S.accent, fontWeight: 800, marginRight: 8 }}>{s.data.date}</span>
                      <span style={{ fontSize: 14 }}>{s.data.task}</span>
                    </div>
                  ))}
                  {briefing.schedules.length === 0 && <p style={{ fontSize: 13, color: S.muted }}>확인된 일정이 없습니다.</p>}
                </div>
                <div className="card" style={{ gridColumn: isMob ? "auto" : "span 2" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>💊 건강 리마인더</h3>
                  <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
                    {briefing.health_tips.map(m => (
                      <div key={m.id} onClick={() => { setSel(m); setEt(m.title); setEc(m.content); setView("memos"); }} style={{ minWidth: 200, padding: 16, borderRadius: 12, background: "rgba(5, 150, 105, 0.05)", border: "1px solid rgba(5, 150, 105, 0.1)", cursor: "pointer" }}>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{m.title || "건강 메모"}</div>
                        <div style={{ fontSize: 12, color: "#065f46", marginTop: 4 }}>{m.preview}</div>
                      </div>
                    ))}
                    {briefing.health_tips.length === 0 && <p style={{ fontSize: 13, color: S.muted }}>건강 관련 메모가 없습니다.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View: LifeCards */}
          {view === "lifecards" && lifeCards && (
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 32 }}>라이프카드</h2>
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
                {lifeCards.cards.map(c => (
                  <div key={c.category} className="card" style={{ borderTop: `4px solid ${CATEGORY_MAP[c.category].color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: 18 }}>{CATEGORY_MAP[c.category].icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: S.muted }}>{c.count}건</span>
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{CATEGORY_MAP[c.category].label}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {c.recent.map(m => (
                        <div key={m.id} onClick={() => { setSel(m); setEt(m.title); setEc(m.content); setView("memos"); }} style={{ fontSize: 13, color: S.muted, padding: "8px", borderRadius: 8, background: S.cream, cursor: "pointer" }}>{m.title || "제목 없음"}</div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Special Card: Finance */}
                {lifeCards.extracted.finance.length > 0 && (
                  <div className="card" style={{ background: S.ink, color: "#fff" }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>🏦 재정 요약</h3>
                    {lifeCards.extracted.finance.map((f, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        <span style={{ fontSize: 14 }}>{f.data.item}</span>
                        <span style={{ fontSize: 14, fontWeight: 800 }}>{f.data.amount}원</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View: Memos */}
          {view === "memos" && (
            <div style={{ display: "flex", flex: 1, gap: 24, height: "100%" }}>
              <div style={{ width: isMob ? "100%" : 320, display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: 16 }}>
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="메모 검색..." style={{ width: "100%", padding: 12, borderRadius: 12, border: `1px solid ${S.line}`, background: "#fff" }} />
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {memos.map(m => (
                    <div key={m.id} onClick={() => { setSel(m); setEt(m.title); setEc(m.content); }} className="card" style={{ marginBottom: 12, cursor: "pointer", background: sel?.id === m.id ? "rgba(79,70,229,0.05)" : "#fff", border: sel?.id === m.id ? `1px solid ${S.accent}` : `1px solid ${S.line}` }}>
                      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>{m.title || "제목 없음"}</div>
                      <p style={{ fontSize: 12, color: S.muted, marginBottom: 8, lineHeight: 1.4 }}>{m.preview}</p>
                      <div style={{ display: "flex", gap: 4 }}>
                        {m.categories.map(c => <span key={c} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: CATEGORY_MAP[c]?.color + "20", color: CATEGORY_MAP[c]?.color, fontWeight: 800 }}>{CATEGORY_MAP[c]?.label}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {!isMob && (
                <div style={{ flex: 1, display: "flex", gap: 20 }}>
                  <div className="card" style={{ flex: 2, display: "flex", flexDirection: "column", padding: 32, position: "relative" }}>
                    {sel ? (
                      <>
                        <div style={{ position: "absolute", top: 24, right: 32, display: "flex", gap: 10 }}>
                          <button onClick={toggleLock} style={{ background: sel.is_locked ? S.accent : "none", color: sel.is_locked ? "#fff" : S.ink, border: `1px solid ${S.line}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                             {sel.is_locked ? "🔑 잠금 됨" : "🔓 잠금"}
                          </button>
                          <button onClick={() => { 
                            api.memos.togglePublic(sel.id).then(res => {
                              flash(res.is_public ? "메모가 공개되었습니다!" : "비공개로 전환되었습니다.");
                              setSel({ ...sel, ...res });
                            });
                          }} style={{ background: sel.is_public ? S.accent : "none", color: sel.is_public ? "#fff" : S.ink, border: `1px solid ${S.line}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                             {sel.is_public ? "📢 공개 중" : "🔒 비공개"}
                          </button>
                          {sel.is_public && (
                            <button onClick={() => {
                              const url = `${window.location.origin}/shared/${sel.share_slug}`;
                              navigator.clipboard.writeText(url);
                              flash("공유 링크가 복사되었습니다!");
                            }} style={{ background: "none", border: `1px solid ${S.line}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>🔗 링크 복사</button>
                          )}
                        </div>
                        <input value={et} onChange={e => setEt(e.target.value)} placeholder="제목을 입력하세요" style={{ fontSize: 24, fontWeight: 800, border: "none", marginBottom: 24, padding: 0, width: "calc(100% - 320px)" }} />
                        
                        {(sel.is_locked && ec.includes("🔒")) ? (
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: 20, border: `2px dashed ${S.line}` }}>
                             <span style={{ fontSize: 40, marginBottom: 16 }}>🔒</span>
                             <p style={{ fontWeight: 800, color: S.muted, marginBottom: 20 }}>비밀번호로 보호된 메모입니다.</p>
                             <div style={{ display: "flex", gap: 10 }}>
                                {I({ type: "password", value: upw, onChange: e => setUpw(e.target.value), placeholder: "비밀번호", style: { width: 180 } })}
                                <B primary onClick={attemptUnlock}>해제</B>
                             </div>
                          </div>
                        ) : (
                          <textarea value={ec} onChange={e => setEc(e.target.value)} placeholder="메모 내용을 입력하세요. 자동으로 분석됩니다." style={{ flex: 1, border: "none", resize: "none", fontSize: 16, lineHeight: 1.8, padding: 0 }} />
                        )}
                        
                        {/* Comment Section in Editor */}
                        <div style={{ marginTop: 24, padding: "20px 0", borderTop: `1px solid ${S.line}` }}>
                           <p style={{ fontSize: 11, fontWeight: 900, color: S.muted, marginBottom: 12 }}>💬 소통 및 댓글</p>
                           <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                              <input value={nc} onChange={e => setNc(e.target.value)} placeholder="의견을 남겨보세요..." style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${S.line}` }} />
                              <B primary small onClick={postComment}>등록</B>
                           </div>
                           <div style={{ maxHeight: 200, overflowY: "auto" }}>
                              {coms.map(c => (
                                <div key={c.id} style={{ marginBottom: 10, fontSize: 13 }}>
                                   <span style={{ fontWeight: 800, marginRight: 6 }}>{c.author_name}</span>
                                   <span style={{ color: S.muted }}>{c.content}</span>
                                </div>
                              ))}
                           </div>
                        </div>

                        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                          <B onClick={() => setSel(null)}>닫기</B>
                          <B primary onClick={saveMemo}>{sending ? "저장 중..." : "AI 저장 및 분석"}</B>
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: S.muted, flexDirection: "column" }}>
                        <Logo size={40} style={{ opacity: 0.2, marginBottom: 16 }} />
                        <span>비서에게 맡길 메모를 선택하세요.</span>
                      </div>
                    )}
                  </div>
                  
                  {/* AI Side Panel */}
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div className="card" style={{ height: "100%", background: S.paper, border: `2px solid ${S.accent}10` }}>
                      <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 24, color: S.accent, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 20 }}>✨</span> AI 인텔리전스
                      </h3>
                      {sel?.id !== "new" && sel ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                          <div>
                            <p style={{ fontSize: 11, color: S.muted, fontWeight: 800, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>분류 결과</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {sel.categories?.map(c => <span key={c} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 10, background: CATEGORY_MAP[c]?.color, color: "#fff", fontWeight: 800 }}>{CATEGORY_MAP[c]?.label}</span>)}
                            </div>
                          </div>
                          
                          {sel.routines?.length > 0 && (
                            <div>
                              <p style={{ fontSize: 11, color: S.muted, fontWeight: 800, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>일일 루틴 감지</p>
                              {sel.routines.map((r, i) => (
                                <div key={i} style={{ fontSize: 13, padding: "12px", background: "rgba(79,70,229,0.05)", borderRadius: 12, marginBottom: 6, display: "flex", alignItems: "center", gap: 10, border: `1px solid ${S.accent}10` }}>
                                  <span style={{ fontSize: 16 }}>⏰</span>
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    <span style={{ fontWeight: 800, color: S.accent }}>{r.time}</span>
                                    <span style={{ fontSize: 12, color: S.ink }}>{r.task}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {sel.extracted_infos?.length > 0 && (
                            <div>
                              <p style={{ fontSize: 11, color: S.muted, fontWeight: 800, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>추출된 라이프 데이터</p>
                              {sel.extracted_infos.map((info, i) => (
                                <div key={i} style={{ fontSize: 13, padding: "12px", background: "#f8fafc", borderRadius: 12, marginBottom: 6, border: `1px solid ${S.line}` }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                    <span>{CATEGORY_MAP[info.info_type]?.icon}</span>
                                    <span style={{ fontWeight: 800, fontSize: 11 }}>{CATEGORY_MAP[info.info_type]?.label}</span>
                                  </div>
                                  <div style={{ color: S.ink, fontWeight: 600 }}>{Object.entries(info.data).map(([k, v]) => v).join(" | ")}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {(!sel.routines?.length && !sel.extracted_infos?.length) && (
                            <p style={{ fontSize: 13, color: S.muted, textAlign: "center", marginTop: 40, lineHeight: 1.6 }}>메모를 저장하시면 AI가<br/>중요 정보를 자동으로 추출합니다.</p>
                          )}
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", marginTop: 60 }}>
                          <span style={{ fontSize: 40, opacity: 0.2 }}>🤖</span>
                          <p style={{ fontSize: 13, color: S.muted, marginTop: 16, lineHeight: 1.6 }}>분석된 정보를 보려면<br/>메모를 선택해 주세요.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {isMob && sel && (
          <div className="note-editor mobile-active" style={{ display: "flex", flexDirection: "column", background: "#fff" }}>
            <div style={{ height: 60, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: `1px solid ${S.line}` }}>
              <button onClick={() => setSel(null)} style={{ background: "none", border: "none", fontSize: 24, marginRight: 12 }}>←</button>
              <input value={et} onChange={e => setEt(e.target.value)} placeholder="제목" style={{ flex: 1, border: "none", fontSize: 18, fontWeight: 800 }} />
              <B primary small onClick={saveMemo}>{sending ? "..." : "저장"}</B>
            </div>
            <textarea value={ec} onChange={e => setEc(e.target.value)} placeholder="내용을 입력하세요..." style={{ flex: 1, border: "none", padding: 20, fontSize: 16, lineHeight: 1.7, resize: "none" }} />
            <div style={{ padding: 20, borderTop: `1px solid ${S.line}`, background: "#f8fafc" }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: S.accent, marginBottom: 10 }}>✨ AI 분석 결과</p>
              <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
                {sel.categories?.map(c => <span key={c} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: CATEGORY_MAP[c]?.color, color: "#fff", fontWeight: 700, whiteSpace: "nowrap" }}>{CATEGORY_MAP[c]?.label}</span>)}
              </div>
            </div>
          </div>
        )}

        {isMob && (
          <div style={{ height: 64, display: "flex", borderTop: `1px solid ${S.line}`, background: "#fff" }}>
            {[["briefing", "🏠", "브리핑"], ["lifecards", "💳", "라이프"], ["memos", "📄", "메모"]].map(([v, i, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "none", border: "none", gap: 2, color: view === v ? S.accent : S.muted }}>
                <span style={{ fontSize: 18 }}>{i}</span>
                <span style={{ fontSize: 10, fontWeight: 800 }}>{l}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {notif && <div style={{ position: "fixed", bottom: 40, left: "50%", transform: "translateX(-50%)", background: notif.t === "err" ? "#ef4444" : S.accent, color: "#fff", padding: "16px 32px", borderRadius: 50, zIndex: 10000, fontWeight: 800, animation: "up .3s ease", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>{notif.m}</div>}
    </div>
  );
}
