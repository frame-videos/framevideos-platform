// Renderer — Auth pages (Login, Signup, Forgot Password, Reset Password)
// SSR pages for tenant white-label sites

import type { SiteSettings, TenantInfo } from '../types.js';
import { layout } from '../templates/layout.js';
import { esc } from '../helpers/html.js';

// ─── Shared styles for auth forms ────────────────────────────────────────────

const authFormStyles = `
<style>
  .auth-container { max-width: 420px; margin: 2rem auto; padding: 0 1rem; }
  .auth-card { background: #111118; border: 1px solid #1e1e2e; border-radius: 12px; padding: 2rem; }
  .auth-title { font-size: 1.5rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; text-align: center; }
  .auth-subtitle { font-size: 0.875rem; color: #64748b; text-align: center; margin-bottom: 1.5rem; }
  .auth-field { margin-bottom: 1rem; }
  .auth-label { display: block; font-size: 0.875rem; font-weight: 500; color: #cbd5e1; margin-bottom: 0.375rem; }
  .auth-input { width: 100%; padding: 0.625rem 0.75rem; background: #1a1a2e; border: 1px solid #2d2d44; border-radius: 8px; color: #fff; font-size: 0.875rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
  .auth-input:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.2); }
  .auth-input::placeholder { color: #475569; }
  .auth-btn { width: 100%; padding: 0.625rem; background: #8b5cf6; color: #fff; font-weight: 600; font-size: 0.875rem; border: none; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
  .auth-btn:hover { background: #7c3aed; }
  .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .auth-error { padding: 0.75rem; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; color: #f87171; font-size: 0.875rem; margin-bottom: 1rem; display: none; }
  .auth-success { padding: 0.75rem; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 8px; color: #4ade80; font-size: 0.875rem; margin-bottom: 1rem; display: none; }
  .auth-link { color: #8b5cf6; text-decoration: none; font-size: 0.875rem; }
  .auth-link:hover { text-decoration: underline; color: #a78bfa; }
  .auth-footer { text-align: center; margin-top: 1.25rem; font-size: 0.875rem; color: #64748b; }
  .auth-spinner { display: none; width: 1rem; height: 1rem; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; vertical-align: middle; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>`;

// ─── Login Page ──────────────────────────────────────────────────────────────

export function renderLoginPage(
  settings: SiteSettings,
  tenant: TenantInfo,
): string {
  const content = `${authFormStyles}
<div class="auth-container">
  <div class="auth-card">
    <h1 class="auth-title">Entrar</h1>
    <p class="auth-subtitle">Acesse sua conta</p>
    <div id="auth-error" class="auth-error"></div>
    <form id="login-form" onsubmit="return false;">
      <div class="auth-field">
        <label class="auth-label" for="email">Email</label>
        <input class="auth-input" id="email" type="email" placeholder="seu@email.com" required autofocus />
      </div>
      <div class="auth-field">
        <label class="auth-label" for="password">Senha</label>
        <input class="auth-input" id="password" type="password" placeholder="••••••••" required />
      </div>
      <button class="auth-btn" type="submit" id="submit-btn">
        <span class="auth-spinner" id="spinner"></span>
        <span id="btn-text">Entrar</span>
      </button>
    </form>
    <div class="auth-footer">
      <a href="/forgot-password" class="auth-link">Esqueceu sua senha?</a>
    </div>
    <div class="auth-footer" style="margin-top:0.5rem;">
      Não tem conta? <a href="/signup" class="auth-link">Criar conta</a>
    </div>
  </div>
</div>
<script>
(function(){
  var form = document.getElementById('login-form');
  var errEl = document.getElementById('auth-error');
  var spinner = document.getElementById('spinner');
  var btnText = document.getElementById('btn-text');
  var btn = document.getElementById('submit-btn');
  var apiBase = '${esc(tenant.planSlug === 'free' ? 'https://api.framevideos.com' : 'https://api.framevideos.com')}';

  form.addEventListener('submit', function(e){
    e.preventDefault();
    errEl.style.display = 'none';
    btn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.textContent = 'Entrando...';

    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;

    fetch(apiBase + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(res){
      if (!res.ok) {
        var msg = (res.data.error && res.data.error.message) || 'Erro ao fazer login';
        throw new Error(msg);
      }
      localStorage.setItem('admin_accessToken', res.data.tokens.accessToken);
      localStorage.setItem('admin_refreshToken', res.data.tokens.refreshToken);
      localStorage.setItem('admin_user', JSON.stringify(res.data.user));
      if (res.data.mustChangePassword) {
        window.location.href = '/admin/login?mustChangePassword=1';
      } else {
        window.location.href = '/admin';
      }
    })
    .catch(function(err){
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      spinner.style.display = 'none';
      btnText.textContent = 'Entrar';
    });
  });
})();
</script>`;

  return layout(settings, {
    title: 'Entrar',
    content,
    activePath: '/login',
    tenant,
    description: `Faça login em ${settings.siteName}`,
  });
}

// ─── Signup Page ─────────────────────────────────────────────────────────────

export function renderSignupPage(
  settings: SiteSettings,
  tenant: TenantInfo,
): string {
  const content = `${authFormStyles}
<div class="auth-container">
  <div class="auth-card">
    <h1 class="auth-title">Criar Conta</h1>
    <p class="auth-subtitle">Crie sua conta gratuita</p>
    <div id="auth-error" class="auth-error"></div>
    <form id="signup-form" onsubmit="return false;">
      <div class="auth-field">
        <label class="auth-label" for="name">Nome</label>
        <input class="auth-input" id="name" type="text" placeholder="Seu nome" required autofocus />
      </div>
      <div class="auth-field">
        <label class="auth-label" for="email">Email</label>
        <input class="auth-input" id="email" type="email" placeholder="seu@email.com" required />
      </div>
      <div class="auth-field">
        <label class="auth-label" for="password">Senha</label>
        <input class="auth-input" id="password" type="password" placeholder="Mínimo 8 caracteres" required minlength="8" />
      </div>
      <button class="auth-btn" type="submit" id="submit-btn">
        <span class="auth-spinner" id="spinner"></span>
        <span id="btn-text">Criar conta</span>
      </button>
    </form>
    <div class="auth-footer">
      Já tem conta? <a href="/login" class="auth-link">Entrar</a>
    </div>
  </div>
</div>
<script>
(function(){
  var form = document.getElementById('signup-form');
  var errEl = document.getElementById('auth-error');
  var spinner = document.getElementById('spinner');
  var btnText = document.getElementById('btn-text');
  var btn = document.getElementById('submit-btn');
  var apiBase = 'https://api.framevideos.com';
  var tenantId = '${esc(tenant.tenantId)}';

  form.addEventListener('submit', function(e){
    e.preventDefault();
    errEl.style.display = 'none';
    btn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.textContent = 'Criando conta...';

    var name = document.getElementById('name').value;
    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;

    fetch(apiBase + '/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
      body: JSON.stringify({ email: email, password: password, name: name, tenantId: tenantId })
    })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(res){
      if (!res.ok) {
        var msg = (res.data.error && res.data.error.message) || 'Erro ao criar conta';
        if (res.data.error && res.data.error.fields) {
          msg = res.data.error.fields.map(function(f){ return f.message; }).join('. ');
        }
        throw new Error(msg);
      }
      localStorage.setItem('admin_accessToken', res.data.tokens.accessToken);
      localStorage.setItem('admin_refreshToken', res.data.tokens.refreshToken);
      localStorage.setItem('admin_user', JSON.stringify(res.data.user));
      window.location.href = '/admin';
    })
    .catch(function(err){
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      spinner.style.display = 'none';
      btnText.textContent = 'Criar conta';
    });
  });
})();
</script>`;

  return layout(settings, {
    title: 'Criar Conta',
    content,
    activePath: '/signup',
    tenant,
    description: `Crie sua conta em ${settings.siteName}`,
  });
}

// ─── Forgot Password Page ────────────────────────────────────────────────────

export function renderForgotPasswordPage(
  settings: SiteSettings,
  tenant: TenantInfo,
): string {
  const content = `${authFormStyles}
<div class="auth-container">
  <div class="auth-card">
    <h1 class="auth-title">Esqueceu sua senha?</h1>
    <p class="auth-subtitle">Informe seu email para receber instruções de redefinição</p>
    <div id="auth-error" class="auth-error"></div>
    <div id="auth-success" class="auth-success"></div>
    <form id="forgot-form" onsubmit="return false;">
      <div class="auth-field">
        <label class="auth-label" for="email">Email</label>
        <input class="auth-input" id="email" type="email" placeholder="seu@email.com" required autofocus />
      </div>
      <button class="auth-btn" type="submit" id="submit-btn">
        <span class="auth-spinner" id="spinner"></span>
        <span id="btn-text">Enviar instruções</span>
      </button>
    </form>
    <div class="auth-footer">
      <a href="/login" class="auth-link">← Voltar ao login</a>
    </div>
  </div>
</div>
<script>
(function(){
  var form = document.getElementById('forgot-form');
  var errEl = document.getElementById('auth-error');
  var successEl = document.getElementById('auth-success');
  var spinner = document.getElementById('spinner');
  var btnText = document.getElementById('btn-text');
  var btn = document.getElementById('submit-btn');
  var apiBase = 'https://api.framevideos.com';

  form.addEventListener('submit', function(e){
    e.preventDefault();
    errEl.style.display = 'none';
    successEl.style.display = 'none';
    btn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.textContent = 'Enviando...';

    var email = document.getElementById('email').value;

    fetch(apiBase + '/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
      body: JSON.stringify({ email: email })
    })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(res){
      if (!res.ok) {
        var msg = (res.data.error && res.data.error.message) || 'Erro ao processar solicitação';
        throw new Error(msg);
      }
      successEl.textContent = 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.';
      successEl.style.display = 'block';
      form.style.display = 'none';
    })
    .catch(function(err){
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      spinner.style.display = 'none';
      btnText.textContent = 'Enviar instruções';
    });
  });
})();
</script>`;

  return layout(settings, {
    title: 'Esqueceu sua senha',
    content,
    activePath: '/forgot-password',
    tenant,
    description: 'Redefinir senha',
  });
}

// ─── Reset Password Page ────────────────────────────────────────────────────

export function renderResetPasswordPage(
  settings: SiteSettings,
  tenant: TenantInfo,
  token: string,
): string {
  const content = `${authFormStyles}
<div class="auth-container">
  <div class="auth-card">
    <h1 class="auth-title">Redefinir senha</h1>
    <p class="auth-subtitle">Escolha uma nova senha para sua conta</p>
    <div id="auth-error" class="auth-error"></div>
    <div id="auth-success" class="auth-success"></div>
    <form id="reset-form" onsubmit="return false;">
      <div class="auth-field">
        <label class="auth-label" for="password">Nova senha</label>
        <input class="auth-input" id="password" type="password" placeholder="Mínimo 8 caracteres" required minlength="8" autofocus />
      </div>
      <div class="auth-field">
        <label class="auth-label" for="password-confirm">Confirmar nova senha</label>
        <input class="auth-input" id="password-confirm" type="password" placeholder="Repita a nova senha" required minlength="8" />
      </div>
      <button class="auth-btn" type="submit" id="submit-btn">
        <span class="auth-spinner" id="spinner"></span>
        <span id="btn-text">Redefinir senha</span>
      </button>
    </form>
    <div class="auth-footer">
      <a href="/login" class="auth-link">← Voltar ao login</a>
    </div>
  </div>
</div>
<script>
(function(){
  var form = document.getElementById('reset-form');
  var errEl = document.getElementById('auth-error');
  var successEl = document.getElementById('auth-success');
  var spinner = document.getElementById('spinner');
  var btnText = document.getElementById('btn-text');
  var btn = document.getElementById('submit-btn');
  var apiBase = 'https://api.framevideos.com';
  var token = '${esc(token)}';

  if (!token) {
    errEl.textContent = 'Token de redefinição não encontrado. Solicite uma nova redefinição.';
    errEl.style.display = 'block';
    form.style.display = 'none';
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    errEl.style.display = 'none';
    successEl.style.display = 'none';

    var password = document.getElementById('password').value;
    var confirm = document.getElementById('password-confirm').value;

    if (password !== confirm) {
      errEl.textContent = 'As senhas não coincidem.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.textContent = 'Redefinindo...';

    fetch(apiBase + '/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, password: password })
    })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(res){
      if (!res.ok) {
        var msg = (res.data.error && res.data.error.message) || 'Erro ao redefinir senha';
        throw new Error(msg);
      }
      successEl.textContent = 'Senha redefinida com sucesso! Redirecionando para o login...';
      successEl.style.display = 'block';
      form.style.display = 'none';
      setTimeout(function(){ window.location.href = '/login'; }, 2000);
    })
    .catch(function(err){
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      spinner.style.display = 'none';
      btnText.textContent = 'Redefinir senha';
    });
  });
})();
</script>`;

  return layout(settings, {
    title: 'Redefinir senha',
    content,
    activePath: '/reset-password',
    tenant,
    description: 'Redefinir sua senha',
  });
}
