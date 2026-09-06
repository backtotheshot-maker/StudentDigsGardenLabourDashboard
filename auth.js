import { client } from './supabaseClient.js';

export async function getSession() {
  const { data } = await client.auth.getSession();
  return data.session;
}

export async function isAdmin(userId) {
  const { data, error } = await client.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error || !data) return false;
  return data.role === 'admin';
}

export async function signIn(email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  await client.auth.signOut();
}

export function renderLogin(error) {
  return `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--color-bg)">
      <form id="login-form" style="width:min(360px,90vw);border:1px solid var(--color-divider);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:28px;display:flex;flex-direction:column;gap:12px;background:var(--color-surface)">
        <img src="logo-green.png" alt="Student Digs" style="width:160px;margin:0 auto 8px">
        <h1 style="font-size:20px;margin:0 0 4px;text-align:center">Back office sign in</h1>
        <div class="field"><label>Email</label><input class="input" type="email" name="email" required autocomplete="username"></div>
        <div class="field"><label>Password</label><input class="input" type="password" name="password" required autocomplete="current-password"></div>
        ${error ? `<p style="color:var(--color-accent-2-800);font-size:13px;margin:0">${error}</p>` : ''}
        <button class="btn btn-primary btn-block" type="submit" style="justify-content:center">Sign in</button>
      </form>
    </div>`;
}
