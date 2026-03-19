const HOME_ADDRESS = '30 Rue Puel-Éloir, Saint-Étienne-du-Rouvray 76800';

let DATA = { sessions: [] };
let currentView = 'dashboard';
let currentSession = null;
let currentProspect = null;

// --- LocalStorage helpers ---
function getDoneMap() {
  try { return JSON.parse(localStorage.getItem('prospectr_done') || '{}'); }
  catch { return {}; }
}
function setDone(key, val) {
  const m = getDoneMap(); m[key] = val;
  localStorage.setItem('prospectr_done', JSON.stringify(m));
}
function isDone(key) { return !!getDoneMap()[key]; }

function getNotesMap() {
  try { return JSON.parse(localStorage.getItem('prospectr_notes') || '{}'); }
  catch { return {}; }
}
function setNote(key, val) {
  const m = getNotesMap(); m[key] = val;
  localStorage.setItem('prospectr_notes', JSON.stringify(m));
}

function countDone() {
  return Object.values(getDoneMap()).filter(Boolean).length;
}

function countSessionDone(sess) {
  return sess.prospects.filter(p => isDone(p.nom)).length;
}

// --- Google Maps URL builders ---
function buildMapsUrl(prospects) {
  const stops = [HOME_ADDRESS, ...prospects.map(p => {
    if (p.address) return p.address;
    return p.nom + ', ' + p.ville + ', France';
  })];
  return 'https://www.google.com/maps/dir/' + stops.map(s => encodeURIComponent(s)).join('/');
}

function buildSingleMapUrl(prospect) {
  const addr = prospect.address || (prospect.nom + ', ' + prospect.ville + ', France');
  return 'https://www.google.com/maps/dir/' + encodeURIComponent(HOME_ADDRESS) + '/' + encodeURIComponent(addr);
}

function buildSearchMapUrl(prospect) {
  const q = prospect.address || (prospect.nom + ', ' + prospect.ville);
  return 'https://www.google.com/maps/search/' + encodeURIComponent(q);
}

// --- Haptic feedback ---
function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms || 15);
}

// --- Scroll to top on view change ---
function scrollTop() { window.scrollTo({ top: 0, behavior: 'instant' }); }

// --- DASHBOARD ---
function renderDashboard() {
  const allP = DATA.sessions.flatMap(s => s.prospects);
  const totalP = allP.length;
  const garderCount = allP.filter(p => p.audit_verdict === 'GARDER').length;
  document.getElementById('total-prospects').textContent = garderCount + '/' + totalP;
  document.getElementById('total-sessions').textContent = DATA.sessions.length;
  document.getElementById('total-done').textContent = countDone();

  const pctGlobal = totalP ? Math.round(countDone() / totalP * 100) : 0;
  document.getElementById('header-stats').textContent = pctGlobal + '% complété';

  const list = document.getElementById('sessions-list');
  list.innerHTML = '';

  DATA.sessions.forEach((sess, i) => {
    const done = countSessionDone(sess);
    const total = sess.prospects.length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const niches = [...new Set(sess.prospects.map(p => p.niche))];
    const allDone = done === total && total > 0;

    const card = document.createElement('div');
    card.className = 'session-card animate-in';
    card.style.animationDelay = (i * 0.03) + 's';
    if (allDone) card.style.borderColor = 'rgba(34, 197, 94, 0.3)';
    card.innerHTML = `
      <div class="session-card-top">
        <div class="session-number" ${allDone ? 'style="background:linear-gradient(135deg, #22c55e, #16a34a)"' : ''}>${allDone ? '<i class="fas fa-check"></i>' : sess.id}</div>
        <div class="session-info">
          <div class="session-name">${sess.zone}</div>
          <div class="session-villes">${sess.villes.join(', ')}</div>
        </div>
        <span class="session-badge badge-count">${done}/${total}</span>
      </div>
      <div class="session-progress">
        <div class="session-progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="session-niches">
        ${niches.map(n => `<span class="niche-tag ${n.includes('BTP') ? 'niche-btp' : n.includes('Restauration') ? 'niche-resto' : ''}">${n}</span>`).join('')}
      </div>
    `;
    card.addEventListener('click', () => { vibrate(); showSession(sess); });
    list.appendChild(card);
  });
}

// --- SESSION VIEW ---
let hideSupprimer = false;

function showSession(sess) {
  currentSession = sess;
  currentView = 'session';
  scrollTop();

  document.getElementById('view-dashboard').classList.add('hidden');
  document.getElementById('view-session').classList.remove('hidden');
  document.getElementById('view-prospect').classList.add('hidden');

  document.getElementById('btn-back').classList.remove('hidden');
  document.getElementById('header-title').textContent = 'Session ' + sess.id;

  const done = countSessionDone(sess);
  document.getElementById('header-stats').textContent = done + '/' + sess.prospects.length + ' faits';

  document.getElementById('session-zone').textContent = sess.zone;
  document.getElementById('session-meta').textContent =
    sess.prospects.length + ' prospects — ' + sess.villes.join(', ');

  document.getElementById('session-map-link').href = buildMapsUrl(sess.prospects);

  // Filter toggle
  const filterBar = document.getElementById('session-filter-bar') || (() => {
    const bar = document.createElement('div');
    bar.id = 'session-filter-bar';
    bar.style.cssText = 'display:flex;gap:8px;padding:0 16px 12px;align-items:center;';
    document.getElementById('view-session').insertBefore(bar, document.getElementById('prospects-list'));
    return bar;
  })();

  const suppCount = sess.prospects.filter(p => p.audit_verdict === 'SUPPRIMER').length;
  filterBar.innerHTML = `
    <button id="btn-filter-supprimer" style="
      padding:6px 12px;border-radius:20px;border:1px solid ${hideSupprimer ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'};
      background:${hideSupprimer ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)'};
      color:${hideSupprimer ? '#22c55e' : '#f87171'};font-size:12px;cursor:pointer;white-space:nowrap;
    ">
      <i class="fas fa-${hideSupprimer ? 'eye' : 'eye-slash'}"></i>
      ${hideSupprimer ? 'Afficher tout' : 'Masquer SUPPRIMER (' + suppCount + ')'}
    </button>
  `;
  document.getElementById('btn-filter-supprimer').addEventListener('click', () => {
    hideSupprimer = !hideSupprimer;
    showSession(sess);
  });

  const list = document.getElementById('prospects-list');
  list.innerHTML = '';

  const verdictStyle = {
    GARDER: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', icon: 'fa-check-circle', label: 'GARDER' },
    SUPPRIMER: { bg: 'rgba(239,68,68,0.1)', color: '#f87171', icon: 'fa-times-circle', label: 'SUPPRIMER' },
    DOUTE: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', icon: 'fa-question-circle', label: 'DOUTE' },
  };

  let visibleIndex = 0;
  sess.prospects.forEach((p) => {
    if (hideSupprimer && p.audit_verdict === 'SUPPRIMER') return;

    const done = isDone(p.nom);
    const card = document.createElement('div');
    card.className = 'prospect-card animate-in';
    card.style.animationDelay = (visibleIndex * 0.03) + 's';
    visibleIndex++;

    if (done) { card.style.opacity = '0.45'; card.style.borderColor = 'rgba(34,197,94,0.2)'; }
    if (p.audit_verdict === 'SUPPRIMER' && !done) card.style.opacity = '0.6';

    const vs = p.audit_verdict ? verdictStyle[p.audit_verdict] : null;
    card.innerHTML = `
      <div class="prospect-card-header">
        <div class="prospect-rank" ${done ? 'style="background:var(--green);color:white"' : ''}>${done ? '<i class="fas fa-check"></i>' : (visibleIndex)}</div>
        <div class="prospect-main">
          <div class="prospect-name">${p.nom}</div>
          <div class="prospect-niche">${p.niche} — ${p.ville}</div>
        </div>
        <button class="prospect-check ${done ? 'done' : ''}" data-nom="${p.nom}">
          <i class="fas fa-check"></i>
        </button>
      </div>
      <div class="prospect-tags">
        <span class="tag tag-ca">${p.ca}</span>
        <span class="tag tag-effectif">${p.effectif}</span>
        ${p.score ? `<span class="tag tag-score">Score ${p.score}</span>` : ''}
        ${vs ? `<span class="tag" style="background:${vs.bg};color:${vs.color}"><i class="fas ${vs.icon}"></i> ${vs.label}</span>` : ''}
        ${p.contact_nom || p.dirigeant ? '<span class="tag" style="background:rgba(59,130,246,0.1);color:#60a5fa"><i class="fas fa-user-tie"></i></span>' : ''}
      </div>
    `;

    card.querySelector('.prospect-check').addEventListener('click', (e) => {
      e.stopPropagation();
      vibrate(30);
      setDone(p.nom, !isDone(p.nom));
      showSession(sess);
    });

    card.addEventListener('click', () => { vibrate(); showProspect(p); });
    list.appendChild(card);
  });
}

// --- PROSPECT DETAIL ---
function showProspect(p) {
  currentProspect = p;
  currentView = 'prospect';
  scrollTop();

  document.getElementById('view-dashboard').classList.add('hidden');
  document.getElementById('view-session').classList.add('hidden');
  document.getElementById('view-prospect').classList.remove('hidden');

  document.getElementById('btn-back').classList.remove('hidden');
  document.getElementById('header-title').textContent = 'Fiche prospect';
  document.getElementById('header-stats').textContent = p.niche;

  const done = isDone(p.nom);
  const notes = getNotesMap()[p.nom] || '';
  const siteUrl = p.site ? 'https://' + p.site.replace(/^https?:\/\//, '') : '';

  const detail = document.getElementById('prospect-detail');
  detail.innerHTML = `
    <div class="detail-hero animate-in">
      ${p.image_url ? `<div style="width:100%;height:180px;border-radius:var(--radius-sm);overflow:hidden;margin-bottom:14px;background:var(--bg-elevated)">
        <img src="${p.image_url}" alt="${p.nom}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'">
      </div>` : ''}
      <h2>${p.nom}</h2>
      <div class="niche-label"><i class="fas fa-tag"></i> ${p.niche}${p.forme_juridique ? ' — ' + p.forme_juridique : ''}${p.annee_creation ? ' (depuis ' + p.annee_creation + ')' : ''}</div>
      <div class="detail-tags">
        <span class="detail-tag tag-ca"><i class="fas fa-chart-line"></i> ${p.ca_precis || p.ca}</span>
        <span class="detail-tag tag-effectif"><i class="fas fa-users"></i> ${p.effectif_precis || p.effectif}</span>
        ${p.score ? `<span class="detail-tag tag-score"><i class="fas fa-star"></i> ${p.score}</span>` : ''}
      </div>
    </div>

    ${p.contact_nom || p.dirigeant ? `<div class="detail-section animate-in" style="animation-delay:0.03s;border:1px solid rgba(59,130,246,0.2);background:rgba(59,130,246,0.04)">
      <div class="detail-section-title" style="color:var(--accent)"><i class="fas fa-user-tie"></i> Contact identifié</div>
      ${p.dirigeant ? `<div class="detail-row">
        <span class="detail-label">Dirigeant</span>
        <span class="detail-value" style="font-weight:600">${p.dirigeant}</span>
      </div>` : ''}
      ${p.contact_nom && p.contact_nom !== p.dirigeant ? `<div class="detail-row">
        <span class="detail-label">${p.contact_role || 'Contact'}</span>
        <span class="detail-value" style="font-weight:600">${p.contact_nom}</span>
      </div>` : ''}
      ${p.contact_source ? `<div style="margin-top:6px;font-size:11px;color:var(--text-muted)"><i class="fas fa-link" style="margin-right:4px"></i>Source : ${p.contact_source}</div>` : ''}
    </div>` : ''}

    <div class="detail-section animate-in" style="animation-delay:0.04s">
      <div class="detail-section-title"><i class="fas fa-building"></i> Informations</div>
      ${p.adresse || p.address ? `<div class="detail-row">
        <span class="detail-label">Adresse</span>
        <span class="detail-value">${p.adresse || p.address}</span>
      </div>` : `<div class="detail-row">
        <span class="detail-label">Ville</span>
        <span class="detail-value">${p.ville}</span>
      </div>`}
      <div class="detail-row">
        <span class="detail-label">CA</span>
        <span class="detail-value" style="${p.ca_precis ? 'color:var(--green);font-weight:600' : ''}">${p.ca_precis || p.ca}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Effectif</span>
        <span class="detail-value" style="${p.effectif_precis ? 'font-weight:600' : ''}">${p.effectif_precis || p.effectif}</span>
      </div>
      ${p.forme_juridique ? `<div class="detail-row">
        <span class="detail-label">Forme juridique</span>
        <span class="detail-value">${p.forme_juridique}</span>
      </div>` : ''}
      ${p.annee_creation ? `<div class="detail-row">
        <span class="detail-label">Création</span>
        <span class="detail-value">${p.annee_creation}</span>
      </div>` : ''}
      <div class="detail-row">
        <span class="detail-label">Secteur</span>
        <span class="detail-value">${p.secteur || p.niche}</span>
      </div>
      ${p.site ? `<div class="detail-row">
        <span class="detail-label">Site web</span>
        <span class="detail-value" style="color:var(--accent-light)">${p.site}</span>
      </div>` : ''}
    </div>

    ${p.description ? `<div class="detail-section animate-in" style="animation-delay:0.08s">
      <div class="detail-section-title"><i class="fas fa-info-circle"></i> Description</div>
      <div class="detail-desc">${p.description}</div>
    </div>` : ''}

    ${p.audit_verdict ? (() => {
      const verdictConfig = {
        GARDER: { border: 'rgba(34,197,94,0.25)', bg: 'rgba(34,197,94,0.06)', color: '#22c55e', icon: 'fa-check-circle', label: 'À prospecter' },
        SUPPRIMER: { border: 'rgba(239,68,68,0.2)', bg: 'rgba(239,68,68,0.05)', color: '#f87171', icon: 'fa-times-circle', label: 'À écarter' },
        DOUTE: { border: 'rgba(251,191,36,0.25)', bg: 'rgba(251,191,36,0.06)', color: '#fbbf24', icon: 'fa-question-circle', label: 'À vérifier' },
      };
      const vc = verdictConfig[p.audit_verdict];
      const qualiteLabel = { nul: '❌ Nul', basique: '⚠️ Basique', correct: '🟡 Correct', bon: '🟢 Bon', excellent: '✅ Excellent' };
      return `<div class="detail-section animate-in" style="animation-delay:0.09s;border:1px solid ${vc.border};background:${vc.bg}">
        <div class="detail-section-title" style="color:${vc.color}"><i class="fas ${vc.icon}"></i> Audit site web — ${vc.label}</div>
        ${p.audit_qualite_site ? `<div class="detail-row">
          <span class="detail-label">Qualité site</span>
          <span class="detail-value">${qualiteLabel[p.audit_qualite_site] || p.audit_qualite_site}</span>
        </div>` : ''}
        ${p.audit_raison ? `<div style="margin-top:10px;font-size:13px;line-height:1.55;color:var(--text-muted)">${p.audit_raison}</div>` : ''}
      </div>`;
    })() : ''}

    ${p.audit ? `<div class="detail-section animate-in" style="animation-delay:0.1s;border:1px solid rgba(239,68,68,0.15)">
      <div class="detail-section-title" style="color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Problèmes identifiés</div>
      ${(p.audit.problemes || []).map(pb => `
        <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:var(--text-muted);display:flex;align-items:flex-start;gap:8px">
          <i class="fas fa-times-circle" style="color:var(--red);margin-top:2px;flex-shrink:0"></i><span>${pb}</span>
        </div>
      `).join('')}
    </div>` : ''}

    ${p.audit ? `<div class="detail-section animate-in" style="animation-delay:0.12s;border:1px solid rgba(34,197,94,0.15)">
      <div class="detail-section-title" style="color:var(--green)"><i class="fas fa-euro-sign"></i> Potentiel & Pitch</div>
      ${p.audit.potentiel ? `<div class="detail-row">
        <span class="detail-label">Potentiel CA digital</span>
        <span class="detail-value" style="color:var(--green);font-weight:700;font-size:15px">${p.audit.potentiel}</span>
      </div>` : ''}
      ${p.audit.pitch ? `<div style="margin-top:12px;padding:14px;background:var(--accent-glow);border-radius:var(--radius-sm);font-size:13px;line-height:1.6;color:var(--accent-light);border-left:3px solid var(--accent)">
        <i class="fas fa-quote-left" style="margin-right:8px;opacity:0.6"></i>${p.audit.pitch}
      </div>` : ''}
    </div>` : ''}

    <div class="detail-section animate-in" style="animation-delay:0.14s">
      <div class="detail-section-title"><i class="fas fa-sticky-note"></i> Notes de terrain</div>
      <textarea id="prospect-notes" placeholder="Ajouter des notes après la visite..." style="
        width:100%;min-height:100px;background:var(--bg-elevated);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-sm);
        padding:12px;color:var(--text);font-family:inherit;font-size:13px;resize:vertical;outline:none;line-height:1.5;
      ">${notes}</textarea>
    </div>

    <div class="detail-actions animate-in" style="animation-delay:0.18s">
      ${siteUrl ? `<a href="${siteUrl}" target="_blank" rel="noopener" class="btn-action btn-website">
        <i class="fas fa-globe"></i> Voir le site web
      </a>` : ''}
      ${p.linkedin ? `<a href="${p.linkedin}" target="_blank" rel="noopener" class="btn-action btn-linkedin">
        <i class="fab fa-linkedin"></i> Profil LinkedIn
      </a>` : ''}
      <a href="${buildSearchMapUrl(p)}" target="_blank" rel="noopener" class="btn-action btn-navigate">
        <i class="fas fa-map-marker-alt"></i> Voir sur Google Maps
      </a>
      <a href="${buildSingleMapUrl(p)}" target="_blank" rel="noopener" class="btn-action btn-call" style="background:var(--purple)">
        <i class="fas fa-route"></i> Itinéraire depuis chez moi
      </a>
      <button class="btn-action btn-done-action ${done ? 'is-done' : ''}" id="btn-toggle-done">
        <i class="fas ${done ? 'fa-check-circle' : 'fa-circle'}"></i>
        ${done ? 'Prospecté ✓' : 'Marquer comme prospecté'}
      </button>
    </div>
  `;

  document.getElementById('prospect-notes').addEventListener('input', (e) => {
    setNote(p.nom, e.target.value);
  });

  document.getElementById('btn-toggle-done').addEventListener('click', () => {
    vibrate(30);
    setDone(p.nom, !isDone(p.nom));
    showProspect(p);
  });
}

// --- NAVIGATION ---
function goBack() {
  if (currentView === 'prospect') {
    if (currentSession) showSession(currentSession);
    else { currentView = 'dashboard'; showDashboardView(); }
  } else if (currentView === 'session') {
    currentView = 'dashboard';
    showDashboardView();
  }
}

function showDashboardView() {
  scrollTop();
  document.getElementById('view-dashboard').classList.remove('hidden');
  document.getElementById('view-session').classList.add('hidden');
  document.getElementById('view-prospect').classList.add('hidden');
  document.getElementById('btn-back').classList.add('hidden');
  document.getElementById('header-title').textContent = 'ProspectR';
  renderDashboard();
}

document.getElementById('btn-back').addEventListener('click', () => { vibrate(); goBack(); });

// Android back button
window.addEventListener('popstate', (e) => {
  if (currentView !== 'dashboard') {
    e.preventDefault();
    goBack();
  }
});

// Push initial state
if (window.history && history.pushState) {
  history.replaceState({ view: 'dashboard' }, '');
}

// --- Session 1 audit data (from deep website analysis) ---
const SESSION1_AUDITS = {
  'ALBEDO Ingénierie Environnementale': {
    address: '5 Rue de la Poterne, 76000 Rouen',
    potentiel: '150K - 450K €/an',
    problemes: ['Page contact en erreur 404', 'Zéro meta description', 'Aucun CTA commercial', 'Site statique HTML sans CMS', 'Zéro blog'],
    pitch: 'Votre page contact est en erreur 404. Vos références (BNF, ORANO) sont invisibles sur Google.'
  },
  'Menuiserie DELAUNAY ROUEN': {
    address: '28 Rue des Sapins, 76000 Rouen',
    potentiel: '500K - 1.3M €/an',
    problemes: ['Site abandonné depuis 3 ans', 'Blog = article WordPress par défaut', '6 pages seulement', 'Zéro réseaux sociaux', 'Logo avec faute de frappe'],
    pitch: 'Votre blog affiche l\'article par défaut WordPress depuis 3 ans. Depuis 1967, le savoir-faire est là mais invisible.'
  },
  'DEPS ROUEN plomberie - sanitaire': {
    address: '10 Avenue de la Porte des Champs, 76000 Rouen',
    potentiel: '70K - 400K €/an',
    problemes: ['Téléphone invisible', 'Pas de sitemap XML', 'Contenu 200-350 mots/page', 'Zéro blog', 'Joomla daté'],
    pitch: 'Votre numéro de téléphone est introuvable. Un client cherchant "plombier Rouen" ne vous trouve pas.'
  },
  'SAT-Société Auxiliaire de Travaux': {
    address: '8 Rue des Jardiniers, 76000 Rouen',
    potentiel: '72K - 122K €/an',
    problemes: ['Chiffres clés = 0 employés, 0€ CA', 'Aucun téléphone/email visible', 'Copyright 2023', 'Zéro blog', 'Aucun CTA'],
    pitch: 'Votre page affiche 0 employés, 0€ CA et 0% satisfaction. Avec 78 ans d\'expertise, SAT mérite mieux.'
  },
  'Restaurant D\'Eux-Mêmes': {
    address: '9 Place du Vieux Marché, 76000 Rouen',
    potentiel: '73K - 110K €/an',
    problemes: ['WordPress 4.9.5 (2018)', 'Blog mort depuis 4.5 ans', 'Google+ encore référencé', 'Réservation basique', 'Aucun avis affiché sur site'],
    pitch: 'Votre WordPress date de 2018 — risque de piratage majeur. Vos labels sont sous-exploités en ligne.'
  },
  'Menuiserie Willy Letombe': {
    address: '36 Rue de Bammeville, 76100 Rouen',
    potentiel: '70K - 150K €/an',
    problemes: ['Lorem Ipsum visible sur le site', 'Architecture mono-page', 'Lien Google+ mort', 'Aucune meta description', '300+ photos sans alt text'],
    pitch: 'Du Lorem Ipsum visible, Google+ mort depuis 7 ans, 500+ réalisations totalement invisibles.'
  },
  'BATIDEC': {
    address: '32 Rue du Mail, 76000 Rouen',
    potentiel: '70K - 200K €/an',
    problemes: ['4 pages indexées seulement', 'Contenu caché en JavaScript Divi', 'Zéro blog', '0 page par prestation', 'Facebook 51 likes'],
    pitch: '50 ans d\'expérience, 4.7/5 Google, certifié RGE — mais 4 pages. 20-40 devis/mois vont aux concurrents.'
  },
  'Mongo Immo': {
    address: '43 Rue de Bihorel, 76000 Rouen',
    potentiel: '80K - 150K €/an',
    problemes: ['SSL CASSÉ — site inaccessible', 'Site figé depuis 2017', '112 likes Facebook en 11 ans', 'Zéro blog', 'Pas d\'Instagram'],
    pitch: 'Votre site est inaccessible — le SSL est cassé. 95% des visiteurs partent immédiatement.'
  },
  'Rd Electricien': {
    address: '24 Quai Cavelier de la Salle, 76100 Rouen',
    potentiel: '78K - 260K €/an',
    problemes: ['Blog irrégulier', 'Pas de Google Ads', 'Avis Google non valorisés', 'Pas de FAQ structurée', 'GMB non optimisé'],
    pitch: '122 pages, bon maillage — site à 70%. Sans Ads ni blog régulier, 78-260K€ sont sur la table.'
  },
  'FOLLAIN COUVERTURE': {
    address: '103 Rue Grieu, 76000 Rouen',
    potentiel: '70K - 300K €/an',
    problemes: ['~10 pages, zéro blog', 'Zéro réseaux sociaux', 'Email Hotmail professionnel', 'Résultat net -6.7K€ en 2024', '4.6/5 Google non exploité'],
    pitch: 'Résultat net passé de +37K à -6.7K. Certifié RGE+Velux mais invisible en ligne. Le digital peut inverser la tendance.'
  }
};

// --- INIT ---
async function init() {
  try {
    const resp = await fetch('data.json');
    DATA = await resp.json();
  } catch {
    DATA = { sessions: [] };
  }

  // Inject audit data into Session 1 prospects
  if (DATA.sessions.length > 0) {
    DATA.sessions[0].prospects.forEach(p => {
      const audit = SESSION1_AUDITS[p.nom];
      if (audit) {
        p.address = audit.address;
        p.audit = audit;
      }
    });

    // Remove "STATION SERVICE ROUEN" from session 1
    DATA.sessions[0].prospects = DATA.sessions[0].prospects.filter(
      p => !p.nom.toUpperCase().includes('STATION SERVICE')
    );
  }

  // Push state for back button
  if (history.pushState) history.pushState({ view: 'dashboard' }, '', '');

  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('main-app').classList.remove('hidden');
    renderDashboard();
  }, 2200);
}

init();
