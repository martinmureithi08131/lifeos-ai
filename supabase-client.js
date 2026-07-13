/* ==========================================================================
   LifeOS AI — supabase-client.js
   Optional cloud layer. If you fill in SUPABASE_URL and SUPABASE_ANON_KEY
   below, the app will use Supabase for auth + cross-device data sync.
   If you leave the placeholders as-is, the app runs in local-only mode
   exactly as before (localStorage, single browser).
   ========================================================================== */

const SUPABASE_URL = 'YOUR_SUPABASE_URL';        // e.g. https://abcxyz.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Project Settings -> API -> anon public key

const SUPABASE_ENABLED = SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('YOUR_');

let sb = null;
if (SUPABASE_ENABLED && window.supabase) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/* ---------------- Auth ---------------- */
async function sbSignUp(name, email, password) {
  if (!sb) return { ok: false, msg: 'Cloud sync not configured.' };
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return { ok: false, msg: error.message };
  return { ok: true, user: data.user, needsEmailConfirm: !data.session };
}

async function sbSignIn(email, password) {
  if (!sb) return { ok: false, msg: 'Cloud sync not configured.' };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, msg: error.message };
  return { ok: true, user: data.user };
}

async function sbSignOut() {
  if (!sb) return;
  await sb.auth.signOut();
}

async function sbGetSession() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

/* ---------------- Data sync: one JSON blob per user ---------------- */
async function sbLoadState(userId) {
  if (!sb) return null;
  const { data, error } = await sb
    .from('lifeos_state')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.error('sbLoadState error', error); return null; }
  return data ? data.data : null;
}

async function sbSaveState(userId, stateObj) {
  if (!sb) return;
  const { error } = await sb
    .from('lifeos_state')
    .upsert({ user_id: userId, data: stateObj, updated_at: new Date().toISOString() });
  if (error) console.error('sbSaveState error', error);
}

/* ---------------- Debounced cloud sync hook ----------------
   store.js's save() calls window.__afterLocalSave() if it exists.
   We debounce so we don't hit Supabase on every keystroke. */
let _cloudSyncTimer = null;
window.__afterLocalSave = function () {
  if (!sb || !window.__sbUserId) return;
  clearTimeout(_cloudSyncTimer);
  _cloudSyncTimer = setTimeout(() => {
    sbSaveState(window.__sbUserId, state);
  }, 1000);
};
