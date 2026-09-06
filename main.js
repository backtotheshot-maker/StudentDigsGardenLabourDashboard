import { client } from './supabaseClient.js';
import { getSession, isAdmin, signIn, renderLogin } from './auth.js';
import { mountApp } from './app.js';

const root = document.getElementById('app');

async function boot() {
  const session = await getSession();
  if (session && (await isAdmin(session.user.id))) {
    mountApp();
    return;
  }
  if (session && !(await isAdmin(session.user.id))) {
    root.innerHTML = renderLogin("Signed in, but this account isn't an admin on Student Digs.");
    wireLogin();
    return;
  }
  root.innerHTML = renderLogin();
  wireLogin();
}

function wireLogin() {
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await signIn(fd.get('email'), fd.get('password'));
      boot();
    } catch (err) {
      root.innerHTML = renderLogin(err.message || 'Could not sign in.');
      wireLogin();
    }
  });
}

client.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') boot();
});

boot();
