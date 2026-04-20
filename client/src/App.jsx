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

const Logo = ({ size = 28 }) => (
  <div style={{ position: "relative", width: size * 1.5, height: size * 1.5, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
body{font-family: 'Inter', 'IBM Plex Sans KR', sans-serif; background: #fff;}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:10px}
@keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0;transform:scale(0.98)}to{opacity:1;transform:scale(1)}}
input:focus,textarea:focus{outline:none}

/* Mobile Overrides */
@media (max-width: 768px) {
  .note-editor.mobile-active { position: fixed; inset: 0; z-index: 1000; display: flex !important; animation: up .3s cubic-bezier(0.16, 1, 0.3, 1); }
}
`;

const S = {
  font: "'Inter', 'IBM Plex Sans KR', sans-serif",
  title: "'Inter', sans-serif",
  paper: "#ffffff",
  cream: "#f9fafb",
  ink: "#111827",
  muted: "#64748b",
  line: "#e2e8f0",
  accent: "#4f46e5",
};

const COLORS = ["#f8fafc", "#4f46e5", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777"];

export default function App() {
  const [pg, setPg] = useState("login");
  const [user, setUser] = useState(null);
  const [memos, setMemos] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [sel, setSel] = useState(null);
  const [view, setView] = useState("memos");
  const [isMob, setIsMob] = useState(window.innerWidth < 768);
  const [notif, setNotif] = useState(null);
  const [sending, setSending] = useState(false);
  
  const [lf, setLf] = useState({ email: "", pw: "" });
  const [sf, setSf] = useState({ name: "", email: "", pw: "" });
  const [le, setLe] = useState("");
  const [se, setSe] = useState("");
  
  const [et, setEt] = useState("");
  const [ec, setEc] = useState("");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState(0);
  const [rotIdx, setRotIdx] = useState(0);
  const ROT_WORDS = ["기획", "개발", "디자인", "영업", "마케팅", "개인"];
  const [wsName, setWsName] = useState(localStorage.getItem("wn-wsname") || "나의 노트");
  const [editWs, setEditWs] = useState(false);
  const [conEdit, setConEdit] = useState(null);
  const [conForm, setConForm] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [resetForm, setResetForm] = useState({ uid: "", token: "", newPw: "" });

  const flash = (m, t = "ok") => { setNotif({ m, t }); setTimeout(() => setNotif(null), 2500); };

  useEffect(() => {
    const handleResize = () => setIsMob(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    api.auth.me().then(u => { setUser(u); setPg("app"); load(); }).catch(() => {});
    const intv = setInterval(() => setRotIdx(p => (p + 1) % ROT_WORDS.length), 2000);
    return () => clearInterval(intv);
  }, []);

  const load = async () => {
    try {
      const m = await api.memos.list(); setMemos(m.results || m);
      const c = await api.contacts.list(); setContacts(c.results || c);
    } catch (e) {}
  };

  const login = async () => {
    setSending(true); setLe("");
    try {
      const res = await api.auth.login(lf.email, lf.pw);
      setUser(res.user); setPg("app"); load();
    } catch (e) { setLe("이메일 또는 비밀번호를 확인해주세요."); }
    finally { setSending(false); }
  };

  const signup = async () => {
    setSending(true); setSe("");
    try {
      await api.auth.signup({ email: sf.email, first_name: sf.name, password: sf.pw, password_confirm: sf.pw });
      flash("가입 완료!"); setPg("login");
    } catch (e) { setSe("이미 가입된 이메일이거나 정보가 올바르지 않습니다."); }
    finally { setSending(false); }
  };

  const requestReset = async () => {
    setSending(true);
    try {
      await api.auth.requestPasswordReset(resetEmail);
      flash("인증 메일이 성공적으로 발송되었습니다!"); setPg("login");
    } catch (e) { flash("현재 등록된 계정이 없습니다.", "err"); }
    finally { setSending(false); }
  };

  const confirmReset = async () => {
    try {
      await api.auth.confirmPasswordReset({ uid: resetForm.uid, token: resetForm.token, new_password: resetForm.newPw });
      flash("비밀번호 변경 완료!"); setPg("login");
    } catch (e) { flash("오류가 발생했습니다.", "err"); }
  };

  const saveMemo = async () => {
    if(!sel) return;
    setSending(true);
    try {
      if(sel.id === "new") {
        const m = await api.memos.create({ title: et, content: ec, color: sel.color || 1 });
        setMemos([m, ...memos]); setSel(m);
      } else {
        await api.memos.patch(sel.id, { title: et, content: ec });
        setMemos(memos.map(m => m.id === sel.id ? { ...m, title: et, content: ec } : m));
      }
      flash("저장되었습니다.");
    } catch (e) { flash("저장 실패", "err"); }
    finally { setSending(false); }
  };

  const deleteMemo = async () => {
    if(!sel || sel.id === "new") { setSel(null); return; }
    if(!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await api.memos.delete(sel.id);
      setMemos(memos.filter(m => m.id !== sel.id)); setSel(null);
      flash("삭제되었습니다.");
    } catch (e) { flash("삭제 실패", "err"); }
  };

  const I = (p) => <input {...p} style={{ width: "100%", padding: "12px 14px", border: `1px solid ${S.line}`, borderRadius: 10, fontSize: 15, background: "#f8fafc", ...p.style }} />;
  const B = ({ children, primary, small, style, ...p }) => <button {...p} style={{ border: "none", borderRadius: 10, fontSize: small ? 13 : 15, fontWeight: 700, cursor: "pointer", padding: small ? "8px 16px" : "14px 20px", background: primary ? S.accent : S.cream, color: primary ? "#fff" : S.ink, transition: "all .2s", ...style }}>{children}</button>;

  if (pg !== "app") return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 50%, #f8fafc 0%, #e2e8f0 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 400, animation: "up .8s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <Logo size={60} />
          <h1 style={{ fontSize: 32, fontWeight: 800, color: S.ink, marginTop: 16 }}>({ROT_WORDS[rotIdx]}) 노트</h1>
          <p style={{ color: S.muted, fontSize: 15, marginTop: 8 }}>나만의 통합 비즈니스 비서</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", padding: 32, borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${S.line}`, marginBottom: 24 }}>
            {["login", "signup"].map(k => <button key={k} onClick={() => setPg(k)} style={{ flex: 1, padding: 12, background: "none", border: "none", borderBottom: pg === k ? `2px solid ${S.accent}` : "none", fontWeight: 700, color: pg === k ? S.ink : S.muted }}>{k === "login" ? "로그인" : "회원가입"}</button>)}
          </div>
          {pg === "login" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {I({ type: "email", value: lf.email, onChange: e => setLf({ ...lf, email: e.target.value }), placeholder: "이메일" })}
              {I({ type: "password", value: lf.pw, onChange: e => setLf({ ...lf, pw: e.target.value }), placeholder: "비밀번호" })}
              {le && <p style={{ color: "#ef4444", fontSize: 13 }}>{le}</p>}
              <B primary onClick={login} disabled={sending}>{sending ? "처리 중..." : "로그인하기"}</B>
              <button onClick={() => setPg("forgot")} style={{ background: "none", border: "none", color: S.muted, fontSize: 13, cursor: "pointer", marginTop: 8 }}>비밀번호 찾기</button>
            </div>
          )}
          {pg === "signup" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {I({ value: sf.name, onChange: e => setSf({ ...sf, name: e.target.value }), placeholder: "이름" })}
              {I({ type: "email", value: sf.email, onChange: e => setSf({ ...sf, email: e.target.value }), placeholder: "이메일" })}
              {I({ type: "password", value: sf.pw, onChange: e => setSf({ ...sf, pw: e.target.value }), placeholder: "비밀번호" })}
              {se && <p style={{ color: "#ef4444", fontSize: 13 }}>{se}</p>}
              <B primary onClick={signup} disabled={sending}>가입 완료</B>
            </div>
          )}
          {pg === "forgot" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 13, color: S.muted }}>가입하신 이메일로 인증 링크를 보냅니다.</p>
              {I({ type: "email", value: resetEmail, onChange: e => setResetEmail(e.target.value), placeholder: "email@example.com" })}
              <B primary onClick={requestReset} disabled={sending}>인증 메일 요청</B>
              <button onClick={() => setPg("login")} style={{ background: "none", border: "none", color: S.muted, fontSize: 13, cursor: "pointer" }}>돌아가기</button>
            </div>
          )}
        </div>
      </div>
      {notif && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: notif.t === "err" ? "#ef4444" : S.ink, color: "#fff", padding: "10px 20px", borderRadius: 12, zIndex: 10000, fontWeight: 600, animation: "up .3s ease" }}>{notif.m}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: isMob ? "column" : "row", height: "100vh", background: S.paper, overflow: "hidden", fontFamily: S.font }}>
      <style>{css}</style>
      
      {/* Sidebar (Desktop) */}
      {!isMob && (
        <div className="sidebar" style={{ width: 260, borderRight: `1px solid ${S.line}`, display: "flex", flexDirection: "column", background: S.cream }}>
          <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <Logo size={24} />
            <div style={{ flex: 1 }}>
              {editWs ? <input autoFocus value={wsName} onChange={e => setWsName(e.target.value)} onBlur={() => { setEditWs(false); localStorage.setItem("wn-wsname", wsName); }} style={{ width: "100%", background: "none", border: "none", borderBottom: `2px solid ${S.ink}`, fontSize: 16, fontWeight: 700 }} /> : <h2 onClick={() => setEditWs(true)} style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{wsName}</h2>}
            </div>
          </div>
          <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 4 }}>
            {[["memos", "📝 전체 메모"], ["contacts", "👥 주소록"]].map(([v, l]) => (
              <button key={v} onClick={() => { setView(v); setSel(null); }} style={{ padding: "12px 16px", background: view === v ? "rgba(79,70,229,0.08)" : "none", color: view === v ? S.accent : S.ink, border: "none", borderRadius: 10, textAlign: "left", fontSize: 14, fontWeight: view === v ? 600 : 500, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          <div style={{ marginTop: "auto", padding: 20, borderTop: `1px solid ${S.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 15 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: S.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{user?.first_name?.[0].toUpperCase() || "U"}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.first_name}님</div>
            </div>
            <button onClick={() => api.auth.logout().then(() => window.location.reload())} style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${S.line}`, background: "#fff", color: S.muted, fontSize: 12, cursor: "pointer" }}>로그아웃</button>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        
        {/* Mobile Header */}
        {isMob && (
          <div style={{ height: 60, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: `1px solid ${S.line}`, background: "#fff", zIndex: 10 }}>
            <Logo size={20} />
            <span style={{ marginLeft: 8, fontWeight: 700 }}>{wsName}</span>
            <div style={{ marginLeft: "auto" }}>
              <button onClick={() => api.auth.logout().then(() => window.location.reload())} style={{ background: "none", border: "none", fontSize: 12, color: S.muted }}>로그아웃</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          
          {/* List Component (Hidden on mobile if editor is active) */}
          {(!isMob || (isMob && !sel && !conEdit)) && (
            <div style={{ width: isMob ? "100%" : 320, borderRight: isMob ? "none" : `1px solid ${S.line}`, display: "flex", flexDirection: "column", background: "#fff" }}>
              {view === "memos" ? (
                <>
                  <div style={{ padding: 16, borderBottom: `1px solid ${S.line}` }}>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="메모 검색..." style={{ width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${S.line}`, background: S.paper, fontSize: 14 }} />
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                    {memos.filter(m => !q || m.title.includes(q) || m.content.includes(q)).length === 0 ? (
                      <div style={{ padding: 40, textAlign: "center", color: S.muted, fontSize: 13 }}>메모가 없습니다.</div>
                    ) : (
                      memos.filter(m => !q || (m.title||"").includes(q) || (m.content||"").includes(q)).map(m => (
                        <div key={m.id} onClick={() => { setSel(m); setEt(m.title); setEc(m.content); }} style={{ padding: 16, borderRadius: 12, cursor: "pointer", background: sel?.id === m.id ? "rgba(79,70,229,0.05)" : "none", marginBottom: 4, transition: "all .2s" }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{m.title || "제목 없음"}</div>
                          <div style={{ fontSize: 12, color: S.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.content.substring(0, 50)}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ padding: 16, borderTop: isMob ? "none" : `1px solid ${S.line}` }}>
                    <B primary style={{ width: "100%" }} onClick={() => { setSel({ id: "new", color: 1 }); setEt(""); setEc(""); }}>+ 새 메모 작성</B>
                  </div>
                </>
              ) : (
                <div style={{ padding: 24 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>주소록</h2>
                  {contacts.length === 0 ? <p style={{ color: S.muted }}>등록된 연락처가 없습니다.</p> : contacts.map(c => <div key={c.id} style={{ padding: 12, borderBottom: `1px solid ${S.line}` }}>{c.name} ({c.phone})</div>)}
                  <B small primary style={{ marginTop: 20 }}>연락처 추가</B>
                </div>
              )}
            </div>
          )}

          {/* Editor Component (Full screen on mobile when active) */}
          {(sel || conEdit || !isMob) && (
            <div className={`note-editor ${isMob && (sel || conEdit) ? "mobile-active" : ""}`} style={{ flex: 1, display: (isMob && !sel && !conEdit) ? "none" : "flex", flexDirection: "column", background: "#fff", zIndex: 100 }}>
              {(sel || conEdit) ? (
                <>
                  <div style={{ height: 60, borderBottom: `1px solid ${S.line}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, background: isMob ? "#f9fafb" : "#fff" }}>
                    {isMob && <button onClick={() => { setSel(null); setConEdit(null); }} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", marginRight: 4 }}>←</button>}
                    <input value={et} onChange={e => setEt(e.target.value)} placeholder="제목을 입력하세요" style={{ flex: 1, border: "none", fontSize: 18, fontWeight: 700, background: "none", outline: "none" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <B small danger onClick={deleteMemo} style={{ background: "#fee2e2", color: "#dc2626" }}>삭제</B>
                      <B primary small onClick={saveMemo}>{sending ? "저장중" : "저장"}</B>
                    </div>
                  </div>
                  <textarea value={ec} onChange={e => setEc(e.target.value)} placeholder="내용을 입력하세요..." style={{ flex: 1, border: "none", padding: 24, fontSize: 16, lineHeight: 1.7, outline: "none", resize: "none" }} />
                </>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: S.muted, flexDirection: "column" }}>
                  <Logo size={48} />
                  <p style={{ marginTop: 16 }}>기록을 시작해보세요.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Bottom Navigation */}
        {isMob && !sel && !conEdit && (
          <div style={{ height: 64, display: "flex", borderTop: `1px solid ${S.line}`, background: "#fff", zIndex: 10 }}>
            {[["memos", "📝", "메모"], ["contacts", "👥", "주소록"]].map(([v, i, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "none", border: "none", gap: 2, color: view === v ? S.accent : S.muted }}>
                <span style={{ fontSize: 20 }}>{i}</span>
                <span style={{ fontSize: 10, fontWeight: 700 }}>{l}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {notif && (
        <div style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", background: notif.t === "err" ? "#ef4444" : S.ink, color: "#fff", padding: "12px 24px", borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.2)", zIndex: 10000, fontWeight: 600, animation: "up .3s ease" }}>{notif.m}</div>
      )}
    </div>
  );
}
