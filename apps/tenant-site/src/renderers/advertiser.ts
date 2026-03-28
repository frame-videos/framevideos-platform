// Renderer — Advertiser Portal (white-label)
// SSR pages for advertiser login, dashboard, campaigns, and reports

import type { SiteSettings, TenantInfo } from '../types.js';
import { esc } from '../helpers/html.js';

function advertiserLayout(settings: SiteSettings, tenant: TenantInfo, title: string, content: string): string {
  const pageTitle = `${title} — ${settings.siteName}`;

  return `<!DOCTYPE html>
<html lang="pt" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(pageTitle)}</title>
  <meta name="robots" content="noindex, nofollow">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: { colors: { primary: '${esc(settings.colorPrimary)}', secondary: '${esc(settings.colorSecondary)}' } } }
    }
  </script>
  <style>body { background: #0a0a0f; }</style>
</head>
<body class="bg-[#0a0a0f] text-gray-100 min-h-screen">
  <header class="bg-[#0d0d14]/95 border-b border-gray-800/50">
    <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-4">
        ${settings.siteLogoUrl
          ? `<img src="${esc(settings.siteLogoUrl)}" alt="${esc(settings.siteName)}" class="h-8 w-auto" />`
          : `<span class="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">${esc(settings.siteName)}</span>`
        }
        <span class="text-sm text-gray-500">Portal do Anunciante</span>
      </div>
      <nav class="flex items-center gap-4 text-sm" id="adv-nav">
        <a href="/advertiser/dashboard" class="text-gray-400 hover:text-white transition-colors">Dashboard</a>
        <a href="/advertiser/campaigns" class="text-gray-400 hover:text-white transition-colors">Campanhas</a>
        <a href="/advertiser/reports" class="text-gray-400 hover:text-white transition-colors">Relatórios</a>
        <button onclick="localStorage.removeItem('adv_token');window.location='/advertiser/login'" class="text-gray-500 hover:text-red-400 transition-colors">Sair</button>
      </nav>
    </div>
  </header>
  <main class="max-w-6xl mx-auto px-4 py-8">
    ${content}
  </main>
  <script>
    // Auth guard — check token
    const advToken = localStorage.getItem('adv_token');
    const isLoginPage = window.location.pathname === '/advertiser/login';
    if (!advToken && !isLoginPage) { window.location = '/advertiser/login'; }
    if (advToken && isLoginPage) { window.location = '/advertiser/dashboard'; }
    if (!isLoginPage) { document.getElementById('adv-nav').style.display = 'flex'; }
  </script>
</body>
</html>`;
}

// ─── Login Page ──────────────────────────────────────────────────────────────

export function renderAdvertiserLogin(settings: SiteSettings, tenant: TenantInfo): string {
  const apiUrl = `https://api.framevideos.com`;

  const content = `
  <div class="max-w-md mx-auto mt-16">
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-8">
      <h1 class="text-2xl font-bold text-center mb-6">🔐 Login do Anunciante</h1>
      <div id="login-error" class="hidden p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"></div>
      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Email</label>
          <input type="email" id="login-email" required
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Senha</label>
          <input type="password" id="login-password" required
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
        </div>
        <button type="submit" id="login-btn"
          class="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
          Entrar
        </button>
      </form>
    </div>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('login-btn');
      var errEl = document.getElementById('login-error');
      btn.disabled = true; btn.textContent = 'Entrando...';
      errEl.classList.add('hidden');
      try {
        var res = await fetch('${esc(apiUrl)}/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value
          })
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Erro no login');
        if (data.user && data.user.role !== 'advertiser' && data.user.role !== 'super_admin') {
          throw new Error('Esta conta não tem permissão de anunciante');
        }
        localStorage.setItem('adv_token', data.tokens.accessToken);
        localStorage.setItem('adv_user', JSON.stringify(data.user));
        window.location = '/advertiser/dashboard';
      } catch(err) {
        errEl.textContent = err.message; errEl.classList.remove('hidden');
      } finally {
        btn.disabled = false; btn.textContent = 'Entrar';
      }
    });
  </script>`;

  return advertiserLayout(settings, tenant, 'Login', content);
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export function renderAdvertiserDashboard(settings: SiteSettings, tenant: TenantInfo): string {
  const apiUrl = `https://api.framevideos.com`;

  const content = `
  <h1 class="text-2xl font-bold mb-6">📊 Dashboard</h1>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" id="stats-cards">
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p class="text-xs text-gray-500 uppercase">Campanhas Ativas</p>
      <p class="text-2xl font-bold mt-1" id="stat-campaigns">—</p>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p class="text-xs text-gray-500 uppercase">Total Gasto</p>
      <p class="text-2xl font-bold mt-1 text-green-400" id="stat-spent">—</p>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p class="text-xs text-gray-500 uppercase">Impressões</p>
      <p class="text-2xl font-bold mt-1" id="stat-impressions">—</p>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p class="text-xs text-gray-500 uppercase">Cliques</p>
      <p class="text-2xl font-bold mt-1" id="stat-clicks">—</p>
    </div>
  </div>

  <div class="bg-gray-900 border border-gray-800 rounded-xl p-6">
    <h2 class="text-lg font-semibold mb-4">Suas Campanhas</h2>
    <div id="campaigns-list" class="text-gray-400">Carregando...</div>
  </div>

  <script>
    (async function() {
      var token = localStorage.getItem('adv_token');
      if (!token) return;
      var headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

      try {
        var [summaryRes, campaignsRes] = await Promise.all([
          fetch('${esc(apiUrl)}/api/v1/ads/reports/summary', { headers }),
          fetch('${esc(apiUrl)}/api/v1/ads/campaigns?limit=10', { headers })
        ]);
        var summary = await summaryRes.json();
        var campaigns = await campaignsRes.json();

        document.getElementById('stat-campaigns').textContent = summary.activeCampaigns || 0;
        document.getElementById('stat-spent').textContent = 'R$ ' + ((summary.totalSpentCents || 0) / 100).toFixed(2);
        document.getElementById('stat-impressions').textContent = (summary.totalImpressions || 0).toLocaleString('pt-BR');
        document.getElementById('stat-clicks').textContent = (summary.totalClicks || 0).toLocaleString('pt-BR');

        var list = campaigns.data || [];
        if (list.length === 0) {
          document.getElementById('campaigns-list').innerHTML = '<p class="text-gray-500">Nenhuma campanha encontrada</p>';
        } else {
          var html = '<div class="space-y-3">';
          list.forEach(function(c) {
            var badges = { draft: 'bg-gray-500/20 text-gray-400', active: 'bg-green-500/20 text-green-400', paused: 'bg-yellow-500/20 text-yellow-400' };
            var badgeClass = badges[c.status] || 'bg-gray-500/20 text-gray-400';
            html += '<div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">';
            html += '<div><p class="font-medium">' + c.name + '</p>';
            html += '<span class="px-2 py-0.5 rounded-full text-xs ' + badgeClass + '">' + c.status + '</span></div>';
            html += '<div class="text-right text-sm text-gray-400">';
            html += '<p>R$ ' + (c.spentCents / 100).toFixed(2) + ' / R$ ' + (c.budgetCents / 100).toFixed(2) + '</p></div>';
            html += '</div>';
          });
          html += '</div>';
          document.getElementById('campaigns-list').innerHTML = html;
        }
      } catch(err) {
        document.getElementById('campaigns-list').innerHTML = '<p class="text-red-400">Erro ao carregar dados</p>';
      }
    })();
  </script>`;

  return advertiserLayout(settings, tenant, 'Dashboard', content);
}

// ─── Campaigns Page ──────────────────────────────────────────────────────────

export function renderAdvertiserCampaigns(settings: SiteSettings, tenant: TenantInfo): string {
  const apiUrl = `https://api.framevideos.com`;

  const content = `
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">📢 Minhas Campanhas</h1>
    <button id="btn-new" onclick="document.getElementById('new-form').classList.toggle('hidden')"
      class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">
      + Nova Campanha
    </button>
  </div>

  <div id="new-form" class="hidden bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
    <h3 class="text-lg font-semibold mb-4">Nova Campanha</h3>
    <form id="campaign-form" class="space-y-4">
      <div>
        <label class="block text-sm text-gray-300 mb-1">Nome *</label>
        <input type="text" id="cf-name" required class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="block text-sm text-gray-300 mb-1">Orçamento (R$) *</label>
          <input type="number" id="cf-budget" required min="1" step="0.01" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Início *</label>
          <input type="date" id="cf-start" required class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Término</label>
          <input type="date" id="cf-end" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
        </div>
      </div>
      <div id="cf-error" class="hidden p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"></div>
      <button type="submit" class="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium">Criar</button>
    </form>
  </div>

  <div id="campaigns-container" class="text-gray-400">Carregando...</div>

  <script>
    var apiUrl = '${esc(apiUrl)}';
    var token = localStorage.getItem('adv_token');
    var headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

    async function loadCampaigns() {
      try {
        var res = await fetch(apiUrl + '/api/v1/ads/campaigns?limit=50', { headers });
        var data = await res.json();
        var list = data.data || [];
        if (list.length === 0) {
          document.getElementById('campaigns-container').innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma campanha. Crie a primeira!</p>';
          return;
        }
        var html = '<div class="space-y-3">';
        list.forEach(function(c) {
          var progress = c.budgetCents > 0 ? Math.min(100, (c.spentCents / c.budgetCents) * 100) : 0;
          html += '<div class="bg-gray-900 border border-gray-800 rounded-xl p-4">';
          html += '<div class="flex items-center justify-between mb-2">';
          html += '<h3 class="font-medium">' + c.name + '</h3>';
          html += '<span class="text-xs px-2 py-0.5 rounded-full bg-gray-700">' + c.status + '</span>';
          html += '</div>';
          html += '<div class="flex items-center gap-4 text-sm text-gray-400">';
          html += '<span>R$ ' + (c.spentCents/100).toFixed(2) + ' / R$ ' + (c.budgetCents/100).toFixed(2) + '</span>';
          html += '<span>' + c.startDate + '</span>';
          html += '</div>';
          html += '<div class="w-full bg-gray-700 rounded-full h-1.5 mt-2"><div class="bg-purple-500 h-1.5 rounded-full" style="width:' + progress + '%"></div></div>';
          html += '</div>';
        });
        html += '</div>';
        document.getElementById('campaigns-container').innerHTML = html;
      } catch(err) {
        document.getElementById('campaigns-container').innerHTML = '<p class="text-red-400">Erro ao carregar campanhas</p>';
      }
    }

    document.getElementById('campaign-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var errEl = document.getElementById('cf-error');
      errEl.classList.add('hidden');
      try {
        var res = await fetch(apiUrl + '/api/v1/ads/campaigns', {
          method: 'POST', headers,
          body: JSON.stringify({
            name: document.getElementById('cf-name').value,
            budgetCents: Math.round(parseFloat(document.getElementById('cf-budget').value) * 100),
            startDate: document.getElementById('cf-start').value,
            endDate: document.getElementById('cf-end').value || undefined
          })
        });
        if (!res.ok) { var d = await res.json(); throw new Error(d.error?.message || 'Erro'); }
        document.getElementById('new-form').classList.add('hidden');
        document.getElementById('campaign-form').reset();
        loadCampaigns();
      } catch(err) {
        errEl.textContent = err.message; errEl.classList.remove('hidden');
      }
    });

    loadCampaigns();
  </script>`;

  return advertiserLayout(settings, tenant, 'Campanhas', content);
}

// ─── Reports Page ────────────────────────────────────────────────────────────

export function renderAdvertiserReports(settings: SiteSettings, tenant: TenantInfo): string {
  const apiUrl = `https://api.framevideos.com`;

  const content = `
  <h1 class="text-2xl font-bold mb-6">📊 Relatórios</h1>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" id="report-stats">
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p class="text-xs text-gray-500 uppercase">Impressões (30d)</p>
      <p class="text-2xl font-bold mt-1" id="rpt-impressions">—</p>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p class="text-xs text-gray-500 uppercase">Cliques (30d)</p>
      <p class="text-2xl font-bold mt-1" id="rpt-clicks">—</p>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p class="text-xs text-gray-500 uppercase">CTR</p>
      <p class="text-2xl font-bold mt-1" id="rpt-ctr">—</p>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p class="text-xs text-gray-500 uppercase">Gasto Total</p>
      <p class="text-2xl font-bold mt-1 text-green-400" id="rpt-spent">—</p>
    </div>
  </div>

  <div class="bg-gray-900 border border-gray-800 rounded-xl p-6">
    <h2 class="text-lg font-semibold mb-4">Desempenho Diário (últimos 30 dias)</h2>
    <div id="daily-table" class="text-gray-400">Carregando...</div>
  </div>

  <script>
    (async function() {
      var token = localStorage.getItem('adv_token');
      if (!token) return;
      var headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
      var apiUrl = '${esc(apiUrl)}';

      try {
        var summaryRes = await fetch(apiUrl + '/api/v1/ads/reports/summary', { headers });
        var summary = await summaryRes.json();

        document.getElementById('rpt-impressions').textContent = (summary.totalImpressions || 0).toLocaleString('pt-BR');
        document.getElementById('rpt-clicks').textContent = (summary.totalClicks || 0).toLocaleString('pt-BR');
        document.getElementById('rpt-ctr').textContent = (summary.ctr || '0.00') + '%';
        document.getElementById('rpt-spent').textContent = 'R$ ' + ((summary.totalSpentCents || 0) / 100).toFixed(2);

        // Load daily stats for first campaign
        var campRes = await fetch(apiUrl + '/api/v1/ads/campaigns?limit=1', { headers });
        var campData = await campRes.json();
        if (campData.data && campData.data.length > 0) {
          var statsRes = await fetch(apiUrl + '/api/v1/ads/reports/campaign/' + campData.data[0].id + '?days=30', { headers });
          var stats = await statsRes.json();
          var rows = (stats.data || []).reverse();
          if (rows.length === 0) {
            document.getElementById('daily-table').innerHTML = '<p class="text-gray-500">Sem dados ainda</p>';
          } else {
            var html = '<table class="w-full text-sm"><thead><tr class="border-b border-gray-700 text-gray-400">';
            html += '<th class="text-left py-2">Data</th><th class="text-right py-2">Impressões</th>';
            html += '<th class="text-right py-2">Cliques</th><th class="text-right py-2">CTR</th>';
            html += '<th class="text-right py-2">Gasto</th></tr></thead><tbody>';
            rows.forEach(function(r) {
              html += '<tr class="border-b border-gray-800/50">';
              html += '<td class="py-2">' + r.date + '</td>';
              html += '<td class="py-2 text-right">' + r.impressions.toLocaleString('pt-BR') + '</td>';
              html += '<td class="py-2 text-right">' + r.clicks.toLocaleString('pt-BR') + '</td>';
              html += '<td class="py-2 text-right">' + r.ctr + '%</td>';
              html += '<td class="py-2 text-right text-green-400">R$ ' + (r.spentCents / 100).toFixed(2) + '</td>';
              html += '</tr>';
            });
            html += '</tbody></table>';
            document.getElementById('daily-table').innerHTML = html;
          }
        } else {
          document.getElementById('daily-table').innerHTML = '<p class="text-gray-500">Crie uma campanha para ver relatórios</p>';
        }
      } catch(err) {
        document.getElementById('daily-table').innerHTML = '<p class="text-red-400">Erro ao carregar relatórios</p>';
      }
    })();
  </script>`;

  return advertiserLayout(settings, tenant, 'Relatórios', content);
}
