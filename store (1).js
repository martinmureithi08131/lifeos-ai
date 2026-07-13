/* ==========================================================================
   LifeOS AI — store.js
   Central state, localStorage persistence, and all calculation logic.
   Everything here is framework-free vanilla JS.
   ========================================================================== */

const LS_KEY = 'lifeos_ai_v1';

const QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "Compound interest is the eighth wonder of the world — he who understands it, earns it.",
  "A goal without a deadline is just a wish.",
  "Your net worth grows one disciplined decision at a time.",
  "The best time to invest was ten years ago. The second best time is today.",
  "Small daily habits build unshakeable decades.",
  "Every expert was once a beginner who refused to quit.",
  "Financial freedom is bought with patience, not luck.",
  "Track it to change it — what gets measured gets managed.",
  "Build the life you want on paper first, then go build it for real."
];

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtMoney(n, currency){
  currency = currency || (state.profile.country === 'Kenya' ? 'KES' : 'USD');
  const sym = currency === 'KES' ? 'KSh ' : '$';
  n = Number(n)||0;
  return sym + n.toLocaleString(undefined,{maximumFractionDigits:0});
}
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

function defaultState(){
  return {
    auth: { loggedIn:false, currentUserEmail:null },
    users: {}, // email -> {password, createdAt}
    theme: 'dark',
    profile: {
      fullName:'', age:23, gender:'', country:'Kenya', city:'Nakuru',
      university:'', highestEducation:'', occupation:'', industry:'',
      currentSalary:0, expectedSalary:0, yearsExperience:0,
      careerGoals:'', financialGoals:'', relationshipStatus:'', children:0,
      dreamHouse:'', dreamCar:'', targetRetirementAge:55, riskAppetite:'Moderate',
      preferredInvestment:'', preferredLearningStyle:'', skills:'', certificates:'',
      languages:'', interests:'', healthGoals:'', photo:'', level:'Intern', xp:0
    },
    goals: [],
    academics: { cgpa:'', semester:'', studyHours:0, coursesTracked:[], booksRead:0, streak:0 },
    career: { applications:[], interviews:[], cvVersion:1, networkContacts:0, linkedinGoal:0, linkedinCurrent:0 },
    finance: {
      monthlySalary:0, weeklyIncome:0, sideHustle:0, passiveIncome:0, bonuses:0,
      expenses:{ rent:0, food:0, transport:0, electricity:0, water:0, internet:0, entertainment:0, insurance:0, healthcare:0, shopping:0, family:0, subscriptions:0, loans:0, others:0 },
      history:[]
    },
    investments: [],
    loans: [],
    futurePlans: [],
    habits: [],
    health: { weight:[], exercise:0, waterIntake:0, sleepHours:0, mentalHealth:7, calories:0, checkups:[] },
    visionBoard: [],
    documents: [],
    notifications: [],
    emergencyFundTarget: 6,
    emergencyFundCurrent: 0,
    fiTargetMonthlyExpense: 0,
    weeklyReviews: []
  };
}

let state = load();

function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw) return Object.assign(defaultState(), JSON.parse(raw));
  }catch(e){ console.error('load error', e); }
  return defaultState();
}
function save(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){ console.error('save error', e); }
  if(typeof window!=='undefined' && typeof window.__afterLocalSave === 'function') window.__afterLocalSave();
}

/* ---------------- Scoring engine ---------------- */
function scoreAcademic(){
  const a = state.academics;
  let s = 0;
  if(a.cgpa) s += clamp((parseFloat(a.cgpa)/4)*40,0,40);
  s += clamp((a.studyHours||0)/20*20,0,20);
  s += clamp((a.streak||0)/30*20,0,20);
  s += clamp((a.booksRead||0)/12*20,0,20);
  return Math.round(clamp(s,0,100));
}
function scoreCareer(){
  const c = state.career;
  let s = 0;
  s += clamp((c.applications||[]).length*4,0,25);
  s += clamp((c.interviews||[]).length*8,0,25);
  s += clamp((c.networkContacts||0)/50*25,0,25);
  s += clamp(((c.linkedinCurrent||0)/(c.linkedinGoal||1))*25,0,25);
  return Math.round(clamp(s,0,100));
}
function financeSummary(){
  const f = state.finance;
  const income = (Number(f.monthlySalary)||0) + (Number(f.weeklyIncome)||0)*4.33 + (Number(f.sideHustle)||0) + (Number(f.passiveIncome)||0) + (Number(f.bonuses)||0)/12;
  const expenses = Object.values(f.expenses).reduce((a,b)=>a+(Number(b)||0),0);
  const net = income - expenses;
  const savings = Math.max(net*0.6,0);
  const investBudget = Math.max(net*0.4,0);
  const savingsRatio = income>0 ? (savings/income)*100 : 0;
  const investRatio = income>0 ? (investBudget/income)*100 : 0;
  const totalLoanPay = (state.loans||[]).reduce((a,l)=>a+(Number(l.monthlyPayment)||0),0);
  const debtRatio = income>0 ? (totalLoanPay/income)*100 : 0;
  return { income, expenses, net, savings, investBudget, savingsRatio, investRatio, debtRatio, totalLoanPay };
}
function scoreFinance(){
  const fs = financeSummary();
  let s = 0;
  s += clamp(fs.savingsRatio/20*40,0,40);
  s += clamp((fs.net>0?30:0),0,30);
  s += clamp((100-fs.debtRatio)/100*30,0,30);
  return Math.round(clamp(s,0,100));
}
function scoreInvestment(){
  const invs = state.investments||[];
  if(!invs.length) return 0;
  const totalVal = invs.reduce((a,i)=>a+(Number(i.currentValue)||0),0);
  let s = clamp((invs.length/6)*40,0,40);
  const uniqueCats = new Set(invs.map(i=>i.category)).size;
  s += clamp((uniqueCats/5)*30,0,30);
  s += clamp((totalVal/500000)*30,0,30);
  return Math.round(clamp(s,0,100));
}
function scoreSavings(){
  const fs = financeSummary();
  return Math.round(clamp(fs.savingsRatio*2,0,100));
}
function scoreHabits(){
  const h = state.habits||[];
  if(!h.length) return 0;
  const avg = h.reduce((a,x)=>a+(x.consistency||0),0)/h.length;
  return Math.round(clamp(avg,0,100));
}
function scoreHealth(){
  const h = state.health;
  let s = 0;
  s += clamp((h.exercise||0)/5*25,0,25);
  s += clamp((h.sleepHours||0)/8*25,0,25);
  s += clamp((h.mentalHealth||0)/10*25,0,25);
  s += clamp((h.waterIntake||0)/8*25,0,25);
  return Math.round(clamp(s,0,100));
}
function overallLifeScore(){
  const parts = [scoreAcademic(),scoreCareer(),scoreFinance(),scoreInvestment(),scoreSavings(),scoreHabits(),scoreHealth()];
  return Math.round(parts.reduce((a,b)=>a+b,0)/parts.length);
}
function goalCompletionPct(){
  const g = state.goals||[];
  if(!g.length) return 0;
  return Math.round(g.reduce((a,x)=>a+(Number(x.completion)||0),0)/g.length);
}

/* ---------------- Corporate Readiness Score ---------------- */
function corporateReadinessScore(){
  const c = state.career;
  const certs = (state.profile.certificates||'').split(',').filter(Boolean).length;
  let s = 0;
  s += clamp(certs*8,0,20);
  s += clamp((c.interviews||[]).length*10,0,20);
  s += clamp((c.networkContacts||0)/60*20,0,20);
  s += clamp(((c.linkedinCurrent||0)/(c.linkedinGoal||1))*20,0,20);
  s += clamp((c.cvVersion||1)*4,0,10);
  const leadershipSkills = (state.profile.skills||'').toLowerCase().includes('leader') ? 10 : 4;
  s += leadershipSkills;
  return Math.round(clamp(s,0,100));
}

/* ---------------- Financial Independence (FI) Tracker ---------------- */
function fiTracker(){
  const fs = financeSummary();
  const monthlyExpenseTarget = state.fiTargetMonthlyExpense || fs.expenses || 1;
  const fiNumber = monthlyExpenseTarget * 12 * 25; // 4% rule
  const currentPortfolio = (state.investments||[]).reduce((a,i)=>a+(Number(i.currentValue)||0),0);
  const pct = fiNumber>0 ? clamp((currentPortfolio/fiNumber)*100,0,100) : 0;
  const monthlyContribution = fs.investBudget;
  const annualReturn = 0.10;
  let years = 0, projected = currentPortfolio;
  if(monthlyContribution>0){
    while(projected < fiNumber && years < 60){
      projected = projected*(1+annualReturn) + monthlyContribution*12;
      years++;
    }
  } else { years = null; }
  return { fiNumber, currentPortfolio, pct, monthlyContribution, yearsToFI: years };
}

/* ---------------- Emergency Fund ---------------- */
function emergencyFundStatus(){
  const fs = financeSummary();
  const target = fs.expenses * (state.emergencyFundTarget||6);
  const pct = target>0 ? clamp((state.emergencyFundCurrent/target)*100,0,100) : 0;
  return { target, current: state.emergencyFundCurrent, pct };
}

/* ---------------- Life Wheel (radar) ---------------- */
function lifeWheelData(){
  return {
    labels:['Career','Education','Finance','Health','Relationships','Personal Growth','Lifestyle'],
    values:[
      scoreCareer(),
      scoreAcademic(),
      scoreFinance(),
      scoreHealth(),
      state.profile.relationshipStatus ? 70 : 40,
      scoreHabits(),
      clamp(scoreInvestment()*0.6+scoreFinance()*0.4,0,100)
    ]
  };
}

/* ---------------- Investment AI suggestion ---------------- */
function suggestInvestmentAllocation(){
  const p = state.profile;
  const age = Number(p.age)||25;
  const risk = p.riskAppetite || 'Moderate';
  let equity = clamp(110-age,20,90);
  if(risk==='Conservative') equity -= 20;
  if(risk==='Aggressive') equity += 15;
  equity = clamp(equity,10,90);
  const fixed = clamp(100-equity-10,5,80);
  const alt = clamp(100-equity-fixed,0,30);
  return [
    { name:'Equities / Stocks & ETFs', pct: Math.round(equity*0.55) },
    { name:'Money Market / T-Bills', pct: Math.round(fixed*0.6) },
    { name:'REITs / Real Estate', pct: Math.round(alt+equity*0.15) },
    { name:'SACCOs / Fixed Deposits', pct: Math.round(fixed*0.4) },
    { name:'Cryptocurrency (high risk)', pct: risk==='Aggressive'?5:1 }
  ].map(x=>({...x, pct: clamp(x.pct,0,100)}));
}

/* ---------------- Career roadmaps (static curated data) ---------------- */
const CAREER_ROADMAPS = {
  'Actuary': {
    icon:'fa-calculator', color:'blue',
    steps:['Pass Actuarial Society exams (CT/CS/CM series or SOA/IFoA)','Secure actuarial analyst role at insurer or consultancy','Build Excel/R/Python modeling skills','Progress to Associate then Fellowship','Specialize in Life, GI or Pensions'],
    certs:['IFoA / SOA exams','ASSK Student Membership','FRM (complementary)'],
    salaryPath:'Analyst → Associate Actuary → Actuary → Chief Actuary'
  },
  'Data Scientist': {
    icon:'fa-chart-line', color:'navy',
    steps:['Master Python/R, SQL and statistics','Build a portfolio of ML projects','Learn cloud (AWS/GCP/Azure) & MLOps','Land junior data scientist role','Specialize in NLP, computer vision or MLE'],
    certs:['Google/AWS ML certs','TensorFlow Developer','MSc in Data Science (optional)'],
    salaryPath:'Junior DS → Data Scientist → Senior DS → Head of Data'
  },
  'Financial Analyst': {
    icon:'fa-file-invoice-dollar', color:'emerald',
    steps:['Build strong Excel & financial modeling skills','Pass CFA Level 1','Join a bank, PE fund or corporate FP&A team','Progress to senior analyst','Move into portfolio management or corp finance leadership'],
    certs:['CFA','CIFA','FMVA'],
    salaryPath:'Analyst → Senior Analyst → Associate → VP → Director'
  },
  'Risk Manager': {
    icon:'fa-shield-halved', color:'rose',
    steps:['Learn risk frameworks (Basel, COSO, ERM)','Gain experience in insurance/banking risk teams','Pass FRM Part 1 & 2','Move into enterprise risk or credit risk roles','Progress to Chief Risk Officer track'],
    certs:['FRM','PRM','ISO 31000'],
    salaryPath:'Risk Analyst → Risk Manager → Senior Risk Manager → CRO'
  },
  'Investment Analyst': {
    icon:'fa-coins', color:'gold',
    steps:['Master valuation, DCF and portfolio theory','Pass CFA levels','Join asset manager, bank or fund','Build sector expertise','Progress to Portfolio Manager'],
    certs:['CFA','CIFA','CAIA'],
    salaryPath:'Analyst → Senior Analyst → Portfolio Manager → CIO'
  },
  'CFO': {
    icon:'fa-building-columns', color:'amber',
    steps:['Build deep accounting & finance foundation (CPA/ACCA)','Progress through FP&A and controller roles','Gain strategic finance and fundraising exposure','Lead as Finance Director','Step into CFO seat'],
    certs:['CPA','ACCA','MBA'],
    salaryPath:'Accountant → FP&A Manager → Finance Director → CFO'
  }
};

/* ---------------- Notifications ---------------- */
function pushNotification(text, icon, kind){
  state.notifications.unshift({ id:uid(), text, icon: icon||'fa-bell', kind: kind||'info', time: new Date().toISOString(), read:false });
  state.notifications = state.notifications.slice(0,40);
  save();
}

/* ---------------- Weekly AI Review generator ---------------- */
function generateWeeklyReview(){
  const fs = financeSummary();
  const completed = (state.goals||[]).filter(g=>Number(g.completion)>=100).length;
  const missed = (state.goals||[]).filter(g=> g.deadline && new Date(g.deadline) < new Date() && Number(g.completion)<100).length;
  const review = {
    id: uid(), date: new Date().toISOString(),
    achievements: `${completed} goal(s) completed this week.`,
    missed: `${missed} goal(s) past deadline and incomplete.`,
    spending: `Total tracked expenses: ${fmtMoney(fs.expenses)}.`,
    savingsRate: `Savings rate: ${fs.savingsRatio.toFixed(1)}% of income.`,
    investmentGrowth: `Portfolio value: ${fmtMoney((state.investments||[]).reduce((a,i)=>a+(Number(i.currentValue)||0),0))}.`,
    priorities: buildAIPriorities()
  };
  state.weeklyReviews.unshift(review);
  save();
  return review;
}
/* ---------------- Auth ---------------- */
function signup(name, email, password){
  email = (email||'').trim().toLowerCase();
  if(!name || !email || !password) return { ok:false, msg:'All fields are required.' };
  if(state.users[email]) return { ok:false, msg:'An account with that email already exists.' };
  state.users[email] = { password, createdAt: new Date().toISOString() };
  state.profile.fullName = name;
  state.auth = { loggedIn:true, currentUserEmail: email };
  pushNotification(`Welcome to LifeOS AI, ${name.split(' ')[0]}.`, 'fa-sparkles', 'success');
  save();
  return { ok:true };
}
function login(email, password){
  email = (email||'').trim().toLowerCase();
  const u = state.users[email];
  if(!u || u.password !== password) return { ok:false, msg:'Incorrect email or password.' };
  state.auth = { loggedIn:true, currentUserEmail: email };
  save();
  return { ok:true };
}
function logout(){
  state.auth = { loggedIn:false, currentUserEmail:null };
  save();
}

/* ---------------- Generic collection CRUD helpers ---------------- */
function addItem(path, item){
  const arr = getPath(path);
  item.id = item.id || uid();
  arr.push(item);
  save();
  return item;
}
function updateItem(path, id, patch){
  const arr = getPath(path);
  const idx = arr.findIndex(x=>x.id===id);
  if(idx>-1){ arr[idx] = Object.assign({}, arr[idx], patch); save(); }
}
function removeItem(path, id){
  const arr = getPath(path);
  const idx = arr.findIndex(x=>x.id===id);
  if(idx>-1){ arr.splice(idx,1); save(); }
}
function getPath(path){
  return path.split('.').reduce((o,k)=>o[k], state);
}

function buildAIPriorities(){
  const list = [];
  const fs = financeSummary();
  if(fs.savingsRatio < 20) list.push('Increase your savings rate toward at least 20% of income.');
  const ef = emergencyFundStatus();
  if(ef.pct < 100) list.push('Keep building your emergency fund before increasing investment risk.');
  if((state.investments||[]).length < 3) list.push('Diversify into at least 3 asset classes for resilience.');
  if(scoreAcademic()<60 && state.academics.cgpa) list.push('Dedicate more structured study hours this week.');
  if(corporateReadinessScore()<60) list.push('Invest time in networking and certifications for corporate readiness.');
  if(!list.length) list.push('Maintain current discipline — you are on track across all fronts.');
  return list;
}
