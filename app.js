/* ==========================================================================
   LifeOS AI — app.js
   Router, rendering, and interaction layer. Reads/writes `state` from store.js.
   ========================================================================== */

let currentPage = 'dashboard';
let quoteIdx = Math.floor(Math.random()*QUOTES.length);

/* ---------------- Boot ---------------- */
window.addEventListener('DOMContentLoaded', boot);

async function boot(){
  applyTheme();
  wireAuthForms();
  wireShellChrome();
  setTimeout(async ()=>{
    document.getElementById('loaderScreen').style.opacity = '0';
    document.getElementById('loaderScreen').style.visibility = 'hidden';

    if(typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED){
      const session = await sbGetSession();
      if(session){
        window.__sbUserId = session.user.id;
        const cloudState = await sbLoadState(session.user.id);
        if(cloudState) state = Object.assign(defaultState(), cloudState);
        state.auth = { loggedIn:true, currentUserEmail: session.user.email };
        save();
        enterApp();
        return;
      }
    }
    if(state.auth.loggedIn){ enterApp(); } else { showAuth('login'); }
  }, 550);
}

function showAuth(view){
  document.getElementById('authShell').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('mobileNav').classList.add('hidden');
  document.getElementById('loginView').classList.toggle('hidden', view!=='login');
  document.getElementById('signupView').classList.toggle('hidden', view!=='signup');
}

function enterApp(){
  document.getElementById('authShell').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('mobileNav').classList.remove('hidden');
  refreshUserChip();
  go('dashboard');
}

function wireAuthForms(){
  document.getElementById('goSignup').onclick = ()=>showAuth('signup');
  document.getElementById('goLogin').onclick = ()=>showAuth('login');

  document.getElementById('loginForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pw = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');

    if(typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED){
      const r = await sbSignIn(email, pw);
      if(!r.ok){ errEl.textContent = r.msg; errEl.classList.remove('hidden'); return; }
      window.__sbUserId = r.user.id;
      const cloudState = await sbLoadState(r.user.id);
      if(cloudState) state = Object.assign(defaultState(), cloudState);
      state.auth = { loggedIn:true, currentUserEmail: r.user.email };
      save();
      errEl.classList.add('hidden');
      enterApp();
      return;
    }

    const r = login(email, pw);
    if(!r.ok){ errEl.textContent = r.msg; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    enterApp();
  });

  document.getElementById('signupForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const pw = document.getElementById('signupPassword').value;
    const errEl = document.getElementById('signupError');

    if(typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED){
      const r = await sbSignUp(name, email, pw);
      if(!r.ok){ errEl.textContent = r.msg; errEl.classList.remove('hidden'); return; }
      errEl.classList.add('hidden');
      if(r.needsEmailConfirm){
        toast('Check your email to confirm your account, then sign in.', 'info');
        showAuth('login');
        return;
      }
      window.__sbUserId = r.user.id;
      state = defaultState();
      state.profile.fullName = name;
      state.auth = { loggedIn:true, currentUserEmail: r.user.email };
      save();
      enterApp();
      toast('Account created — welcome to LifeOS AI!', 'success');
      return;
    }

    const r = signup(name, email, pw);
    if(!r.ok){ errEl.textContent = r.msg; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    enterApp();
    toast('Account created — welcome to LifeOS AI!', 'success');
  });
}

function wireShellChrome(){
  document.getElementById('themeToggle').addEventListener('click', ()=>{
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    save(); applyTheme();
  });
  document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    if(typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED){ await sbSignOut(); window.__sbUserId = null; }
    logout();
    showAuth('login');
  });
  document.getElementById('userChipBtn').addEventListener('click', ()=>go('profile'));
  document.getElementById('notifBtn').addEventListener('click', openNotifPanel);

  document.querySelectorAll('.nav-link, .mobile-nav a').forEach(el=>{
    el.addEventListener('click', ()=> go(el.dataset.page));
  });
}

function applyTheme(){
  document.documentElement.setAttribute('data-theme', state.theme);
  const knobIcon = document.querySelector('.theme-toggle .knob i');
  if(knobIcon) knobIcon.className = state.theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
}

function refreshUserChip(){
  const p = state.profile;
  const initials = (p.fullName||state.auth.currentUserEmail||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const avatarEl = document.getElementById('sidebarAvatar');
  avatarEl.innerHTML = p.photo ? `<img src="${p.photo}">` : initials || '?';
  document.getElementById('sidebarName').textContent = p.fullName || state.auth.currentUserEmail || 'Set your name';
  document.getElementById('sidebarLevel').textContent = `${p.level||'Intern'} · ${p.xp||0} XP`;
  const unread = (state.notifications||[]).some(n=>!n.read);
  document.getElementById('notifDot').classList.toggle('hidden', !unread);
}

/* ---------------- Router ---------------- */
const PAGE_META = {
  dashboard:  ['Dashboard', 'LIFEOS / DASHBOARD'],
  profile:    ['Profile', 'LIFEOS / PROFILE'],
  academics:  ['Academics', 'LIFEOS / GROWTH / ACADEMICS'],
  career:     ['Career', 'LIFEOS / GROWTH / CAREER'],
  habits:     ['Habits', 'LIFEOS / GROWTH / HABITS'],
  health:     ['Health', 'LIFEOS / GROWTH / HEALTH'],
  finance:    ['Finance', 'LIFEOS / MONEY / FINANCE'],
  investments:['Investments', 'LIFEOS / MONEY / INVESTMENTS'],
  loans:      ['Loans', 'LIFEOS / MONEY / LOANS'],
  fi:         ['Financial Independence', 'LIFEOS / MONEY / FI TRACKER'],
  goals:      ['Goals', 'LIFEOS / VISION / GOALS'],
  future:     ['Future Plans', 'LIFEOS / VISION / FUTURE PLANS'],
  visionboard:['Vision Board', 'LIFEOS / VISION / BOARD'],
  documents:  ['Documents', 'LIFEOS / VISION / DOCUMENTS'],
  review:     ['Weekly Review', 'LIFEOS / VISION / WEEKLY REVIEW'],
};

function go(page){
  currentPage = page;
  document.getElementById('pageTitle').textContent = PAGE_META[page][0];
  document.getElementById('pageBreadcrumb').textContent = PAGE_META[page][1];
  document.querySelectorAll('.nav-link, .mobile-nav a').forEach(el=>{
    el.classList.toggle('active', el.dataset.page === page);
  });
  render();
  const contentEl = document.getElementById('pageContent');
  if(contentEl && typeof contentEl.scrollIntoView === 'function'){
    contentEl.scrollIntoView({behavior:'instant', block:'start'});
  }
  window.scrollTo && window.scrollTo(0,0);
}

function render(){
  refreshUserChip();
  const c = document.getElementById('pageContent');
  const renderers = {
    dashboard: renderDashboard, profile: renderProfile, academics: renderAcademics,
    career: renderCareer, habits: renderHabits, health: renderHealth, finance: renderFinance,
    investments: renderInvestments, loans: renderLoans, fi: renderFI, goals: renderGoals,
    future: renderFuture, visionboard: renderVisionBoard, documents: renderDocuments, review: renderReview
  };
  c.innerHTML = `<div class="page">${renderers[currentPage]()}</div>`;
  wirePageEvents(currentPage);
}

/* ---------------- Small UI helpers ---------------- */
function toast(msg, kind){
  kind = kind || 'info';
  const colors = { success:'var(--emerald)', info:'var(--navy-accent)', danger:'var(--danger)', warn:'var(--amber)' };
  const icons = { success:'fa-circle-check', info:'fa-circle-info', danger:'fa-circle-exclamation', warn:'fa-triangle-exclamation' };
  const el = document.createElement('div');
  el.className = 'toast glass';
  el.style.borderLeft = `3px solid ${colors[kind]}`;
  el.innerHTML = `<i class="fa-solid ${icons[kind]}" style="color:${colors[kind]}"></i><span>${escapeHtml(msg)}</span>`;
  document.getElementById('toastStack').appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(30px)'; setTimeout(()=>el.remove(),350); }, 3200);
}

function openModal(title, bodyHtml, footHtml){
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box glass">
        <div class="modal-head">
          <h3 style="font-family:var(--font-display);font-size:19px;">${title}</h3>
          <button class="icon-btn" id="modalClose"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="modalBody">${bodyHtml}</div>
        ${footHtml ? `<div style="display:flex;gap:10px;margin-top:20px;">${footHtml}</div>` : ''}
      </div>
    </div>`;
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalOverlay').addEventListener('click', e=>{
    if(e.target.id === 'modalOverlay') closeModal();
  });
}
function closeModal(){ document.getElementById('modalRoot').innerHTML = ''; }

function escapeHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function scoreColor(n){
  if(n>=75) return 'var(--emerald)';
  if(n>=50) return 'var(--gold)';
  if(n>=25) return 'var(--amber)';
  return 'var(--rose)';
}

function ringSVG(pct, size, strokeWidth, color, big, labelNum, labelText){
  size = size||90; strokeWidth = strokeWidth||8;
  const r = (size - strokeWidth)/2;
  const c = 2*Math.PI*r;
  const off = c - (clamp(pct,0,100)/100)*c;
  return `
    <div class="ring-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${strokeWidth}"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset 1s var(--ease);"/>
      </svg>
      <div class="ring-label">
        <span class="n" style="font-size:${big?'22px':'15px'};">${labelNum}</span>
        ${labelText? `<span class="l">${labelText}</span>` : ''}
      </div>
    </div>`;
}

function progressBar(pct, color){
  return `<div class="progress-track"><div class="progress-fill" style="width:${clamp(pct,0,100)}%;background:${color||'var(--gold)'};"></div></div>`;
}

function emptyState(icon, text){
  return `<div class="empty-state"><i class="fa-solid ${icon}"></i><div>${text}</div></div>`;
}

function confirmDelete(label, onYes){
  openModal('Remove ' + label + '?',
    `<p style="color:var(--text-secondary);font-size:14px;">This can't be undone. Are you sure you want to remove this ${label.toLowerCase()}?</p>`,
    `<button class="btn btn-ghost btn-block" id="cancelDel">Cancel</button><button class="btn btn-danger btn-block" id="confirmDel">Remove</button>`);
  document.getElementById('cancelDel').onclick = closeModal;
  document.getElementById('confirmDel').onclick = ()=>{ onYes(); closeModal(); };
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */
function renderDashboard(){
  const overall = overallLifeScore();
  const modules = [
    { key:'academics', label:'Academics', score:scoreAcademic(), color:'var(--blue)', angle:270 },
    { key:'career', label:'Career', score:scoreCareer(), color:'var(--navy-accent)', angle:310 },
    { key:'finance', label:'Finance', score:scoreFinance(), color:'var(--emerald)', angle:350 },
    { key:'investment', label:'Invest', score:scoreInvestment(), color:'var(--gold)', angle:30 },
    { key:'savings', label:'Savings', score:scoreSavings(), color:'var(--emerald)', angle:70 },
    { key:'habits', label:'Habits', score:scoreHabits(), color:'var(--rose)', angle:110 },
    { key:'health', label:'Health', score:scoreHealth(), color:'var(--amber)', angle:150 },
  ];
  const quote = QUOTES[quoteIdx];
  const fs = financeSummary();
  const ef = emergencyFundStatus();
  const goalsPct = goalCompletionPct();

  const nodesHtml = modules.map(m=>{
    const rad = (m.angle * Math.PI)/180;
    const R = 38;
    const x = 50 + R*Math.cos(rad);
    const y = 50 + R*Math.sin(rad)*0.72;
    return `<div class="node" style="left:${x}%; top:${y}%;">
      <div class="dot" style="border-color:${m.color};color:${m.color};">${m.score}</div>
      <div class="lbl">${m.label}</div>
    </div>`;
  }).join('');

  return `
    <div class="quote-banner glass" style="margin-bottom:22px;">
      <i class="fa-solid fa-quote-left"></i>
      <div><p>"${escapeHtml(quote)}"</p><span>Today's LifeOS reflection</span></div>
    </div>

    <div class="constellation glass card" style="margin-bottom:22px;">
      ${nodesHtml}
      <div class="node center" style="left:50%; top:50%;">
        <div class="dot" style="border-color:var(--gold); color:var(--gold);">${overall}</div>
        <div class="lbl">Overall Life Score</div>
      </div>
    </div>

    <div class="grid grid-4" style="margin-bottom:22px;">
      <div class="glass card">
        <div class="card-title"><i class="fa-solid fa-sack-dollar"></i>Monthly Net</div>
        <div class="stat-num">${fmtMoney(fs.net)}</div>
        <div class="trend ${fs.net>=0?'up':'down'}"><i class="fa-solid fa-arrow-${fs.net>=0?'up':'down'}"></i>${fs.savingsRatio.toFixed(0)}% savings rate</div>
      </div>
      <div class="glass card">
        <div class="card-title"><i class="fa-solid fa-shield-halved"></i>Emergency Fund</div>
        <div class="stat-num">${ef.pct.toFixed(0)}%</div>
        ${progressBar(ef.pct,'var(--emerald)')}
      </div>
      <div class="glass card">
        <div class="card-title"><i class="fa-solid fa-bullseye"></i>Goals Progress</div>
        <div class="stat-num">${goalsPct}%</div>
        ${progressBar(goalsPct,'var(--gold)')}
      </div>
      <div class="glass card">
        <div class="card-title"><i class="fa-solid fa-medal"></i>Corporate Readiness</div>
        <div class="stat-num">${corporateReadinessScore()}</div>
        ${progressBar(corporateReadinessScore(),'var(--navy-accent)')}
      </div>
    </div>

    <div class="grid grid-a2b1">
      <div class="glass card">
        <div class="card-title"><i class="fa-solid fa-wand-magic-sparkles"></i>This Week's AI Priorities</div>
        <div style="margin-top:14px; display:flex; flex-direction:column; gap:10px;">
          ${buildAIPriorities().map(p=>`<div class="ai-note"><i class="fa-solid fa-star"></i><span>${escapeHtml(p)}</span></div>`).join('')}
        </div>
      </div>
      <div class="glass card">
        <div class="card-title"><i class="fa-solid fa-chart-pie"></i>Life Wheel</div>
        ${lifeWheelBars()}
      </div>
    </div>
  `;
}

function lifeWheelBars(){
  const lw = lifeWheelData();
  return `<div style="display:flex; flex-direction:column; gap:12px; margin-top:14px;">
    ${lw.labels.map((l,i)=>`
      <div>
        <div style="display:flex; justify-content:space-between; font-size:12.5px; color:var(--text-secondary); margin-bottom:5px;">
          <span>${l}</span><span class="mono">${Math.round(lw.values[i])}</span>
        </div>
        ${progressBar(lw.values[i], scoreColor(lw.values[i]))}
      </div>`).join('')}
  </div>`;
}

/* ==========================================================================
   NOTIFICATIONS PANEL
   ========================================================================== */
function openNotifPanel(){
  const list = state.notifications||[];
  const body = list.length ? list.map(n=>`
    <div class="list-row">
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <i class="fa-solid ${n.icon||'fa-bell'}" style="color:var(--gold); margin-top:3px;"></i>
        <div>
          <div style="font-size:13.5px;">${escapeHtml(n.text)}</div>
          <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">${new Date(n.time).toLocaleString()}</div>
        </div>
      </div>
    </div>`).join('') : emptyState('fa-bell-slash','No notifications yet.');
  openModal('Notifications', `<div style="max-height:60vh; overflow-y:auto;">${body}</div>`,
    list.length ? `<button class="btn btn-ghost btn-block" id="clearNotifs">Clear all</button>` : '');
  (state.notifications||[]).forEach(n=>n.read=true);
  save(); refreshUserChip();
  const clearBtn = document.getElementById('clearNotifs');
  if(clearBtn) clearBtn.onclick = ()=>{ state.notifications=[]; save(); closeModal(); refreshUserChip(); };
}

/* ==========================================================================
   PROFILE
   ========================================================================== */
function renderProfile(){
  const p = state.profile;
  const field = (label, id, val, type) => `
    <div class="field"><label>${label}</label><input type="${type||'text'}" id="${id}" value="${escapeHtml(val)}"></div>`;
  const select = (label, id, val, opts) => `
    <div class="field"><label>${label}</label><select id="${id}">
      ${opts.map(o=>`<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('')}
    </select></div>`;

  return `
  <div class="grid grid-a2b1">
    <div class="glass card">
      <div class="card-title"><i class="fa-solid fa-id-card"></i>Personal & Career Profile</div>
      <div style="margin-top:16px;">
        <div class="field-row">
          ${field('Full name','pFullName',p.fullName)}
          ${field('Age','pAge',p.age,'number')}
        </div>
        <div class="field-row">
          ${select('Gender','pGender',p.gender,['','Female','Male','Other','Prefer not to say'])}
          ${select('Country','pCountry',p.country,['Kenya','Uganda','Tanzania','Rwanda','Other'])}
        </div>
        <div class="field-row">
          ${field('City','pCity',p.city)}
          ${field('University','pUniversity',p.university)}
        </div>
        <div class="field-row">
          ${field('Highest education','pEducation',p.highestEducation)}
          ${field('Occupation','pOccupation',p.occupation)}
        </div>
        <div class="field-row">
          ${field('Industry','pIndustry',p.industry)}
          ${select('Risk appetite','pRisk',p.riskAppetite,['Conservative','Moderate','Aggressive'])}
        </div>
        <div class="field-row">
          ${field('Current monthly salary (KES)','pCurSalary',p.currentSalary,'number')}
          ${field('Expected salary (KES)','pExpSalary',p.expectedSalary,'number')}
        </div>
        <div class="field-row">
          ${field('Years of experience','pYears',p.yearsExperience,'number')}
          ${field('Target retirement age','pRetireAge',p.targetRetirementAge,'number')}
        </div>
        <div class="field"><label>Career goals</label><textarea id="pCareerGoals">${escapeHtml(p.careerGoals)}</textarea></div>
        <div class="field"><label>Financial goals</label><textarea id="pFinGoals">${escapeHtml(p.financialGoals)}</textarea></div>
        <div class="field-row">
          ${field('Skills (comma separated)','pSkills',p.skills)}
          ${field('Certificates (comma separated)','pCerts',p.certificates)}
        </div>
        <div class="field-row">
          ${field('Languages','pLang',p.languages)}
          ${field('Interests','pInterests',p.interests)}
        </div>
        <div class="field-row">
          ${field('Dream house','pHouse',p.dreamHouse)}
          ${field('Dream car','pCar',p.dreamCar)}
        </div>
        <button class="btn btn-primary" id="saveProfileBtn"><i class="fa-solid fa-check"></i>Save Profile</button>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:18px;">
      <div class="glass card" style="text-align:center;">
        <div class="avatar" style="width:84px; height:84px; margin:0 auto 14px; font-size:26px;">
          ${p.photo? `<img src="${p.photo}">` : (p.fullName||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
        </div>
        <div style="font-weight:700; font-size:16px;">${escapeHtml(p.fullName||'Set your name')}</div>
        <div style="color:var(--text-tertiary); font-size:13px; margin-top:2px;">${escapeHtml(p.occupation||'Add your occupation')}</div>
        <div class="rank-badge" style="margin-top:14px;"><i class="fa-solid fa-star"></i>${p.level||'Intern'} · ${p.xp||0} XP</div>
        <input type="file" id="photoInput" accept="image/*" class="hidden">
        <button class="btn btn-ghost btn-sm btn-block" style="margin-top:14px;" id="uploadPhotoBtn"><i class="fa-solid fa-camera"></i>Change photo</button>
      </div>
      <div class="glass card">
        <div class="card-title"><i class="fa-solid fa-gauge-high"></i>Overall Life Score</div>
        <div style="display:flex; justify-content:center; margin-top:14px;">
          ${ringSVG(overallLifeScore(), 130, 10, 'var(--gold)', true, overallLifeScore(), '/ 100')}
        </div>
      </div>
      <div class="glass card">
        <div class="card-title"><i class="fa-solid fa-palette"></i>Appearance</div>
        <div style="margin-top:12px; font-size:13px; color:var(--text-secondary);">Toggle theme from the top bar. Currently: <strong>${state.theme}</strong>.</div>
      </div>
    </div>
  </div>`;
}

function saveProfileFromForm(){
  const p = state.profile;
  p.fullName = val('pFullName'); p.age = num('pAge'); p.gender = val('pGender');
  p.country = val('pCountry'); p.city = val('pCity'); p.university = val('pUniversity');
  p.highestEducation = val('pEducation'); p.occupation = val('pOccupation'); p.industry = val('pIndustry');
  p.riskAppetite = val('pRisk'); p.currentSalary = num('pCurSalary'); p.expectedSalary = num('pExpSalary');
  p.yearsExperience = num('pYears'); p.targetRetirementAge = num('pRetireAge');
  p.careerGoals = val('pCareerGoals'); p.financialGoals = val('pFinGoals');
  p.skills = val('pSkills'); p.certificates = val('pCerts'); p.languages = val('pLang'); p.interests = val('pInterests');
  p.dreamHouse = val('pHouse'); p.dreamCar = val('pCar');
  save();
  toast('Profile saved.', 'success');
  refreshUserChip();
}

function val(id){ const el = document.getElementById(id); return el ? el.value : ''; }
function num(id){ const el = document.getElementById(id); return el ? Number(el.value)||0 : 0; }

/* ==========================================================================
   ACADEMICS
   ========================================================================== */
function renderAcademics(){
  const a = state.academics;
  const books = a.coursesTracked||[];
  return `
  <div class="module-hero theme-academics">
    <div><h2><i class="fa-solid fa-graduation-cap hero-icon" style="margin-right:10px;"></i>Academics</h2>
    <p>Track your CGPA, study discipline and reading habit — the foundation your career score is built on.</p></div>
    ${ringSVG(scoreAcademic(), 96, 8, 'var(--blue)', false, scoreAcademic(), '/100')}
  </div>

  <div class="grid grid-4" style="margin-bottom:22px;">
    <div class="glass card">
      <div class="field"><label>Current CGPA</label><input type="number" step="0.01" id="acgpa" value="${escapeHtml(a.cgpa)}"></div>
    </div>
    <div class="glass card">
      <div class="field"><label>Semester</label><input type="text" id="asem" value="${escapeHtml(a.semester)}"></div>
    </div>
    <div class="glass card">
      <div class="field"><label>Weekly study hours</label><input type="number" id="astudy" value="${a.studyHours}"></div>
    </div>
    <div class="glass card">
      <div class="field"><label>Study streak (days)</label><input type="number" id="astreak" value="${a.streak}"></div>
    </div>
  </div>
  <button class="btn btn-primary" id="saveAcademicsBtn" style="margin-bottom:22px;"><i class="fa-solid fa-check"></i>Save</button>

  <div class="glass card">
    <div class="card-title"><i class="fa-solid fa-book"></i>Books Read (${a.booksRead||0})</div>
    <div style="display:flex; gap:10px; align-items:center; margin-top:12px;">
      <button class="btn btn-sm btn-ghost" id="bookMinus"><i class="fa-solid fa-minus"></i></button>
      <div class="stat-num" style="font-size:20px;">${a.booksRead||0}</div>
      <button class="btn btn-sm btn-ghost" id="bookPlus"><i class="fa-solid fa-plus"></i></button>
    </div>
  </div>`;
}

/* ==========================================================================
   CAREER
   ========================================================================== */
function renderCareer(){
  const c = state.career;
  const apps = c.applications||[];
  const interviews = c.interviews||[];
  const roadmapOpts = Object.keys(CAREER_ROADMAPS);
  const selectedRoadmap = state._selectedRoadmap || roadmapOpts[0];
  const rm = CAREER_ROADMAPS[selectedRoadmap];

  return `
  <div class="module-hero theme-career">
    <div><h2><i class="fa-solid fa-briefcase hero-icon" style="margin-right:10px;"></i>Career</h2>
    <p>Applications, interviews, network growth and your path to corporate readiness.</p></div>
    ${ringSVG(scoreCareer(), 96, 8, 'var(--navy-accent)', false, scoreCareer(), '/100')}
  </div>

  <div class="grid grid-4" style="margin-bottom:22px;">
    <div class="glass card"><div class="stat-num">${apps.length}</div><div class="stat-label">Applications</div></div>
    <div class="glass card"><div class="stat-num">${interviews.length}</div><div class="stat-label">Interviews</div></div>
    <div class="glass card"><div class="stat-num">${corporateReadinessScore()}</div><div class="stat-label">Corp. Readiness</div></div>
    <div class="glass card"><div class="stat-num">${c.cvVersion||1}</div><div class="stat-label">CV Version</div></div>
  </div>

  <div class="grid grid-2" style="margin-bottom:22px;">
    <div class="glass card">
      <div class="field-row">
        <div class="field"><label>Network contacts</label><input type="number" id="cNetwork" value="${c.networkContacts||0}"></div>
        <div class="field"><label>CV version</label><input type="number" id="cCV" value="${c.cvVersion||1}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>LinkedIn connections</label><input type="number" id="cLiCurrent" value="${c.linkedinCurrent||0}"></div>
        <div class="field"><label>LinkedIn goal</label><input type="number" id="cLiGoal" value="${c.linkedinGoal||0}"></div>
      </div>
      <button class="btn btn-primary btn-sm" id="saveCareerStatsBtn">Save</button>
    </div>
    <div class="glass card">
      <div class="card-title"><i class="fa-solid fa-route"></i>Career Roadmap</div>
      <div class="field" style="margin-top:12px;">
        <select id="roadmapSelect">${roadmapOpts.map(o=>`<option value="${o}" ${o===selectedRoadmap?'selected':''}>${o}</option>`).join('')}</select>
      </div>
      <div class="timeline-track theme-career" style="margin-top:14px;">
        ${rm.steps.map((s,i)=>`<div class="timeline-item ${i===0?'done':''}"><h4>${escapeHtml(s)}</h4></div>`).join('')}
      </div>
      <div style="font-size:12.5px; color:var(--text-secondary); margin-top:6px;"><strong>Certs:</strong> ${rm.certs.join(', ')}</div>
      <div style="font-size:12.5px; color:var(--text-secondary); margin-top:4px;"><strong>Path:</strong> ${rm.salaryPath}</div>
    </div>
  </div>

  <div class="grid grid-2">
    <div class="glass card">
      <div class="card-title"><i class="fa-solid fa-paper-plane"></i>Applications
        <button class="icon-btn" style="margin-left:auto; width:28px; height:28px;" id="addAppBtn"><i class="fa-solid fa-plus" style="font-size:11px;"></i></button>
      </div>
      <div style="margin-top:10px;">
        ${apps.length ? apps.map(a=>`
          <div class="list-row">
            <div><div style="font-weight:600; font-size:13.5px;">${escapeHtml(a.company)}</div>
            <div style="font-size:11.5px; color:var(--text-tertiary);">${escapeHtml(a.role)} · ${escapeHtml(a.status||'Applied')}</div></div>
            <button class="icon-btn" data-del-app="${a.id}" style="width:30px;height:30px;"><i class="fa-solid fa-trash" style="font-size:11px;"></i></button>
          </div>`).join('') : emptyState('fa-inbox','No applications logged yet.')}
      </div>
    </div>
    <div class="glass card">
      <div class="card-title"><i class="fa-solid fa-comments"></i>Interviews
        <button class="icon-btn" style="margin-left:auto; width:28px; height:28px;" id="addInterviewBtn"><i class="fa-solid fa-plus" style="font-size:11px;"></i></button>
      </div>
      <div style="margin-top:10px;">
        ${interviews.length ? interviews.map(iv=>`
          <div class="list-row">
            <div><div style="font-weight:600; font-size:13.5px;">${escapeHtml(iv.company)}</div>
            <div style="font-size:11.5px; color:var(--text-tertiary);">${escapeHtml(iv.stage||'Round 1')} · ${escapeHtml(iv.date||'')}</div></div>
            <button class="icon-btn" data-del-interview="${iv.id}" style="width:30px;height:30px;"><i class="fa-solid fa-trash" style="font-size:11px;"></i></button>
          </div>`).join('') : emptyState('fa-comments','No interviews logged yet.')}
      </div>
    </div>
  </div>`;
}

/* ==========================================================================
   HABITS
   ========================================================================== */
function renderHabits(){
  const h = state.habits||[];
  return `
  <div class="module-hero theme-future" style="--mod-accent:var(--rose);">
    <div><h2><i class="fa-solid fa-repeat hero-icon" style="margin-right:10px;"></i>Habits</h2>
    <p>Consistency compounds. Track the habits that build the person you're becoming.</p></div>
    ${ringSVG(scoreHabits(), 96, 8, 'var(--rose)', false, scoreHabits(), '/100')}
  </div>
  <div class="glass card">
    <div class="card-title"><i class="fa-solid fa-list-check"></i>My Habits
      <button class="icon-btn" style="margin-left:auto; width:28px; height:28px;" id="addHabitBtn"><i class="fa-solid fa-plus" style="font-size:11px;"></i></button>
    </div>
    <div style="margin-top:12px;">
      ${h.length ? h.map(x=>`
        <div class="list-row">
          <div style="flex:1;">
            <div style="font-weight:600; font-size:13.5px;">${escapeHtml(x.name)}</div>
            <div style="margin-top:6px;">${progressBar(x.consistency||0, scoreColor(x.consistency||0))}</div>
          </div>
          <div class="mono" style="width:44px; text-align:right;">${x.consistency||0}%</div>
          <button class="icon-btn" data-del-habit="${x.id}" style="width:30px;height:30px;"><i class="fa-solid fa-trash" style="font-size:11px;"></i></button>
        </div>`).join('') : emptyState('fa-repeat','No habits tracked yet. Add your first one.')}
    </div>
  </div>`;
}

/* ==========================================================================
   HEALTH
   ========================================================================== */
function renderHealth(){
  const h = state.health;
  return `
  <div class="module-hero theme-health">
    <div><h2><i class="fa-solid fa-heart-pulse hero-icon" style="margin-right:10px;"></i>Health</h2>
    <p>Your body is the vehicle for everything else on this dashboard.</p></div>
    ${ringSVG(scoreHealth(), 96, 8, 'var(--emerald)', false, scoreHealth(), '/100')}
  </div>
  <div class="grid grid-4" style="margin-bottom:22px;">
    <div class="glass card"><div class="field"><label>Exercise (sessions/wk)</label><input type="number" id="hExercise" value="${h.exercise||0}"></div></div>
    <div class="glass card"><div class="field"><label>Sleep (hrs/night)</label><input type="number" id="hSleep" value="${h.sleepHours||0}"></div></div>
    <div class="glass card"><div class="field"><label>Water (glasses/day)</label><input type="number" id="hWater" value="${h.waterIntake||0}"></div></div>
    <div class="glass card"><div class="field"><label>Mental wellbeing (1-10)</label><input type="number" id="hMental" value="${h.mentalHealth||0}"></div></div>
  </div>
  <button class="btn btn-primary" id="saveHealthBtn"><i class="fa-solid fa-check"></i>Save</button>`;
}

/* ==========================================================================
   FINANCE
   ========================================================================== */
function renderFinance(){
  const f = state.finance;
  const fs = financeSummary();
  const expLabels = { rent:'Rent', food:'Food', transport:'Transport', electricity:'Electricity', water:'Water',
    internet:'Internet', entertainment:'Entertainment', insurance:'Insurance', healthcare:'Healthcare',
    shopping:'Shopping', family:'Family Support', subscriptions:'Subscriptions', loans:'Loan Repayments', others:'Others' };

  return `
  <div class="module-hero theme-finance">
    <div><h2><i class="fa-solid fa-sack-dollar hero-icon" style="margin-right:10px;"></i>Finance</h2>
    <p>Income in, expenses out, and the discipline in between.</p></div>
    ${ringSVG(scoreFinance(), 96, 8, 'var(--emerald)', false, scoreFinance(), '/100')}
  </div>

  <div class="grid grid-4" style="margin-bottom:22px;">
    <div class="glass card"><div class="stat-num">${fmtMoney(fs.income)}</div><div class="stat-label">Monthly Income</div></div>
    <div class="glass card"><div class="stat-num">${fmtMoney(fs.expenses)}</div><div class="stat-label">Monthly Expenses</div></div>
    <div class="glass card"><div class="stat-num" style="color:${fs.net>=0?'var(--emerald)':'var(--danger)'};">${fmtMoney(fs.net)}</div><div class="stat-label">Net Cashflow</div></div>
    <div class="glass card"><div class="stat-num">${fs.savingsRatio.toFixed(0)}%</div><div class="stat-label">Savings Rate</div></div>
  </div>

  <div class="grid grid-2" style="margin-bottom:22px;">
    <div class="glass card">
      <div class="card-title"><i class="fa-solid fa-arrow-trend-up"></i>Income Sources</div>
      <div class="field"><label>Monthly salary (KES)</label><input type="number" id="fSalary" value="${f.monthlySalary||0}"></div>
      <div class="field"><label>Weekly income (KES)</label><input type="number" id="fWeekly" value="${f.weeklyIncome||0}"></div>
      <div class="field"><label>Side hustle (KES/mo)</label><input type="number" id="fSide" value="${f.sideHustle||0}"></div>
      <div class="field"><label>Passive income (KES/mo)</label><input type="number" id="fPassive" value="${f.passiveIncome||0}"></div>
      <div class="field"><label>Annual bonuses (KES)</label><input type="number" id="fBonus" value="${f.bonuses||0}"></div>
      <button class="btn btn-primary btn-sm" id="saveIncomeBtn">Save Income</button>
    </div>
    <div class="glass card">
      <div class="card-title"><i class="fa-solid fa-arrow-trend-down"></i>Monthly Expenses</div>
      <div style="max-height:360px; overflow-y:auto; padding-right:4px;">
        ${Object.keys(expLabels).map(k=>`
          <div class="field"><label>${expLabels[k]} (KES)</label><input type="number" id="fx_${k}" value="${f.expenses[k]||0}"></div>
        `).join('')}
      </div>
      <button class="btn btn-primary btn-sm" id="saveExpensesBtn">Save Expenses</button>
    </div>
  </div>

  <div class="glass card">
    <div class="card-title"><i class="fa-solid fa-shield-halved"></i>Emergency Fund</div>
    <div class="field-row" style="margin-top:12px;">
      <div class="field"><label>Current amount (KES)</label><input type="number" id="efCurrent" value="${state.emergencyFundCurrent||0}"></div>
      <div class="field"><label>Target (months of expenses)</label><input type="number" id="efTarget" value="${state.emergencyFundTarget||6}"></div>
    </div>
    <button class="btn btn-primary btn-sm" id="saveEFBtn">Save</button>
    <div style="margin-top:14px;">${progressBar(emergencyFundStatus().pct,'var(--emerald)')}</div>
    <div style="font-size:12.5px; color:var(--text-secondary); margin-top:6px;">Target: ${fmtMoney(emergencyFundStatus().target)}</div>
  </div>`;
}

/* ==========================================================================
   INVESTMENTS
   ========================================================================== */
function renderInvestments(){
  const invs = state.investments||[];
  const totalVal = invs.reduce((a,i)=>a+(Number(i.currentValue)||0),0);
  const alloc = suggestInvestmentAllocation();
  return `
  <div class="module-hero theme-investment">
    <div><h2><i class="fa-solid fa-coins hero-icon" style="margin-right:10px;"></i>Investments</h2>
    <p>Where your money works while you sleep.</p></div>
    ${ringSVG(scoreInvestment(), 96, 8, 'var(--gold)', false, scoreInvestment(), '/100')}
  </div>

  <div class="grid grid-3" style="margin-bottom:22px;">
    <div class="glass card"><div class="stat-num">${fmtMoney(totalVal)}</div><div class="stat-label">Portfolio Value</div></div>
    <div class="glass card"><div class="stat-num">${invs.length}</div><div class="stat-label">Holdings</div></div>
    <div class="glass card"><div class="stat-num">${new Set(invs.map(i=>i.category)).size}</div><div class="stat-label">Asset Classes</div></div>
  </div>

  <div class="grid grid-a2b1">
    <div class="glass card">
      <div class="card-title"><i class="fa-solid fa-wallet"></i>My Holdings
        <button class="icon-btn" style="margin-left:auto; width:28px; height:28px;" id="addInvBtn"><i class="fa-solid fa-plus" style="font-size:11px;"></i></button>
      </div>
      <div style="margin-top:10px;">
        ${invs.length ? `<table><thead><tr><th>Name</th><th>Category</th><th>Value</th><th></th></tr></thead><tbody>
          ${invs.map(i=>`<tr>
            <td>${escapeHtml(i.name)}</td><td><span class="chip gold">${escapeHtml(i.category)}</span></td>
            <td class="mono">${fmtMoney(i.currentValue)}</td>
            <td><button class="icon-btn" data-del-inv="${i.id}" style="width:28px;height:28px;"><i class="fa-solid fa-trash" style="font-size:10px;"></i></button></td>
          </tr>`).join('')}</tbody></table>` : emptyState('fa-coins','No investments logged yet.')}
      </div>
    </div>
    <div class="glass card">
      <div class="card-title"><i class="fa-solid fa-robot"></i>AI Suggested Allocation</div>
      <div style="margin-top:12px; display:flex; flex-direction:column; gap:12px;">
        ${alloc.map(a=>`
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12.5px; color:var(--text-secondary); margin-bottom:5px;">
              <span>${a.name}</span><span class="mono">${a.pct}%</span>
            </div>${progressBar(a.pct,'var(--gold)')}
          </div>`).join('')}
      </div>
      <div class="ai-note" style="margin-top:14px;"><i class="fa-solid fa-lightbulb"></i><span>Based on your age and ${state.profile.riskAppetite||'Moderate'} risk appetite.</span></div>
    </div>
  </div>`;
}

/* ==========================================================================
   LOANS
   ========================================================================== */
function renderLoans(){
  const loans = state.loans||[];
  const totalPay = loans.reduce((a,l)=>a+(Number(l.monthlyPayment)||0),0);
  const totalBal = loans.reduce((a,l)=>a+(Number(l.balance)||0),0);
  return `
  <div class="module-hero theme-finance">
    <div><h2><i class="fa-solid fa-file-invoice-dollar hero-icon" style="margin-right:10px;"></i>Loans</h2>
    <p>Know exactly what you owe and what it costs you monthly.</p></div>
  </div>
  <div class="grid grid-3" style="margin-bottom:22px;">
    <div class="glass card"><div class="stat-num">${fmtMoney(totalBal)}</div><div class="stat-label">Total Balance</div></div>
    <div class="glass card"><div class="stat-num">${fmtMoney(totalPay)}</div><div class="stat-label">Monthly Payments</div></div>
    <div class="glass card"><div class="stat-num">${financeSummary().debtRatio.toFixed(0)}%</div><div class="stat-label">Debt-to-Income</div></div>
  </div>
  <div class="glass card">
    <div class="card-title"><i class="fa-solid fa-hand-holding-dollar"></i>Active Loans
      <button class="icon-btn" style="margin-left:auto; width:28px; height:28px;" id="addLoanBtn"><i class="fa-solid fa-plus" style="font-size:11px;"></i></button>
    </div>
    <div style="margin-top:10px;">
      ${loans.length ? `<table><thead><tr><th>Lender</th><th>Balance</th><th>Monthly</th><th></th></tr></thead><tbody>
        ${loans.map(l=>`<tr>
          <td>${escapeHtml(l.lender)}</td><td class="mono">${fmtMoney(l.balance)}</td><td class="mono">${fmtMoney(l.monthlyPayment)}</td>
          <td><button class="icon-btn" data-del-loan="${l.id}" style="width:28px;height:28px;"><i class="fa-solid fa-trash" style="font-size:10px;"></i></button></td>
        </tr>`).join('')}</tbody></table>` : emptyState('fa-check-circle','No active loans — great position to be in.')}
    </div>
  </div>`;
}

/* ==========================================================================
   FI TRACKER
   ========================================================================== */
function renderFI(){
  const fi = fiTracker();
  return `
  <div class="module-hero theme-investment">
    <div><h2><i class="fa-solid fa-fire hero-icon" style="margin-right:10px;"></i>Financial Independence</h2>
    <p>Your number, your timeline, based on the 4% rule.</p></div>
    ${ringSVG(fi.pct, 96, 8, 'var(--gold)', false, fi.pct.toFixed(0)+'%', '')}
  </div>
  <div class="grid grid-4" style="margin-bottom:22px;">
    <div class="glass card"><div class="stat-num">${fmtMoney(fi.fiNumber)}</div><div class="stat-label">FI Number</div></div>
    <div class="glass card"><div class="stat-num">${fmtMoney(fi.currentPortfolio)}</div><div class="stat-label">Current Portfolio</div></div>
    <div class="glass card"><div class="stat-num">${fmtMoney(fi.monthlyContribution)}</div><div class="stat-label">Monthly Contribution</div></div>
    <div class="glass card"><div class="stat-num">${fi.yearsToFI===null?'—':fi.yearsToFI}</div><div class="stat-label">Years to FI</div></div>
  </div>
  <div class="glass card">
    <div class="card-title"><i class="fa-solid fa-gear"></i>Target Monthly Expense at FI</div>
    <div class="field" style="margin-top:12px; max-width:320px;"><label>KES / month</label>
      <input type="number" id="fiTarget" value="${state.fiTargetMonthlyExpense||0}" placeholder="Defaults to current expenses"></div>
    <button class="btn btn-primary btn-sm" id="saveFITargetBtn">Save</button>
    ${progressBar(fi.pct,'var(--gold)')}
  </div>`;
}

/* ==========================================================================
   GOALS
   ========================================================================== */
function renderGoals(){
  const goals = state.goals||[];
  return `
  <div class="module-hero theme-future">
    <div><h2><i class="fa-solid fa-bullseye hero-icon" style="margin-right:10px;"></i>Goals</h2>
    <p>Write it down, track it, and watch it move from wish to reality.</p></div>
    ${ringSVG(goalCompletionPct(), 96, 8, 'var(--rose)', false, goalCompletionPct(), '%')}
  </div>
  <div class="glass card">
    <div class="card-title"><i class="fa-solid fa-list"></i>My Goals
      <button class="icon-btn" style="margin-left:auto; width:28px; height:28px;" id="addGoalBtn"><i class="fa-solid fa-plus" style="font-size:11px;"></i></button>
    </div>
    <div style="margin-top:10px;">
      ${goals.length ? goals.map(g=>`
        <div class="list-row">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:600; font-size:13.5px;">${escapeHtml(g.title)}</span>
              <span class="chip ${g.category==='Career'?'navy':g.category==='Finance'?'emerald':g.category==='Health'?'blue':'gold'}">${escapeHtml(g.category||'General')}</span>
              ${g.deadline? `<span style="font-size:11px; color:var(--text-tertiary);">due ${escapeHtml(g.deadline)}</span>`:''}
            </div>
            <div style="margin-top:8px;">${progressBar(g.completion||0, scoreColor(g.completion||0))}</div>
          </div>
          <div class="mono" style="width:44px; text-align:right;">${g.completion||0}%</div>
          <button class="icon-btn" data-del-goal="${g.id}" style="width:30px;height:30px;"><i class="fa-solid fa-trash" style="font-size:11px;"></i></button>
        </div>`).join('') : emptyState('fa-bullseye','No goals yet. Set your first one.')}
    </div>
  </div>`;
}

/* ==========================================================================
   FUTURE PLANS
   ========================================================================== */
function renderFuture(){
  const fp = state.futurePlans||[];
  return `
  <div class="module-hero theme-future">
    <div><h2><i class="fa-solid fa-road hero-icon" style="margin-right:10px;"></i>Future Plans</h2>
    <p>The milestones you're building toward, in order.</p></div>
  </div>
  <div class="glass card">
    <div class="card-title"><i class="fa-solid fa-flag"></i>Timeline
      <button class="icon-btn" style="margin-left:auto; width:28px; height:28px;" id="addPlanBtn"><i class="fa-solid fa-plus" style="font-size:11px;"></i></button>
    </div>
    <div class="timeline-track theme-future" style="margin-top:16px;">
      ${fp.length ? fp.map(p=>`
        <div class="timeline-item ${p.done?'done':''}">
          <h4>${escapeHtml(p.title)}
            <button class="icon-btn" data-del-plan="${p.id}" style="width:24px;height:24px; float:right;"><i class="fa-solid fa-trash" style="font-size:10px;"></i></button>
          </h4>
          <div class="when">${escapeHtml(p.targetDate||'No date set')}</div>
          <p>${escapeHtml(p.notes||'')}</p>
        </div>`).join('') : emptyState('fa-road','No future plans mapped yet.')}
    </div>
  </div>`;
}

/* ==========================================================================
   VISION BOARD
   ========================================================================== */
function renderVisionBoard(){
  const vb = state.visionBoard||[];
  return `
  <div class="module-hero theme-future">
    <div><h2><i class="fa-solid fa-image hero-icon" style="margin-right:10px;"></i>Vision Board</h2>
    <p>See it before you build it.</p></div>
  </div>
  <div class="upload-tile" id="visionUploadTile" style="margin-bottom:18px;">
    <i class="fa-solid fa-cloud-arrow-up" style="font-size:22px; display:block; margin-bottom:8px;"></i>
    Click to add an image to your vision board
    <input type="file" id="visionInput" accept="image/*" class="hidden">
  </div>
  <div class="vision-grid">
    ${vb.length ? vb.map(v=>`
      <div class="vision-tile">
        <img src="${v.img}">
        <div class="cap">${escapeHtml(v.caption||'')}</div>
        <div class="rm" data-del-vision="${v.id}"><i class="fa-solid fa-xmark"></i></div>
      </div>`).join('') : ''}
  </div>
  ${!vb.length ? emptyState('fa-image','Your vision board is empty. Add images that represent your goals.') : ''}
  `;
}

/* ==========================================================================
   DOCUMENTS
   ========================================================================== */
function renderDocuments(){
  const docs = state.documents||[];
  return `
  <div class="module-hero theme-career">
    <div><h2><i class="fa-solid fa-folder-open hero-icon" style="margin-right:10px;"></i>Documents</h2>
    <p>Keep your CV, certificates and key files one click away.</p></div>
  </div>
  <div class="upload-tile" id="docUploadTile" style="margin-bottom:18px;">
    <i class="fa-solid fa-file-arrow-up" style="font-size:22px; display:block; margin-bottom:8px;"></i>
    Click to upload a document
    <input type="file" id="docInput" class="hidden">
  </div>
  ${docs.length ? docs.map(d=>`
    <div class="doc-row glass">
      <div class="ic"><i class="fa-solid fa-file"></i></div>
      <div class="meta">
        <div class="fn">${d.url ? `<a href="${d.url}" target="_blank" rel="noopener" style="color:inherit; text-decoration:underline;">${escapeHtml(d.name)}</a>` : escapeHtml(d.name)}</div>
        <div class="fx">${escapeHtml(d.type||'')} · ${new Date(d.uploadedAt).toLocaleDateString()} ${!d.url? '· name only, not connected to cloud storage':''}</div>
      </div>
      <button class="icon-btn" data-del-doc="${d.id}"><i class="fa-solid fa-trash" style="font-size:11px;"></i></button>
    </div>`).join('') : emptyState('fa-folder-open','No documents uploaded yet.')}
  `;
}

/* ==========================================================================
   WEEKLY REVIEW
   ========================================================================== */
function renderReview(){
  const reviews = state.weeklyReviews||[];
  return `
  <div class="module-hero theme-career">
    <div><h2><i class="fa-solid fa-wand-magic-sparkles hero-icon" style="margin-right:10px;"></i>Weekly Review</h2>
    <p>A quick AI-generated pulse check across your whole LifeOS.</p></div>
    <button class="btn btn-primary" id="genReviewBtn"><i class="fa-solid fa-sparkles"></i>Generate This Week's Review</button>
  </div>
  ${reviews.length ? reviews.map(r=>`
    <div class="glass card" style="margin-bottom:16px;">
      <div class="card-title"><i class="fa-solid fa-calendar"></i>${new Date(r.date).toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric'})}</div>
      <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px; font-size:13.5px; color:var(--text-secondary);">
        <div><i class="fa-solid fa-check" style="color:var(--emerald); width:16px;"></i>${escapeHtml(r.achievements)}</div>
        <div><i class="fa-solid fa-triangle-exclamation" style="color:var(--amber); width:16px;"></i>${escapeHtml(r.missed)}</div>
        <div><i class="fa-solid fa-wallet" style="color:var(--navy-accent); width:16px;"></i>${escapeHtml(r.spending)}</div>
        <div><i class="fa-solid fa-piggy-bank" style="color:var(--emerald); width:16px;"></i>${escapeHtml(r.savingsRate)}</div>
        <div><i class="fa-solid fa-chart-line" style="color:var(--gold); width:16px;"></i>${escapeHtml(r.investmentGrowth)}</div>
      </div>
      <div style="margin-top:14px; display:flex; flex-direction:column; gap:8px;">
        ${r.priorities.map(p=>`<div class="ai-note"><i class="fa-solid fa-star"></i><span>${escapeHtml(p)}</span></div>`).join('')}
      </div>
    </div>`).join('') : emptyState('fa-wand-magic-sparkles','No reviews yet. Generate your first one above.')}
  `;
}

/* ==========================================================================
   PAGE EVENT WIRING
   ========================================================================== */
function wirePageEvents(page){
  if(page==='profile'){
    document.getElementById('saveProfileBtn').onclick = saveProfileFromForm;
    document.getElementById('uploadPhotoBtn').onclick = ()=>document.getElementById('photoInput').click();
    document.getElementById('photoInput').onchange = e=>{
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = ()=>{ state.profile.photo = reader.result; save(); render(); toast('Photo updated.','success'); };
      reader.readAsDataURL(file);
    };
  }

  if(page==='academics'){
    document.getElementById('saveAcademicsBtn').onclick = ()=>{
      state.academics.cgpa = val('acgpa'); state.academics.semester = val('asem');
      state.academics.studyHours = num('astudy'); state.academics.streak = num('astreak');
      save(); toast('Academics saved.','success'); render();
    };
    document.getElementById('bookPlus').onclick = ()=>{ state.academics.booksRead=(state.academics.booksRead||0)+1; save(); render(); };
    document.getElementById('bookMinus').onclick = ()=>{ state.academics.booksRead=Math.max(0,(state.academics.booksRead||0)-1); save(); render(); };
  }

  if(page==='career'){
    document.getElementById('saveCareerStatsBtn').onclick = ()=>{
      const c = state.career;
      c.networkContacts = num('cNetwork'); c.cvVersion = num('cCV');
      c.linkedinCurrent = num('cLiCurrent'); c.linkedinGoal = num('cLiGoal');
      save(); toast('Career stats saved.','success'); render();
    };
    document.getElementById('roadmapSelect').onchange = e=>{ state._selectedRoadmap = e.target.value; render(); };
    document.getElementById('addAppBtn').onclick = openAddApplicationModal;
    document.getElementById('addInterviewBtn').onclick = openAddInterviewModal;
    document.querySelectorAll('[data-del-app]').forEach(b=> b.onclick = ()=> confirmDelete('Application', ()=>{ removeItem('career.applications', b.dataset.delApp); render(); }));
    document.querySelectorAll('[data-del-interview]').forEach(b=> b.onclick = ()=> confirmDelete('Interview', ()=>{ removeItem('career.interviews', b.dataset.delInterview); render(); }));
  }

  if(page==='habits'){
    document.getElementById('addHabitBtn').onclick = openAddHabitModal;
    document.querySelectorAll('[data-del-habit]').forEach(b=> b.onclick = ()=> confirmDelete('Habit', ()=>{ removeItem('habits', b.dataset.delHabit); render(); }));
  }

  if(page==='health'){
    document.getElementById('saveHealthBtn').onclick = ()=>{
      const h = state.health;
      h.exercise = num('hExercise'); h.sleepHours = num('hSleep'); h.waterIntake = num('hWater'); h.mentalHealth = num('hMental');
      save(); toast('Health saved.','success'); render();
    };
  }

  if(page==='finance'){
    document.getElementById('saveIncomeBtn').onclick = ()=>{
      const f = state.finance;
      f.monthlySalary = num('fSalary'); f.weeklyIncome = num('fWeekly'); f.sideHustle = num('fSide');
      f.passiveIncome = num('fPassive'); f.bonuses = num('fBonus');
      save(); toast('Income saved.','success'); render();
    };
    document.getElementById('saveExpensesBtn').onclick = ()=>{
      const ex = state.finance.expenses;
      Object.keys(ex).forEach(k=>{ ex[k] = num('fx_'+k); });
      save(); toast('Expenses saved.','success'); render();
    };
    document.getElementById('saveEFBtn').onclick = ()=>{
      state.emergencyFundCurrent = num('efCurrent'); state.emergencyFundTarget = num('efTarget');
      save(); toast('Emergency fund updated.','success'); render();
    };
  }

  if(page==='investments'){
    document.getElementById('addInvBtn').onclick = openAddInvestmentModal;
    document.querySelectorAll('[data-del-inv]').forEach(b=> b.onclick = ()=> confirmDelete('Investment', ()=>{ removeItem('investments', b.dataset.delInv); render(); }));
  }

  if(page==='loans'){
    document.getElementById('addLoanBtn').onclick = openAddLoanModal;
    document.querySelectorAll('[data-del-loan]').forEach(b=> b.onclick = ()=> confirmDelete('Loan', ()=>{ removeItem('loans', b.dataset.delLoan); render(); }));
  }

  if(page==='fi'){
    document.getElementById('saveFITargetBtn').onclick = ()=>{
      state.fiTargetMonthlyExpense = num('fiTarget'); save(); toast('FI target saved.','success'); render();
    };
  }

  if(page==='goals'){
    document.getElementById('addGoalBtn').onclick = openAddGoalModal;
    document.querySelectorAll('[data-del-goal]').forEach(b=> b.onclick = ()=> confirmDelete('Goal', ()=>{ removeItem('goals', b.dataset.delGoal); render(); }));
  }

  if(page==='future'){
    document.getElementById('addPlanBtn').onclick = openAddPlanModal;
    document.querySelectorAll('[data-del-plan]').forEach(b=> b.onclick = ()=> confirmDelete('Plan', ()=>{ removeItem('futurePlans', b.dataset.delPlan); render(); }));
  }

  if(page==='visionboard'){
    document.getElementById('visionUploadTile').onclick = ()=>document.getElementById('visionInput').click();
    document.getElementById('visionInput').onchange = async e=>{
      const file = e.target.files[0]; if(!file) return;
      if(typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED && window.__sbUserId){
        toast('Uploading image…','info');
        const r = await sbUploadFile(window.__sbUserId, file);
        if(!r.ok){ toast('Upload failed: '+r.msg, 'danger'); return; }
        addItem('visionBoard', { img: r.url, path: r.path, caption:'' });
        render(); toast('Added to vision board.','success');
      } else {
        const reader = new FileReader();
        reader.onload = ()=>{ addItem('visionBoard', { img: reader.result, caption:'' }); render(); toast('Added to vision board.','success'); };
        reader.readAsDataURL(file);
      }
    };
    document.querySelectorAll('[data-del-vision]').forEach(b=> b.onclick = ()=>{
      const item = (state.visionBoard||[]).find(v=>v.id===b.dataset.delVision);
      if(item && item.path && typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED) sbDeleteFile(item.path);
      removeItem('visionBoard', b.dataset.delVision); render();
    });
  }

  if(page==='documents'){
    document.getElementById('docUploadTile').onclick = ()=>document.getElementById('docInput').click();
    document.getElementById('docInput').onchange = async e=>{
      const file = e.target.files[0]; if(!file) return;
      if(typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED && window.__sbUserId){
        toast('Uploading document…','info');
        const r = await sbUploadFile(window.__sbUserId, file);
        if(!r.ok){ toast('Upload failed: '+r.msg, 'danger'); return; }
        addItem('documents', { name:file.name, type:file.type||'file', uploadedAt:new Date().toISOString(), url:r.url, path:r.path });
        render(); toast('Document uploaded.','success');
      } else {
        addItem('documents', { name:file.name, type:file.type||'file', uploadedAt:new Date().toISOString() });
        render(); toast('Document added (name only — connect Supabase to store the actual file).','info');
      }
    };
    document.querySelectorAll('[data-del-doc]').forEach(b=> b.onclick = ()=> confirmDelete('Document', ()=>{
      const item = (state.documents||[]).find(d=>d.id===b.dataset.delDoc);
      if(item && item.path && typeof SUPABASE_ENABLED !== 'undefined' && SUPABASE_ENABLED) sbDeleteFile(item.path);
      removeItem('documents', b.dataset.delDoc); render();
    }));
  }

  if(page==='review'){
    document.getElementById('genReviewBtn').onclick = ()=>{ generateWeeklyReview(); render(); toast('Weekly review generated.','success'); };
  }
}

/* ==========================================================================
   ADD-ITEM MODALS
   ========================================================================== */
function openAddApplicationModal(){
  openModal('Log Application', `
    <div class="field"><label>Company</label><input type="text" id="mCompany"></div>
    <div class="field"><label>Role</label><input type="text" id="mRole"></div>
    <div class="field"><label>Status</label><select id="mStatus"><option>Applied</option><option>Screening</option><option>Interviewing</option><option>Offer</option><option>Rejected</option></select></div>
  `, `<button class="btn btn-ghost btn-block" id="mCancel">Cancel</button><button class="btn btn-primary btn-block" id="mSave">Add</button>`);
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mSave').onclick = ()=>{
    if(!val('mCompany')) return toast('Company name required.','warn');
    addItem('career.applications', { company:val('mCompany'), role:val('mRole'), status:val('mStatus') });
    closeModal(); render(); toast('Application added.','success');
  };
}
function openAddInterviewModal(){
  openModal('Log Interview', `
    <div class="field"><label>Company</label><input type="text" id="mCompany"></div>
    <div class="field"><label>Stage</label><input type="text" id="mStage" placeholder="e.g. Round 2 - Technical"></div>
    <div class="field"><label>Date</label><input type="date" id="mDate"></div>
  `, `<button class="btn btn-ghost btn-block" id="mCancel">Cancel</button><button class="btn btn-primary btn-block" id="mSave">Add</button>`);
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mSave').onclick = ()=>{
    if(!val('mCompany')) return toast('Company name required.','warn');
    addItem('career.interviews', { company:val('mCompany'), stage:val('mStage'), date:val('mDate') });
    closeModal(); render(); toast('Interview added.','success');
  };
}
function openAddHabitModal(){
  openModal('Add Habit', `
    <div class="field"><label>Habit name</label><input type="text" id="mName" placeholder="e.g. Morning workout"></div>
    <div class="field"><label>Current consistency (%)</label><input type="number" id="mConsistency" value="0" min="0" max="100"></div>
  `, `<button class="btn btn-ghost btn-block" id="mCancel">Cancel</button><button class="btn btn-primary btn-block" id="mSave">Add</button>`);
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mSave').onclick = ()=>{
    if(!val('mName')) return toast('Habit name required.','warn');
    addItem('habits', { name:val('mName'), consistency: clamp(num('mConsistency'),0,100) });
    closeModal(); render(); toast('Habit added.','success');
  };
}
function openAddInvestmentModal(){
  openModal('Add Investment', `
    <div class="field"><label>Name</label><input type="text" id="mName" placeholder="e.g. Money Market Fund - CIC"></div>
    <div class="field"><label>Category</label><select id="mCategory">
      <option>Equities</option><option>Money Market</option><option>Real Estate</option><option>SACCO</option><option>Bonds</option><option>Crypto</option><option>Other</option>
    </select></div>
    <div class="field"><label>Current value (KES)</label><input type="number" id="mValue" value="0"></div>
  `, `<button class="btn btn-ghost btn-block" id="mCancel">Cancel</button><button class="btn btn-primary btn-block" id="mSave">Add</button>`);
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mSave').onclick = ()=>{
    if(!val('mName')) return toast('Investment name required.','warn');
    addItem('investments', { name:val('mName'), category:val('mCategory'), currentValue:num('mValue') });
    closeModal(); render(); toast('Investment added.','success');
  };
}
function openAddLoanModal(){
  openModal('Add Loan', `
    <div class="field"><label>Lender</label><input type="text" id="mLender" placeholder="e.g. KCB, M-Shwari, SACCO"></div>
    <div class="field"><label>Outstanding balance (KES)</label><input type="number" id="mBalance" value="0"></div>
    <div class="field"><label>Monthly payment (KES)</label><input type="number" id="mPayment" value="0"></div>
  `, `<button class="btn btn-ghost btn-block" id="mCancel">Cancel</button><button class="btn btn-primary btn-block" id="mSave">Add</button>`);
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mSave').onclick = ()=>{
    if(!val('mLender')) return toast('Lender name required.','warn');
    addItem('loans', { lender:val('mLender'), balance:num('mBalance'), monthlyPayment:num('mPayment') });
    closeModal(); render(); toast('Loan added.','success');
  };
}
function openAddGoalModal(){
  openModal('Add Goal', `
    <div class="field"><label>Title</label><input type="text" id="mTitle" placeholder="e.g. Pass EY assessment"></div>
    <div class="field"><label>Category</label><select id="mCategory"><option>Career</option><option>Finance</option><option>Health</option><option>Personal</option></select></div>
    <div class="field"><label>Deadline</label><input type="date" id="mDeadline"></div>
    <div class="field"><label>Completion (%)</label><input type="number" id="mCompletion" value="0" min="0" max="100"></div>
  `, `<button class="btn btn-ghost btn-block" id="mCancel">Cancel</button><button class="btn btn-primary btn-block" id="mSave">Add</button>`);
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mSave').onclick = ()=>{
    if(!val('mTitle')) return toast('Goal title required.','warn');
    addItem('goals', { title:val('mTitle'), category:val('mCategory'), deadline:val('mDeadline'), completion:clamp(num('mCompletion'),0,100) });
    closeModal(); render(); toast('Goal added.','success');
  };
}
function openAddPlanModal(){
  openModal('Add Future Plan', `
    <div class="field"><label>Title</label><input type="text" id="mTitle" placeholder="e.g. Buy first plot of land"></div>
    <div class="field"><label>Target date</label><input type="date" id="mDate"></div>
    <div class="field"><label>Notes</label><textarea id="mNotes"></textarea></div>
  `, `<button class="btn btn-ghost btn-block" id="mCancel">Cancel</button><button class="btn btn-primary btn-block" id="mSave">Add</button>`);
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('mSave').onclick = ()=>{
    if(!val('mTitle')) return toast('Plan title required.','warn');
    addItem('futurePlans', { title:val('mTitle'), targetDate:val('mDate'), notes:val('mNotes'), done:false });
    closeModal(); render(); toast('Plan added.','success');
  };
}
