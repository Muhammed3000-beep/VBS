import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';

function authErrorText(err) {
  const messages = {
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/invalid-email': 'Geçerli bir e-posta adresi girin.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.',
    'auth/network-request-failed': 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.'
  };
  return messages[err.code] || `Giriş yapılamadı: ${err.message}`;
}
function dateText(value) {
  if (!value) return '—';
  if (typeof value === 'string') {
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value;
  }
  if (value?.toDate) return value.toDate().toLocaleDateString('tr-TR');
  return '—';
}
function timestampText(value) {
  return value?.toDate ? value.toDate().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}
function termText(term) { return `${term || '—'}. dönem`; }
function typeText(type) { return type === 'sinav' ? 'Sınav' : type === 'sozlu' ? 'Sözlü' : 'Not'; }

function LoginPage({ onLogin, email, setEmail, password, setPassword, busy, error }) {
  return <div className="login-page">
    <div className="login-left">
      <div className="brand"><span className="brand-symbol">e<span>·</span></span><span className="brand-name">e-okul<small>VELİ BİLGİLENDİRME SİSTEMİ</small></span></div>
      <div className="login-illustration"><div className="sun-shape" /><div className="circle-shape" /><div className="school-card"><div className="school-top">✦</div><div className="school-line short" /><div className="school-line" /><div className="school-line medium" /><div className="school-status"><span /> CANLI TAKİP</div></div><div className="float-card float-one"><b>✓</b><span>Güncel notlar</span></div><div className="float-card float-two"><b>◷</b><span>Devamsızlık</span></div></div>
      <div className="login-quote"><h1>Okul hayatına<br /><em>yakından eşlik edin.</em></h1><p>Devamsızlık durumlarını ve sınav/sözlü puanlarını güvenli veli panelinizden takip edin.</p></div>
      <div className="login-footer"><span className="live-dot" /> Firestore ile canlı veri senkronizasyonu</div>
    </div>
    <div className="login-right"><form className="login-card" onSubmit={onLogin}>
      <p className="eyebrow">VELİ HESABI</p><h2>Hoş geldiniz 👋</h2><p className="subtitle">Öğrenci bilgilerinizi görmek için giriş yapın.</p>
      <label>E-posta adresi</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="veli@ornek.com" autoComplete="username" required />
      <label>Şifre</label><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Şifrenizi girin" autoComplete="current-password" required />
      {error && <div className="error-box">{error}</div>}
      <button className="button primary" type="submit" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Veli paneline gir'} <span>→</span></button>
      <div className="privacy-note"><span>🔐</span><p>Bu panel salt okunurdur. Veli hesabı yalnızca YBS tarafından eşleştirilen öğrenci kayıtlarını görüntüler.</p></div>
    </form><div className="right-foot">Güvenli öğrenci bilgileri · E-Okul demo sistemi</div></div>
  </div>;
}

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [students, setStudents] = useState([]);
  const [data, setData] = useState({});
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => onAuthStateChanged(auth, async current => {
    setAuthUser(current); setProfile(null);
    if (current) {
      try {
        const snap = await getDoc(doc(db, 'users', current.uid));
        if (snap.exists()) setProfile({ ...snap.data(), uid: current.uid });
      } catch (err) { setLoginError(`Profil okunamadı: ${err.message}`); }
    }
    setLoadingAuth(false);
  }), []);

  useEffect(() => {
    if (!authUser || profile?.role !== 'vbs') { setStudents([]); return undefined; }
    const q = query(collection(db, 'students'), where('parentUid', '==', authUser.uid));
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.schoolNumber - b.schoolNumber);
      setStudents(items);
    }, err => setLoginError(`Öğrenciler yüklenemedi: ${err.message}`));
  }, [authUser, profile?.role]);

  useEffect(() => {
    if (!students.length || profile?.role !== 'vbs') { setData({}); return undefined; }
    let active = true;
    const cleanups = [];
    const keys = students.map(s => s.id);
    setData(old => Object.fromEntries(Object.entries(old).filter(([k]) => keys.includes(k))));
    const updatePart = (studentId, field, value) => {
      if (!active) return;
      setData(old => ({ ...old, [studentId]: { ...(old[studentId] || { attendance: [], grades: [], reasons: [] }), [field]: value } }));
    };
    for (const student of students) {
      cleanups.push(onSnapshot(query(collection(db, 'students', student.id, 'attendance'), orderBy('date', 'desc'), limit(60)), snap => {
        updatePart(student.id, 'attendance', snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.date).localeCompare(String(a.date))));
      }));
      cleanups.push(onSnapshot(query(collection(db, 'students', student.id, 'grades'), orderBy('updatedAt', 'desc'), limit(100)), snap => {
        updatePart(student.id, 'grades', snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
          const ta = a.updatedAt?.toMillis?.() || 0; const tb = b.updatedAt?.toMillis?.() || 0; return tb - ta;
        }));
      }));
      cleanups.push(onSnapshot(query(collection(db, 'students', student.id, 'attendanceReasons'), limit(60)), snap => {
        updatePart(student.id, 'reasons', snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }));
    }
    return () => { active = false; cleanups.forEach(unsub => unsub()); };
  }, [students, profile?.role]);

  const login = async e => {
    e.preventDefault(); setBusy(true); setLoginError('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); setPassword(''); }
    catch (err) { setLoginError(authErrorText(err)); }
    finally { setBusy(false); }
  };
  const logout = () => signOut(auth);

  if (loadingAuth) return <div className="loading-screen"><div className="spinner" />Oturum güvenli biçimde kontrol ediliyor…</div>;
  if (!authUser) return <LoginPage onLogin={login} email={email} setEmail={setEmail} password={password} setPassword={setPassword} busy={busy} error={loginError} />;
  if (!profile) return <div className="access-page"><div className="access-card"><div className="access-symbol">⚙</div><h2>VBS profili bulunamadı</h2><p>Firebase Console → Firestore Database içinde <code>users/{'{UID}'}</code> belgesini oluşturun ve <code>role: "vbs"</code> değerini verin. Ayrıntılar ZIP içindeki README dosyasında.</p><button className="button secondary" onClick={logout}>Çıkış yap</button></div></div>;
  if (profile.role !== 'vbs') return <div className="access-page"><div className="access-card"><div className="access-symbol">🔒</div><h2>VBS hesabı gerekli</h2><p>Bu portal yalnızca <code>role: "vbs"</code> hesabını kabul eder. Öğretmen veya YBS hesabınız varsa diğer ZIP paketini kullanın.</p><button className="button secondary" onClick={logout}>Çıkış yap</button></div></div>;

  const allAttendance = students.flatMap(s => (data[s.id]?.attendance || []).map(a => ({ ...a, owner: s })));
  const allGrades = students.flatMap(s => (data[s.id]?.grades || []).map(g => ({ ...g, owner: s })));
  const absenceCount = allAttendance.filter(a => a.present === false).length;
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  return <div className="portal-shell">
    <header className="portal-header"><div className="brand"><div className="brand-mark">e<span>·</span></div><div><strong>e-okul</strong><small>VELİ BİLGİLENDİRME SİSTEMİ</small></div></div><div className="header-right"><div className="sync-label"><span className="live-dot" /> Canlı güncelleniyor</div><div className="parent-user"><div className="parent-avatar">{(profile.displayName || 'V').slice(0, 1).toLocaleUpperCase('tr-TR')}</div><div><strong>{profile.displayName || 'Veli hesabı'}</strong><small>Veli hesabı</small></div></div><button className="logout-button" onClick={logout}>Çıkış <span>↗</span></button></div></header>
    <main className="portal-main">
      <section className="portal-hero"><div><p className="eyebrow">VELİ PANELİ / {today.toLocaleUpperCase('tr-TR')}</p><h1>Merhaba, {profile.displayName || 'değerli veli'} 👋</h1><p>Öğrencinizin devamsızlık ve not bilgileri, öğretmen kayıt yaptıkça bu ekranda güncellenir.</p></div><div className="hero-decoration"><div className="hero-circle">✓</div><span /></div></section>
      <div className="summary-grid"><SummaryCard icon="♧" tint="mint" title="Bağlı öğrenci" value={students.length} note="YBS tarafından eşleştirildi" /><SummaryCard icon="◷" tint="coral" title="Yok kaydı" value={absenceCount} note="Görüntülenen yoklama kayıtlarında" /><SummaryCard icon="✎" tint="blue" title="Not kaydı" value={allGrades.length} note="Sınav ve sözlü puanları" /></div>
      <div className="content-heading"><div><p className="eyebrow">ÖĞRENCİ BİLGİLERİ</p><h2>Öğrencileriniz</h2><p>Devamsızlık kararları ve notlar salt okunur olarak gösterilir.</p></div><div className="view-tabs"><button className={activeTab === 'all' ? 'selected' : ''} onClick={() => setActiveTab('all')}>Tüm bilgiler</button><button className={activeTab === 'attendance' ? 'selected' : ''} onClick={() => setActiveTab('attendance')}>Devamsızlık</button><button className={activeTab === 'grades' ? 'selected' : ''} onClick={() => setActiveTab('grades')}>Notlar</button></div></div>
      {!students.length ? <div className="empty-panel"><div className="empty-icon">♧</div><h3>Henüz öğrenci hesabınıza bağlanmamış</h3><p>Öğrencinizin okul numarası ve sınıf bilgileri YBS panelinden bu veli hesabına bağlandığında burada otomatik görünür.</p><div className="empty-steps"><span>1</span> Okul yönetimi Firebase Authentication’da veli hesabını oluşturur <span>2</span> YBS hesabı öğrenci kaydına UID’nizi bağlar</div></div> : <div className="student-cards">{students.map(student => {
        const childData = data[student.id] || { attendance: [], grades: [], reasons: [] };
        const absences = childData.attendance.filter(a => a.present === false);
        const average = childData.grades.length ? (childData.grades.reduce((sum, g) => sum + Number(g.score || 0), 0) / childData.grades.length).toFixed(1) : '—';
        return <article className="student-card" key={student.id}>
          <div className="student-card-head"><div className="student-profile"><div className="student-photo">{student.fullName?.slice(0, 1) || 'Ö'}</div><div><h3>{student.fullName}</h3><p>{student.classGrade}-{student.section} şubesi <span>·</span> Okul no: {student.schoolNumber}</p></div></div><div className="child-stat"><small>Görüntülenen not ort.</small><strong>{average}{average !== '—' ? ' / 100' : ''}</strong></div></div>
          {(activeTab === 'all' || activeTab === 'attendance') && <section className="child-section"><div className="child-section-title"><div><span className="section-icon coral">◷</span><h4>Devamsızlık durumu</h4></div><span className="count-chip">{absences.length} yok</span></div>
            {!childData.attendance.length ? <div className="empty-inline">Henüz yoklama kaydı bulunmuyor.</div> : <div className="child-table-wrap"><table className="child-table"><thead><tr><th>Tarih</th><th>Ders</th><th>Öğretmen / ders</th><th>Durum</th><th>Özür</th></tr></thead><tbody>{childData.attendance.slice(0, 12).map(a => {
              const reason = childData.reasons.find(r => r.sessionId === a.sessionId);
              return <tr key={a.id}><td>{dateText(a.date)}</td><td>{a.lesson}. ders</td><td>{a.teacherName}<small>{a.subject}</small></td><td><span className={`badge ${a.present ? 'badge-present' : 'badge-absent'}`}>{a.present ? 'Var' : 'Yok'}</span></td><td>{a.present ? <span className="muted">—</span> : reason ? <span className={`badge ${reason.status === 'excused' ? 'badge-excused' : 'badge-unexcused'}`}>{reason.status === 'excused' ? 'Özürlü' : 'Özürsüz'}</span> : <span className="pending">İnceleniyor</span>}</td></tr>;
            })}</tbody></table></div>}
            {absences.length > 0 && <p className="section-footnote">Özür durumunu okul yönetimi işler. Açıklama: {childData.reasons.filter(r => r.reason).slice(0, 2).map(r => r.reason).join(' · ') || 'Henüz açıklama girilmedi.'}</p>}
          </section>}
          {(activeTab === 'all' || activeTab === 'grades') && <section className="child-section grades-section"><div className="child-section-title"><div><span className="section-icon blue">✎</span><h4>Sınav ve sözlü notları</h4></div><span className="count-chip blue-count">{childData.grades.length} not</span></div>
            {!childData.grades.length ? <div className="empty-inline">Henüz not girilmemiş.</div> : <div className="grade-grid">{childData.grades.slice(0, 12).map(g => <div className="grade-item" key={g.id}><div className="grade-item-top"><span>{typeText(g.assessmentType)} {g.assessmentNo}</span><span>{termText(g.term)}</span></div><div className="grade-score-row"><strong>{g.score}</strong><span>/ 100</span><i className={Number(g.score) >= 50 ? 'score-good' : 'score-low'}>{Number(g.score) >= 50 ? 'Başarılı' : 'Takip'}</i></div><div className="grade-item-bottom"><span>{g.subject || 'Ders belirtilmemiş'}</span><small>{g.teacherName || ''}</small></div><div className="grade-updated">Son güncelleme: {timestampText(g.updatedAt)}</div></div>)}</div>}
          </section>}
        </article>;
      })}</div>}
      <div className="security-footer"><span>🛡️</span><div><strong>Bilgileriniz güvenle görüntülenir.</strong><p>VBS yalnızca size bağlanan öğrencinin bilgilerine erişebilir. Bu ekrandan not veya devamsızlık kaydı değiştirilemez.</p></div><span className="security-lock">● Şifreli bağlantı</span></div>
    </main>
    <footer className="portal-footer"><span>e·okul demo sistemi</span><span>Gösterilen öğrenci profilleri demo amaçlıdır; resmi MEB sistemiyle bağlantılı değildir.</span></footer>
  </div>;
}

function SummaryCard({ icon, tint, title, value, note }) {
  return <div className="summary-card"><div className={`summary-icon ${tint}`}>{icon}</div><div><span>{title}</span><strong>{value.toLocaleString ? value.toLocaleString('tr-TR') : value}</strong><small>{note}</small></div></div>;
}

export default App;
