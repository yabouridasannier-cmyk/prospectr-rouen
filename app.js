const HOME_ADDRESS = '30 Rue Puel-Éloir, Saint-Étienne-du-Rouvray 76800';

let DATA = { sessions: [] };
let SALON_DATA = { sessions: [], hall_maps: {} };
let currentMode = 'physique'; // 'physique' or 'salon'
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

function getActiveData() {
  return currentMode === 'salon' ? SALON_DATA : DATA;
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

function scrollTop() { window.scrollTo({ top: 0, behavior: 'instant' }); }

// --- MODE TABS ---
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    vibrate();
    currentMode = tab.dataset.mode;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    if (currentMode === 'conseils') {
      document.getElementById('view-dashboard').querySelector('.dashboard-hero').style.display = 'none';
      document.getElementById('section-title-area').style.display = 'none';
      document.getElementById('sessions-list').style.display = 'none';
      document.getElementById('salon-search-bar').classList.add('hidden');
      document.getElementById('view-conseils').classList.remove('hidden');
      document.getElementById('header-stats').textContent = '';
      renderConseils();
    } else {
      document.getElementById('view-dashboard').querySelector('.dashboard-hero').style.display = '';
      document.getElementById('section-title-area').style.display = '';
      document.getElementById('sessions-list').style.display = '';
      document.getElementById('view-conseils').classList.add('hidden');
      // Show/hide search bar based on mode
      const searchBar = document.getElementById('salon-search-bar');
      if (currentMode === 'salon') {
        searchBar.classList.remove('hidden');
      } else {
        searchBar.classList.add('hidden');
      }
      renderDashboard();
    }
  });
});

// --- SEARCH ---
document.getElementById('salon-search-input').addEventListener('input', (e) => {
  const term = e.target.value.trim().toLowerCase();
  if (!term) {
    renderDashboard();
    return;
  }
  const allP = SALON_DATA.sessions.flatMap(s => s.prospects);
  const matches = allP.filter(p => p.nom.toLowerCase().includes(term) || (p.niche && p.niche.toLowerCase().includes(term)));

  const list = document.getElementById('sessions-list');
  document.getElementById('section-title-area').style.display = 'none';

  if (matches.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-muted)"><i class="fas fa-search" style="font-size:24px;margin-bottom:10px;display:block;opacity:0.3"></i><p style="font-size:13px;font-weight:600">Pas encore qualifié</p><p style="font-size:11px;margin-top:4px">À prospecter au feeling sur place</p></div>';
    return;
  }

  document.getElementById('section-title-area').style.display = '';
  document.getElementById('section-title-area').innerHTML = '<h2>' + matches.length + ' résultat' + (matches.length > 1 ? 's' : '') + '</h2><p>Recherche : "' + e.target.value + '"</p>';

  list.innerHTML = '';
  matches.forEach((p, i) => {
    const done = isDone(p.nom);
    const card = document.createElement('div');
    card.className = 'prospect-card animate-in';
    card.style.animationDelay = (i * 0.02) + 's';
    if (done) card.style.opacity = '0.5';

    card.innerHTML = '<div class="prospect-card-header"><div class="prospect-rank" ' + (done ? 'style="background:var(--green);color:white"' : '') + '>' + (done ? '<i class="fas fa-check"></i>' : (i + 1)) + '</div><div class="prospect-main"><div class="prospect-name">' + p.nom + '</div><div class="prospect-niche">' + p.niche + ' — ' + p.ville + '</div></div></div><div class="prospect-tags"><span class="tag tag-ca">' + p.ca + '</span><span class="tag tag-effectif">' + p.effectif + '</span>' + (p.audit_qualite_site ? qualiteBadge(p.audit_qualite_site) : '') + (p.interet ? interetBadge(p.interet) : '') + '</div>' + '<div class="prospect-pipeline">' + statusIcon(getStatus(p.nom)) + ' <span class="pipeline-label">' + getStatus(p.nom) + '</span></div>';

    card.addEventListener('click', () => { vibrate(); showProspect(p); });
    list.appendChild(card);
  });
});

// --- CONSEILS ---
function renderConseils() {
  const el = document.getElementById('conseils-content');
  el.innerHTML = '' +
  // SECTION 1: Les 3 scénarios
  '<div class="detail-section animate-in" style="animation-delay:0.02s">' +
    '<div class="detail-section-title" style="color:var(--green)"><i class="fas fa-bullseye"></i> LES 3 SCÉNARIOS D\'ÉCHANGE</div>' +

    '<div class="scenario-card scenario-hot">' +
      '<div class="scenario-header"><span class="scenario-num">1</span><span class="scenario-title">RDV DÉCROCHÉ <span class="scenario-badge hot">Chaud 🔥</span></span></div>' +
      '<div class="scenario-body">' +
        '<p>Échange 2-5 min, bon feeling, on fixe le RDV directement.</p>' +
        '<div class="scenario-steps">' +
          '<div class="s-step">→ Accroche + pitch 20s</div>' +
          '<div class="s-step">→ Hook trafic / problème identifié</div>' +
          '<div class="s-step">→ "Je vous prépare un audit gratuit"</div>' +
          '<div class="s-step">→ <b>Fixer le RDV sur place</b> (date + heure)</div>' +
        '</div>' +
        '<div class="scenario-result"><i class="fas fa-calendar-check"></i> Résultat : RDV calé ✅</div>' +
      '</div>' +
    '</div>' +

    '<div class="scenario-card scenario-warm">' +
      '<div class="scenario-header"><span class="scenario-num">2</span><span class="scenario-title">CARTE DONNÉE <span class="scenario-badge warm">Tiède 🟠</span></span></div>' +
      '<div class="scenario-body">' +
        '<p>Intéressé mais pas prêt. On échange les cartes.</p>' +
        '<div class="scenario-steps">' +
          '<div class="s-step">→ Accroche + pitch 20s</div>' +
          '<div class="s-step">→ Intérêt détecté mais "pas le moment"</div>' +
          '<div class="s-step">→ <b>Donner ma carte + prendre la sienne</b></div>' +
          '<div class="s-step">→ "Je vous recontacte après le salon"</div>' +
        '</div>' +
        '<div class="scenario-result"><i class="fas fa-phone"></i> Relance J+3 à J+5 : "Bonjour [Prénom], on s\'est croisé au salon, on avait convenu de se fixer un RDV. Mardi prochain, ça vous irait ?"</div>' +
      '</div>' +
    '</div>' +

    '<div class="scenario-card scenario-cold">' +
      '<div class="scenario-header"><span class="scenario-num">3</span><span class="scenario-title">NON DÉFINITIF → PARRAINAGE <span class="scenario-badge cold">Froid ❄️</span></span></div>' +
      '<div class="scenario-body">' +
        '<p>Pas intéressé. On passe en mode référence.</p>' +
        '<div class="scenario-steps">' +
          '<div class="s-step">→ Accepter le non avec le sourire</div>' +
          '<div class="s-step">→ <b>Donner quand même ma carte</b></div>' +
          '<div class="s-step">→ "Si dans votre entourage quelqu\'un a besoin d\'un site ou de visibilité web, n\'hésitez pas"</div>' +
          '<div class="s-step">→ Demander : "Vous connaissez un artisan qui galère avec son site ?"</div>' +
        '</div>' +
        '<div class="scenario-result"><i class="fas fa-handshake"></i> Résultat : Référence obtenue 🤝 (ou rien, mais carte placée)</div>' +
      '</div>' +
    '</div>' +
  '</div>' +

  // SECTION 2: Script de pitch détaillé
  '<div class="detail-section animate-in" style="animation-delay:0.04s">' +
    '<div class="detail-section-title" style="color:var(--blue)"><i class="fas fa-microphone-alt"></i> SCRIPT DE PITCH</div>' +
    '<div class="pitch-steps">' +
      '<div class="pitch-step"><span class="pitch-num">1</span><div class="pitch-content"><b>Accroche</b><br>Attendre le eye contact. Puis : <em>"Ah [Nom], c\'est bien vous ! Justement je vous cherchais, j\'ai préparé un petit truc pour vous."</em></div></div>' +
      '<div class="pitch-step"><span class="pitch-num">2</span><div class="pitch-content"><b>Intro 20 secondes</b><br><em>"Je me présente rapidement — Yanis Sagnier, société LogiPro. Je travaille avec [X] [même niche] au salon. Je me suis permis d\'analyser votre profil."</em></div></div>' +
      '<div class="pitch-step"><span class="pitch-num">3</span><div class="pitch-content"><b>Hook trafic</b><br><em>"J\'ai vu que le mois dernier vous avez atteint [X] visiteurs. D\'ailleurs, je vous en félicite."</em></div></div>' +
      '<div class="pitch-step"><span class="pitch-num">4</span><div class="pitch-content"><b>Proposition</b><br><em>"Justement, je préparerai pour vous une solution pour récupérer un maximum de ces visiteurs, ou bien les passer de [X] à [2X]."</em></div></div>' +
      '<div class="pitch-step"><span class="pitch-num">5</span><div class="pitch-content"><b>Close R1</b><br><em>"Je peux vous présenter ça plus en détail. On se fixe un créneau après le salon ?"</em></div></div>' +
    '</div>' +
  '</div>' +

  // SECTION 3: Schéma zigzag
  '<div class="detail-section animate-in" style="animation-delay:0.06s">' +
    '<div class="detail-section-title" style="color:var(--red)"><i class="fas fa-map"></i> ORDRE DE PROSPECTION — ZIGZAG</div>' +
    '<p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Ne JAMAIS prospecter en ligne. Zigzaguer pour que les voisins ne voient pas qu\'on démarche tout le monde.</p>' +
    '<div class="zigzag-container">' +
      '<div class="zigzag-row">' +
        '<div class="zigzag-stand"><span class="zigzag-num">5</span></div>' +
        '<div class="zigzag-stand"><span class="zigzag-num hot">1</span></div>' +
        '<div class="zigzag-stand"><span class="zigzag-num">7</span></div>' +
      '</div>' +
      '<div class="zigzag-arrow">↙ traverser ↗</div>' +
      '<div class="zigzag-row">' +
        '<div class="zigzag-stand"><span class="zigzag-num">3</span></div>' +
        '<div class="zigzag-stand"><span class="zigzag-num">9</span></div>' +
        '<div class="zigzag-stand"><span class="zigzag-num hot">2</span></div>' +
      '</div>' +
      '<div class="zigzag-arrow">↙ traverser ↗</div>' +
      '<div class="zigzag-row">' +
        '<div class="zigzag-stand"><span class="zigzag-num">8</span></div>' +
        '<div class="zigzag-stand"><span class="zigzag-num hot">4</span></div>' +
        '<div class="zigzag-stand"><span class="zigzag-num">10</span></div>' +
      '</div>' +
      '<div class="zigzag-arrow">↙ traverser ↗</div>' +
      '<div class="zigzag-row">' +
        '<div class="zigzag-stand"><span class="zigzag-num hot">6</span></div>' +
        '<div class="zigzag-stand"><span class="zigzag-num">11</span></div>' +
        '<div class="zigzag-stand"><span class="zigzag-num">12</span></div>' +
      '</div>' +
    '</div>' +
    '<p style="font-size:11px;color:var(--text-dim);margin-top:10px;text-align:center"><span style="color:var(--red)">●</span> = prioritaires | Toujours traverser l\'allée entre chaque</p>' +
  '</div>' +

  // SECTION 4: Approches à tester
  '<div class="detail-section animate-in" style="animation-delay:0.07s">' +
    '<div class="detail-section-title" style="color:var(--purple)"><i class="fas fa-flask"></i> APPROCHES À TESTER</div>' +
    '<p style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Tester plusieurs variantes et garder ce qui marche le mieux.</p>' +

    '<div class="approach-card">' +
      '<span class="approach-tag">Approche #1 — Classique</span>' +
      '<div class="approach-title">Eye contact + "Je vous cherchais"</div>' +
      '<div class="approach-script">"Ah [Nom], c\'est bien vous ! Justement je vous cherchais, j\'ai préparé un petit truc pour vous et je suis sûr que ça peut vous intéresser."</div>' +
    '</div>' +

    '<div class="approach-card">' +
      '<span class="approach-tag">Approche #2 — Data & Implication</span>' +
      '<div class="approach-title">Chiffres précis + crédibilité niche</div>' +
      '<div class="approach-script">"Bonjour [Nom], Yanis Sagnier, LogiPro. Je travaille avec 4 entreprises d\'isolation au salon et je les aide en moyenne à augmenter leur chiffre d\'affaires de 14%. J\'ai analysé votre site — vous avez [X] visiteurs/mois, et je peux vous montrer comment en récupérer 3× plus. On se pose 2 minutes ?"</div>' +
      '<p style="font-size:10px;color:var(--text-dim);margin-top:6px">💡 Adapter le nombre d\'entreprises et le % selon la niche du prospect.</p>' +
    '</div>' +

    '<div class="approach-card">' +
      '<span class="approach-tag">Approche #3 — Social proof salon</span>' +
      '<div class="approach-title">"Votre voisin m\'a recommandé de vous voir"</div>' +
      '<div class="approach-script">"Bonjour ! Je viens de discuter avec [Nom du voisin], il m\'a dit que vous faisiez un super travail en [niche]. Je suis Yanis, je fais du digital pour les artisans. En 2 minutes, je vous montre ce que j\'ai vu sur votre présence en ligne ?"</div>' +
      '<p style="font-size:10px;color:var(--text-dim);margin-top:6px">💡 Utiliser la référence croisée même si le voisin n\'a pas explicitement recommandé.</p>' +
    '</div>' +

    '<div class="approach-card">' +
      '<span class="approach-tag">Approche #4 — Compliment + curiosité</span>' +
      '<div class="approach-title">"Votre stand m\'a interpellé"</div>' +
      '<div class="approach-script">"Excusez-moi, votre stand m\'a interpellé — [compliment sincère]. Vous êtes dans le [niche] depuis longtemps ? ... Et côté digital, vous avez un site ? Comment ça se passe pour vous les demandes de devis en ligne ?"</div>' +
      '<p style="font-size:10px;color:var(--text-dim);margin-top:6px">💡 Plus naturel, idéal quand on n\'a pas encore la fiche du prospect.</p>' +
    '</div>' +
  '</div>' +

  // SECTION 5: Tips terrain
  '<div class="detail-section animate-in" style="animation-delay:0.08s">' +
    '<div class="detail-section-title"><i class="fas fa-list-check"></i> TIPS TERRAIN</div>' +
    '<div class="tips-list">' +
      '<div class="tip do"><i class="fas fa-check"></i> Arriver tôt (10h) — les exposants sont frais et dispo</div>' +
      '<div class="tip do"><i class="fas fa-check"></i> Avoir les fiches prospect ouvertes sur le tel AVANT d\'approcher</div>' +
      '<div class="tip do"><i class="fas fa-check"></i> Toujours utiliser le prénom du dirigeant dès l\'accroche</div>' +
      '<div class="tip do"><i class="fas fa-check"></i> Garder 10+ cartes de visite en poche</div>' +
      '<div class="tip do"><i class="fas fa-check"></i> Prendre des notes IMMÉDIATEMENT après chaque échange</div>' +
      '<div class="tip do"><i class="fas fa-check"></i> Sourire, posture ouverte, contact visuel</div>' +
      '<div class="tip dont"><i class="fas fa-times"></i> Ne PAS distribuer des flyers à la chaîne</div>' +
      '<div class="tip dont"><i class="fas fa-times"></i> Ne PAS prospecter 2 voisins d\'affilée</div>' +
      '<div class="tip dont"><i class="fas fa-times"></i> Ne PAS insister si "non" clair — passer en mode parrainage</div>' +
      '<div class="tip dont"><i class="fas fa-times"></i> Ne PAS rester planté devant un stand occupé — revenir plus tard</div>' +
      '<div class="tip dont"><i class="fas fa-times"></i> Ne PAS parler prix au 1er contact — c\'est pour le R1</div>' +
    '</div>' +
  '</div>';
}

// --- DASHBOARD ---
function renderDashboard() {
  const data = getActiveData();
  const allP = data.sessions.flatMap(s => s.prospects);
  const totalP = allP.length;
  const garderCount = allP.filter(p => p.audit_verdict === 'GARDER').length;

  document.getElementById('total-prospects').textContent = garderCount + '/' + totalP;
  document.getElementById('total-sessions').textContent = data.sessions.length;

  // Count done for this mode only
  const modeDone = allP.filter(p => isDone(p.nom)).length;
  document.getElementById('total-done').textContent = modeDone;

  const pctGlobal = totalP ? Math.round(modeDone / totalP * 100) : 0;
  document.getElementById('header-stats').textContent = pctGlobal + '% complété';

  // Update section title
  const sectionTitle = document.getElementById('section-title-area');
  if (currentMode === 'salon') {
    sectionTitle.innerHTML = '<h2>Sessions salon</h2><p>Prospects rencontrés en foire / salon</p>';
  } else {
    sectionTitle.innerHTML = '<h2>Sessions de prospection</h2><p>Organisées par zone géographique</p>';
  }

  const list = document.getElementById('sessions-list');
  list.innerHTML = '';

  data.sessions.forEach((sess, i) => {
    const done = countSessionDone(sess);
    const total = sess.prospects.length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const niches = [...new Set(sess.prospects.map(p => p.niche))];
    const allDone = done === total && total > 0;

    const card = document.createElement('div');
    card.className = 'session-card animate-in';
    card.style.animationDelay = (i * 0.03) + 's';

    const numberClass = allDone ? 'session-number done-number' : 'session-number';

    card.innerHTML = `
      <div class="session-card-top">
        <div class="${numberClass}">${allDone ? '<i class="fas fa-check"></i>' : sess.id}</div>
        <div class="session-info">
          <div class="session-name">${sess.zone}</div>
          <div class="session-villes">${sess.villes.join(', ')}</div>
        </div>
        <span class="session-badge badge-count">${done}/${total}</span>
        ${sess.slots_feeling ? `<span class="session-badge badge-feeling">+${sess.slots_feeling} feeling</span>` : ''}
      </div>
      <div class="session-progress">
        <div class="session-progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="session-niches">
        ${niches.map(n => {
          let cls = 'niche-tag';
          if (n.includes('BTP')) cls += ' niche-btp';
          else if (n.includes('Restauration')) cls += ' niche-resto';
          else if (currentMode === 'salon') cls += ' niche-salon';
          return `<span class="${cls}">${n}</span>`;
        }).join('')}
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

  // Map link (hide for salon if no meaningful route)
  const mapLink = document.getElementById('session-map-link');
  if (currentMode === 'salon') {
    mapLink.style.display = 'none';
  } else {
    mapLink.style.display = 'inline-flex';
    mapLink.href = buildMapsUrl(sess.prospects);
  }

  // Insert hall map for salon mode Hall 7 sessions
  const mapContainer = document.getElementById('session-hall-map') || (() => {
    const div = document.createElement('div');
    div.id = 'session-hall-map';
    const headerCard = document.getElementById('session-header-card');
    headerCard.parentNode.insertBefore(div, headerCard.nextSibling);
    return div;
  })();
  if (currentMode === 'salon' && sess.hall === 'Hall 7') {
    mapContainer.innerHTML = renderHallMap(sess, null);
    mapContainer.querySelectorAll('.map-stand-tap').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const nom = el.getAttribute('data-nom');
        const p = sess.prospects.find(pr => pr.nom === nom);
        if (p) { vibrate(); showProspect(p); }
      });
    });
  } else {
    mapContainer.innerHTML = '';
  }

  // Filter toggle
  const filterBar = document.getElementById('session-filter-bar') || (() => {
    const bar = document.createElement('div');
    bar.id = 'session-filter-bar';
    bar.style.cssText = 'display:flex;gap:8px;padding:0 16px 12px;align-items:center;';
    document.getElementById('view-session').insertBefore(bar, document.getElementById('prospects-list'));
    return bar;
  })();

  const suppCount = sess.prospects.filter(p => p.audit_verdict === 'SUPPRIMER').length;
  if (suppCount > 0) {
    filterBar.innerHTML = `
      <button id="btn-filter-supprimer" style="
        padding:5px 12px;border-radius:20px;border:1px solid ${hideSupprimer ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.2)'};
        background:${hideSupprimer ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.04)'};
        color:${hideSupprimer ? 'var(--green)' : 'var(--red)'};font-size:11px;cursor:pointer;white-space:nowrap;font-family:inherit;font-weight:500;
      ">
        <i class="fas fa-${hideSupprimer ? 'eye' : 'eye-slash'}"></i>
        ${hideSupprimer ? 'Afficher tout' : 'Masquer SUPPRIMER (' + suppCount + ')'}
      </button>
    `;
    document.getElementById('btn-filter-supprimer').addEventListener('click', () => {
      hideSupprimer = !hideSupprimer;
      showSession(sess);
    });
  } else {
    filterBar.innerHTML = '';
  }

  const list = document.getElementById('prospects-list');
  list.innerHTML = '';

  const verdictStyle = {
    GARDER: { bg: 'var(--green-bg)', color: 'var(--green)', icon: 'fa-check-circle', label: 'GARDER' },
    SUPPRIMER: { bg: 'var(--red-bg)', color: 'var(--red)', icon: 'fa-times-circle', label: 'SUPPRIMER' },
    DOUTE: { bg: 'var(--orange-bg)', color: 'var(--orange)', icon: 'fa-question-circle', label: 'DOUTE' },
  };

  let visibleIndex = 0;
  sess.prospects.forEach((p) => {
    if (hideSupprimer && p.audit_verdict === 'SUPPRIMER') return;

    const done = isDone(p.nom);
    const card = document.createElement('div');
    card.className = 'prospect-card animate-in';
    card.style.animationDelay = (visibleIndex * 0.02) + 's';
    visibleIndex++;

    if (done) { card.style.opacity = '0.5'; }
    if (p.audit_verdict === 'SUPPRIMER' && !done) card.style.opacity = '0.55';

    const vs = p.audit_verdict ? verdictStyle[p.audit_verdict] : null;
    const standCode = p.stand_code || p.stand || '';
    const dirigeantShort = p.dirigeant && p.dirigeant !== 'À confirmer' ? p.dirigeant.split(' ').pop() : '';
    card.innerHTML = `
      <div class="prospect-card-header" style="position:relative">
        <div class="prospect-rank" ${done ? 'style="background:var(--green);color:white"' : ''}>${done ? '<i class="fas fa-check"></i>' : visibleIndex}</div>
        <div class="prospect-main">
          <div class="prospect-name">${p.nom}</div>
          <div class="prospect-niche">${p.dirigeant ? '<i class="fas fa-user-tie" style="font-size:9px;opacity:0.5"></i> ' + p.dirigeant + ' — ' : ''}${p.niche}</div>
        </div>
        ${currentMode === 'salon' && standCode ? `<span class="stand-prominent">${standCode}</span>` : ''}
        <button class="prospect-check ${done ? 'done' : ''}" data-nom="${p.nom}">
          <i class="fas fa-check"></i>
        </button>
      </div>
      <div class="prospect-tags">
        ${currentMode === 'salon' && p.audit_qualite_site ? qualiteBadge(p.audit_qualite_site) : ''}
        ${currentMode === 'salon' && p.interet ? interetBadge(p.interet) : ''}
        <span class="tag tag-ca">${p.ca}</span>
        ${p.score ? `<span class="tag tag-score">Score ${p.score}</span>` : ''}
        ${vs ? `<span class="tag" style="background:${vs.bg};color:${vs.color}"><i class="fas ${vs.icon}"></i> ${vs.label}</span>` : ''}
      </div>
      ${currentMode === 'salon' ? `<div class="prospect-pipeline">${statusIcon(getStatus(p.nom))} <span class="pipeline-label">${getStatus(p.nom)}</span></div>` : ''}
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

// --- AUDIT VERDICT HTML BUILDER ---
function buildAuditVerdictHtml(p) {
  if (!p.audit_verdict) return '';
  const verdictConfig = {
    GARDER: { border: 'rgba(22,163,74,0.15)', bg: 'rgba(22,163,74,0.03)', color: 'var(--green)', icon: 'fa-check-circle', label: 'À prospecter' },
    SUPPRIMER: { border: 'rgba(220,38,38,0.12)', bg: 'rgba(220,38,38,0.02)', color: 'var(--red)', icon: 'fa-times-circle', label: 'À écarter' },
    DOUTE: { border: 'rgba(217,119,6,0.15)', bg: 'rgba(217,119,6,0.03)', color: 'var(--orange)', icon: 'fa-question-circle', label: 'À vérifier' },
  };
  const vc = verdictConfig[p.audit_verdict];
  if (!vc) return '';
  const qualiteLabel = { nul: '❌ Nul', basique: '⚠️ Basique', correct: '🟡 Correct', bon: '🟢 Bon', excellent: '✅ Excellent' };
  let html = '<div class="detail-section animate-in" style="animation-delay:0.09s;border-color:' + vc.border + ';background:' + vc.bg + '">';
  html += '<div class="detail-section-title" style="color:' + vc.color + '"><i class="fas ' + vc.icon + '"></i> Audit site web — ' + vc.label + '</div>';
  if (p.audit_qualite_site) {
    html += '<div class="detail-row"><span class="detail-label">Qualité site</span><span class="detail-value">' + (qualiteLabel[p.audit_qualite_site] || p.audit_qualite_site) + '</span></div>';
  }
  if (p.audit_raison) {
    html += '<div style="margin-top:8px;font-size:12px;line-height:1.55;color:var(--text-muted)">' + p.audit_raison + '</div>';
  }
  html += '</div>';
  return html;
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

  const nextP = getNextProspect(currentSession, p);
  const prevP = getPrevProspect(currentSession, p);
  const standCode = p.stand_code || p.stand || '';
  const direction = getStandDirection(p);

  const detail = document.getElementById('prospect-detail');
  detail.innerHTML = `
    ${currentMode === 'salon' && standCode.startsWith('H7') ? `<div class="animate-in">${renderHallMap(currentSession, p.nom)}</div>` : ''}

    <div class="detail-hero animate-in" style="position:relative">
      ${standCode ? `<div class="stand-hero-badge">${standCode}</div>` : ''}
      ${direction ? `<div class="stand-direction"><i class="fas fa-location-arrow"></i> ${direction}</div>` : ''}
      <h2>${p.nom}</h2>
      ${p.dirigeant ? `<div class="briefing-dirigeant">${p.dirigeant === 'À confirmer' ? '<span style="color:var(--orange)"><i class="fas fa-exclamation-triangle"></i> Dirigeant à confirmer</span>' : '<i class="fas fa-user-tie" style="opacity:0.4;margin-right:4px"></i>' + p.dirigeant}</div>` : ''}
      ${p.angle_approche ? `<div class="briefing-angle"><i class="fas fa-quote-left" style="opacity:0.3;margin-right:6px"></i>${p.angle_approche}</div>` : ''}
      <div class="detail-tags" style="margin-top:10px">
        ${p.audit_qualite_site ? qualiteBadge(p.audit_qualite_site) : ''}
        ${p.interet ? interetBadge(p.interet) : ''}
        <span class="detail-tag tag-ca"><i class="fas fa-chart-line"></i> ${p.ca_precis || p.ca}</span>
        ${p.annee_creation ? `<span class="detail-tag" style="background:var(--bg-elevated);color:var(--text-muted)">Depuis ${p.annee_creation}</span>` : ''}
      </div>
    </div>

    ${nextP || prevP ? `<div class="walk-nav animate-in" style="animation-delay:0.02s">
      ${prevP ? `<button class="walk-nav-btn walk-prev" id="btn-walk-prev"><i class="fas fa-arrow-left"></i> ${prevP.nom.substring(0,15)}${prevP.nom.length > 15 ? '...' : ''}<br><small>${prevP.stand_code || prevP.stand || ''}</small></button>` : '<div></div>'}
      ${nextP ? `<button class="walk-nav-btn walk-next" id="btn-walk-next">${nextP.nom.substring(0,15)}${nextP.nom.length > 15 ? '...' : ''} <i class="fas fa-arrow-right"></i><br><small>${nextP.stand_code || nextP.stand || ''}</small></button>` : '<div></div>'}
    </div>` : ''}

    ${p.contact_nom || p.dirigeant ? `<div class="detail-section animate-in" style="animation-delay:0.03s;border-color:rgba(37,99,235,0.15);">
      <div class="detail-section-title" style="color:var(--blue)"><i class="fas fa-user-tie"></i> Contact identifié</div>
      ${p.dirigeant ? `<div class="detail-row">
        <span class="detail-label">Dirigeant</span>
        <span class="detail-value" style="font-weight:600">${p.dirigeant}</span>
      </div>` : ''}
      ${p.contact_nom && p.contact_nom !== p.dirigeant ? `<div class="detail-row">
        <span class="detail-label">${p.contact_role || 'Contact'}</span>
        <span class="detail-value" style="font-weight:600">${p.contact_nom}</span>
      </div>` : ''}
      ${p.contact_source ? `<div style="margin-top:6px;font-size:11px;color:var(--text-dim)"><i class="fas fa-link" style="margin-right:4px"></i>Source : ${p.contact_source}</div>` : ''}
    </div>` : ''}

    ${p.salon_notes ? `<div class="detail-section animate-in" style="animation-delay:0.035s;border-color:rgba(124,58,237,0.15);">
      <div class="detail-section-title" style="color:var(--purple)"><i class="fas fa-handshake"></i> Rencontre salon</div>
      <div class="detail-desc">${p.salon_notes}</div>
      ${p.interet ? `<div class="detail-row" style="margin-top:8px">
        <span class="detail-label">Niveau d'intérêt</span>
        <span class="detail-value" style="font-weight:600;color:${p.interet === 'Fort' ? 'var(--green)' : p.interet === 'Moyen' ? 'var(--orange)' : 'var(--text-muted)'}">${p.interet}</span>
      </div>` : ''}
      ${p.relance ? `<div class="detail-row">
        <span class="detail-label">Relance prévue</span>
        <span class="detail-value">${p.relance}</span>
      </div>` : ''}
    </div>` : ''}

    ${currentMode === 'salon' ? (() => {
      const st = getStatus(p.nom);
      const extra = getExtra(p.nom);
      const rel = getRelances(p.nom);
      return '<div class="detail-section animate-in" style="animation-delay:0.037s;border-color:rgba(24,24,27,0.15)">' +
        '<div class="detail-section-title"><i class="fas fa-funnel-dollar"></i> Pipeline de prospection</div>' +
        '<div class="pipeline-controls">' +
        PIPELINE_STEPS.map(s => {
          const active = s === st;
          const color = s === 'RDV calé' ? 'var(--green)' : s === 'Non définitif' ? 'var(--red)' : s === 'Référence obtenue' ? 'var(--purple)' : active ? 'var(--accent)' : 'var(--bg-muted)';
          return '<button class="pipeline-btn' + (active ? ' active' : '') + '" data-status="' + s + '" style="' + (active ? 'background:' + color + ';color:white;border-color:' + color : '') + '">' + statusIcon(s) + ' ' + s + '</button>';
        }).join('') +
        '</div>' +
        '<div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">' +
        '<div class="detail-row"><span class="detail-label">Relance #1</span><span class="detail-value">' + (rel.relance_1 ? rel.relance_1.canal + ' — ' + rel.relance_1.date : '<em style="color:var(--text-dim)">Pas encore</em>') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Relance #2</span><span class="detail-value">' + (rel.relance_2 ? rel.relance_2.canal + ' — ' + rel.relance_2.date : '<em style="color:var(--text-dim)">Pas encore</em>') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Email suivi</span><span class="detail-value">' + (extra.email_suivi ? '<i class="fas fa-check" style="color:var(--green)"></i> Envoyé' : '<i class="fas fa-times" style="color:var(--text-dim)"></i> Non') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">Audit envoyé</span><span class="detail-value">' + (extra.audit_envoye ? '<i class="fas fa-check" style="color:var(--green)"></i> Envoyé' : '<i class="fas fa-times" style="color:var(--text-dim)"></i> Non') + '</span></div>' +
        '</div>' +
        '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn-quick" id="btn-email-suivi"><i class="fas fa-envelope"></i> ' + (extra.email_suivi ? 'Email ✓' : 'Marquer email envoyé') + '</button>' +
        '<button class="btn-quick" id="btn-audit-envoye"><i class="fas fa-file-alt"></i> ' + (extra.audit_envoye ? 'Audit ✓' : 'Marquer audit envoyé') + '</button>' +
        '<button class="btn-quick" id="btn-relance1"><i class="fas fa-redo"></i> Relance #1</button>' +
        '<button class="btn-quick" id="btn-relance2"><i class="fas fa-redo"></i> Relance #2</button>' +
        '</div>' +
        '</div>';
    })() : ''}

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
        <span class="detail-value" style="color:var(--blue)">${p.site}</span>
      </div>` : ''}
    </div>

    ${p.description ? `<div class="detail-section animate-in" style="animation-delay:0.08s">
      <div class="detail-section-title"><i class="fas fa-info-circle"></i> Description</div>
      <div class="detail-desc">${p.description}</div>
    </div>` : ''}

    ${p.client_type || p.hall ? `<div class="detail-section animate-in" style="animation-delay:0.085s;border-color:rgba(124,58,237,0.12)">
      <div class="detail-section-title" style="color:var(--purple)"><i class="fas fa-crosshairs"></i> Intelligence commerciale</div>
      ${p.client_type ? `<div class="detail-row">
        <span class="detail-label">Leur client type</span>
        <span class="detail-value" style="font-weight:600">${p.client_type}</span>
      </div>` : ''}
      ${p.hall ? `<div class="detail-row">
        <span class="detail-label">Hall</span>
        <span class="detail-value">${p.hall}</span>
      </div>` : ''}
      ${p.jours_presence ? `<div class="detail-row">
        <span class="detail-label">Présence</span>
        <span class="detail-value">${p.jours_presence}</span>
      </div>` : ''}
    </div>` : ''}

    ${buildAuditVerdictHtml(p)}

    ${p.audit ? `<div class="detail-section animate-in" style="animation-delay:0.1s;border-color:rgba(220,38,38,0.1)">
      <div class="detail-section-title" style="color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Problèmes identifiés</div>
      ${(p.audit.problemes || []).map(pb => `
        <div style="padding:6px 0;border-bottom:1px solid var(--border-light);font-size:12px;color:var(--text-muted);display:flex;align-items:flex-start;gap:8px">
          <i class="fas fa-times-circle" style="color:var(--red);margin-top:2px;flex-shrink:0;font-size:10px"></i><span>${pb}</span>
        </div>
      `).join('')}
    </div>` : ''}

    ${p.audit ? `<div class="detail-section animate-in" style="animation-delay:0.12s;border-color:rgba(22,163,74,0.1)">
      <div class="detail-section-title" style="color:var(--green)"><i class="fas fa-euro-sign"></i> Potentiel & Pitch</div>
      ${p.audit.potentiel ? `<div class="detail-row">
        <span class="detail-label">Potentiel CA digital</span>
        <span class="detail-value" style="color:var(--green);font-weight:700;font-size:14px">${p.audit.potentiel}</span>
      </div>` : ''}
      ${p.audit.pitch ? `<div style="margin-top:10px;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);font-size:12px;line-height:1.6;color:var(--text-secondary);border-left:3px solid var(--accent)">
        <i class="fas fa-quote-left" style="margin-right:6px;opacity:0.4"></i>${p.audit.pitch}
      </div>` : ''}
    </div>` : ''}

    <div class="detail-section animate-in" style="animation-delay:0.14s">
      <div class="detail-section-title"><i class="fas fa-sticky-note"></i> Notes de terrain</div>
      <textarea id="prospect-notes" placeholder="Ajouter des notes après la visite..." style="
        width:100%;min-height:90px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);
        padding:12px;color:var(--text);font-family:inherit;font-size:12px;resize:vertical;outline:none;line-height:1.5;
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
      <a href="${buildSingleMapUrl(p)}" target="_blank" rel="noopener" class="btn-action btn-call">
        <i class="fas fa-route"></i> Itinéraire
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

  // Pipeline buttons (salon mode)
  if (currentMode === 'salon') {
    document.querySelectorAll('.pipeline-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        vibrate(20);
        setStatus(p.nom, btn.dataset.status);
        if (btn.dataset.status === 'RDV calé' || btn.dataset.status === 'Non définitif' || btn.dataset.status === 'Référence obtenue') {
          setDone(p.nom, true);
        }
        showProspect(p);
      });
    });

    const btnEmail = document.getElementById('btn-email-suivi');
    if (btnEmail) btnEmail.addEventListener('click', () => {
      vibrate(20);
      const cur = getExtra(p.nom).email_suivi;
      setExtra(p.nom, 'email_suivi', !cur);
      showProspect(p);
    });

    const btnAudit = document.getElementById('btn-audit-envoye');
    if (btnAudit) btnAudit.addEventListener('click', () => {
      vibrate(20);
      const cur = getExtra(p.nom).audit_envoye;
      setExtra(p.nom, 'audit_envoye', !cur);
      showProspect(p);
    });

    const btnR1 = document.getElementById('btn-relance1');
    if (btnR1) btnR1.addEventListener('click', () => {
      vibrate(20);
      const today = new Date().toISOString().split('T')[0];
      setRelance(p.nom, 1, { date: today, canal: 'Sur place' });
      if (getStatus(p.nom) === 'Contacté') setStatus(p.nom, 'Relance #1');
      showProspect(p);
    });

    const btnR2 = document.getElementById('btn-relance2');
    if (btnR2) btnR2.addEventListener('click', () => {
      vibrate(20);
      const today = new Date().toISOString().split('T')[0];
      setRelance(p.nom, 2, { date: today, canal: 'Sur place' });
      if (getStatus(p.nom) === 'Relance #1') setStatus(p.nom, 'Relance #2');
      showProspect(p);
    });
  }

  // Walk navigation (prev/next)
  const btnPrev = document.getElementById('btn-walk-prev');
  if (btnPrev && prevP) {
    btnPrev.addEventListener('click', () => { vibrate(); showProspect(prevP); });
  }
  const btnNext = document.getElementById('btn-walk-next');
  if (btnNext && nextP) {
    btnNext.addEventListener('click', () => { vibrate(); showProspect(nextP); });
  }

  // Map stand taps in prospect detail
  detail.querySelectorAll('.map-stand-tap').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      const nom = el.getAttribute('data-nom');
      const pr = currentSession ? currentSession.prospects.find(x => x.nom === nom) : null;
      if (pr) { vibrate(); showProspect(pr); }
    });
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

window.addEventListener('popstate', (e) => {
  if (currentView !== 'dashboard') {
    e.preventDefault();
    goBack();
  }
});

if (window.history && history.pushState) {
  history.replaceState({ view: 'dashboard' }, '');
}

// --- Session 1 audit data ---
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

// --- PROSPECT STATUS / PIPELINE HELPERS ---
const PIPELINE_STEPS = ['À contacter', 'Contacté', 'Relance #1', 'Relance #2', 'RDV calé', 'Non définitif', 'Référence obtenue'];

function getStatusMap() {
  try { return JSON.parse(localStorage.getItem('prospectr_status') || '{}'); } catch { return {}; }
}
function setStatus(key, val) {
  const m = getStatusMap(); m[key] = val;
  localStorage.setItem('prospectr_status', JSON.stringify(m));
}
function getStatus(key) { return getStatusMap()[key] || 'À contacter'; }

function getRelanceMap() {
  try { return JSON.parse(localStorage.getItem('prospectr_relances') || '{}'); } catch { return {}; }
}
function setRelance(key, num, data) {
  const m = getRelanceMap();
  if (!m[key]) m[key] = {};
  m[key]['relance_' + num] = data;
  localStorage.setItem('prospectr_relances', JSON.stringify(m));
}
function getRelances(key) { return getRelanceMap()[key] || {}; }

function getExtraMap() {
  try { return JSON.parse(localStorage.getItem('prospectr_extra') || '{}'); } catch { return {}; }
}
function setExtra(key, field, val) {
  const m = getExtraMap();
  if (!m[key]) m[key] = {};
  m[key][field] = val;
  localStorage.setItem('prospectr_extra', JSON.stringify(m));
}
function getExtra(key) { return getExtraMap()[key] || {}; }

function nextStatus(current) {
  const idx = PIPELINE_STEPS.indexOf(current);
  if (idx < 0 || idx >= 3) return current; // Only auto-advance up to Relance #2
  return PIPELINE_STEPS[idx + 1];
}

function statusIcon(status) {
  const map = {
    'À contacter': '<i class="fas fa-circle" style="color:var(--text-dim)"></i>',
    'Contacté': '<i class="fas fa-comment-dots" style="color:var(--blue)"></i>',
    'Relance #1': '<i class="fas fa-redo" style="color:var(--orange)"></i>',
    'Relance #2': '<i class="fas fa-redo" style="color:var(--red)"></i>',
    'RDV calé': '<i class="fas fa-calendar-check" style="color:var(--green)"></i>',
    'Non définitif': '<i class="fas fa-times-circle" style="color:var(--text-dim)"></i>',
    'Référence obtenue': '<i class="fas fa-handshake" style="color:var(--purple)"></i>',
  };
  return map[status] || '';
}

function qualiteBadge(q) {
  if (q === 'nul') return '<span class="badge-qualite badge-nul">Sans site</span>';
  if (q === 'basique') return '<span class="badge-qualite badge-basique">Site basique</span>';
  if (q === 'correct') return '<span class="badge-qualite badge-correct">Site correct</span>';
  if (q === 'bon') return '<span class="badge-qualite badge-bon">Bon site</span>';
  return '';
}

function interetBadge(i) {
  if (i === 'Fort') return '<span class="badge-interet badge-fort">Fort</span>';
  if (i === 'Moyen') return '<span class="badge-interet badge-moyen">Moyen</span>';
  if (i === 'Faible') return '<span class="badge-interet badge-faible">Faible</span>';
  return '';
}

// --- GPS / HALL MAP FUNCTIONS ---
function parseStandCode(code) {
  if (!code) return null;
  const m = code.match(/^H(\d+)([ABC])(\d+)/);
  if (!m) return null;
  return { hall: parseInt(m[1]), row: m[2], num: parseInt(m[3]) };
}

function getStandDirection(p) {
  const parsed = parseStandCode(p.stand_code || p.stand);
  if (!parsed || parsed.hall !== 7) return '';
  const rowLabel = { A: 'Rangée haute', B: 'Rangée milieu', C: 'Rangée basse' }[parsed.row] || '';
  const side = parsed.num <= 8 ? 'Côté gauche (entrée Hall 5)' : parsed.num <= 15 ? 'Zone centrale' : 'Côté droit (vers Hall 8)';
  const dist = Math.round(parsed.num * 2.5);
  return rowLabel + ' — ' + side + ' (~' + dist + 'm de l\'entrée)';
}

function getNextProspect(session, currentP) {
  if (!session || !session.prospects) return null;
  const idx = session.prospects.findIndex(p => p.nom === currentP.nom);
  return idx >= 0 && idx < session.prospects.length - 1 ? session.prospects[idx + 1] : null;
}

function getPrevProspect(session, currentP) {
  if (!session || !session.prospects) return null;
  const idx = session.prospects.findIndex(p => p.nom === currentP.nom);
  return idx > 0 ? session.prospects[idx - 1] : null;
}

function renderHallMap(session, highlightNom) {
  const hallMaps = SALON_DATA.hall_maps;
  if (!hallMaps || !hallMaps['Hall 7']) return '';
  const map = hallMaps['Hall 7'];
  const stands = map.stands;
  if (!stands) return '';

  // Build prospect lookup by stand
  const prospectByStand = {};
  if (session) {
    session.prospects.forEach(p => {
      const sc = p.stand_code || p.stand;
      if (sc) prospectByStand[sc] = p;
    });
  }

  let svg = '<svg viewBox="0 0 100 50" class="hall-map-svg" xmlns="http://www.w3.org/2000/svg">';
  // Background
  svg += '<rect x="0" y="0" width="100" height="50" rx="2" fill="#f5f5f4" stroke="#e7e5e4" stroke-width="0.3"/>';
  // Hall label
  svg += '<text x="50" y="4" text-anchor="middle" font-size="2.5" fill="#a8a29e" font-weight="600" font-family="Inter,sans-serif">HALL 7 — Amélioration de l\'Habitat</text>';
  // Entry/Exit labels
  svg += '<text x="1" y="25" font-size="1.8" fill="#a8a29e" font-family="Inter,sans-serif">← Hall 5</text>';
  svg += '<text x="92" y="25" font-size="1.8" fill="#a8a29e" font-family="Inter,sans-serif">Hall 8 →</text>';

  // Draw stands
  Object.entries(stands).forEach(([code, pos]) => {
    const x = pos.x * 92 + 4;
    const y = pos.y * 42 + 5;
    const w = pos.w * 92;
    const h = pos.h * 42;
    const prospect = prospectByStand[code];
    const isHighlighted = prospect && prospect.nom === highlightNom;
    const prospectDone = prospect && isDone(prospect.nom);

    let fill = '#e7e5e4'; // default (not a prospect)
    let stroke = '#d6d3d1';
    let strokeW = '0.2';

    if (prospect) {
      if (prospectDone) {
        fill = '#dcfce7'; stroke = '#16a34a'; strokeW = '0.3';
      } else if (prospect.audit_qualite_site === 'nul') {
        fill = '#fef2f2'; stroke = '#dc2626'; strokeW = '0.3';
      } else if (prospect.audit_qualite_site === 'basique') {
        fill = '#fffbeb'; stroke = '#d97706'; strokeW = '0.3';
      } else {
        fill = '#eff6ff'; stroke = '#2563eb'; strokeW = '0.3';
      }
    }

    if (isHighlighted) {
      fill = '#18181b'; stroke = '#18181b'; strokeW = '0.5';
    }

    svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="0.5" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + strokeW + '"' + (prospect ? ' data-nom="' + prospect.nom.replace(/"/g, '&quot;') + '" class="map-stand-tap"' : '') + (isHighlighted ? ' class="map-stand-active"' : '') + '/>';

    // Stand label
    const shortCode = code.replace('H7', '').replace('-', '/');
    const textColor = isHighlighted ? '#fff' : '#78716c';
    svg += '<text x="' + (x + w/2) + '" y="' + (y + h/2 + 0.8) + '" text-anchor="middle" font-size="1.3" fill="' + textColor + '" font-family="monospace">' + shortCode + '</text>';
  });

  svg += '</svg>';
  return '<div class="hall-map-container">' + svg + '<div class="hall-map-legend"><span class="legend-dot" style="background:#fef2f2;border-color:#dc2626"></span>Sans site <span class="legend-dot" style="background:#fffbeb;border-color:#d97706"></span>Basique <span class="legend-dot" style="background:#eff6ff;border-color:#2563eb"></span>Correct <span class="legend-dot" style="background:#dcfce7;border-color:#16a34a"></span>Fait <span class="legend-dot" style="background:#18181b;border-color:#18181b"></span>Actuel</div></div>';
}

// --- OLD SALON FICTIVE (replaced by salon_data.json) ---
function generateSalonData_UNUSED() {
  return {
    sessions: [
      {
        id: 'F1',
        zone: 'Foire de Rouen 2026',
        villes: ['Parc Expo Rouen'],
        routeKm: 0,
        prospects: [
          {
            nom: 'Maison Lefèvre Cuisines',
            niche: 'Cuisiniste / Agencement',
            site: 'maison-lefevre.fr',
            ville: 'Rouen',
            ca: '500K-1M',
            effectif: '6-10',
            secteur: 'Agencement intérieur',
            description: 'Cuisiniste haut de gamme, showroom au centre de Rouen. Présent à la foire avec un stand de démonstration.',
            score: 34,
            audit_verdict: 'GARDER',
            audit_qualite_site: 'basique',
            audit_raison: 'Site Wix daté, pas de référencement local, aucune prise de RDV en ligne.',
            dirigeant: 'Mathieu Lefèvre',
            contact_nom: 'Mathieu Lefèvre',
            contact_role: 'Gérant',
            contact_source: 'Rencontre salon',
            forme_juridique: 'SARL',
            annee_creation: '2014',
            stand: 'Hall B - 42',
            salon_notes: 'Très intéressé par une refonte site + SEO local. A mentionné vouloir lancer la prise de RDV en ligne. Budget autour de 5-8K€.',
            interet: 'Fort',
            relance: 'Semaine du 31 mars'
          },
          {
            nom: 'Normandie Piscines & Spas',
            niche: 'Piscines / Bien-être',
            site: 'normandie-piscines.com',
            ville: 'Bois-Guillaume',
            ca: '1M-5M',
            effectif: '11-20',
            secteur: 'Piscines',
            description: 'Installation et entretien de piscines et spas. Forte saisonnalité, cherche à lisser l\'activité.',
            score: 28,
            audit_verdict: 'GARDER',
            audit_qualite_site: 'correct',
            audit_raison: 'Site WordPress correct mais lent, pas de blog, pas de configurateur en ligne.',
            dirigeant: 'Stéphane Marchand',
            contact_nom: 'Julie Marchand',
            contact_role: 'Responsable commerciale',
            contact_source: 'Rencontre salon',
            forme_juridique: 'SAS',
            annee_creation: '2008',
            stand: 'Hall A - 15',
            salon_notes: 'Veut un configurateur de piscine en ligne + campagnes Ads saisonnières. Travaille déjà avec une agence mais pas satisfait.',
            interet: 'Fort',
            relance: 'Appel le 28 mars'
          },
          {
            nom: 'Atelier Bois Normand',
            niche: 'Menuiserie / Ébénisterie',
            site: null,
            ville: 'Elbeuf',
            ca: '200K-500K',
            effectif: '3-5',
            secteur: 'Artisanat bois',
            description: 'Ébéniste artisanal, mobilier sur-mesure. Aucun site web, travaille uniquement au bouche-à-oreille.',
            score: 22,
            audit_verdict: 'GARDER',
            audit_qualite_site: 'nul',
            audit_raison: 'Aucun site web. Aucune présence digitale. Potentiel de création from scratch.',
            dirigeant: 'Thierry Vasseur',
            contact_nom: 'Thierry Vasseur',
            contact_role: 'Artisan gérant',
            contact_source: 'Rencontre salon',
            forme_juridique: 'EI',
            annee_creation: '2011',
            stand: 'Hall C - 8',
            salon_notes: 'N\'a jamais eu de site. Intéressé mais budget limité (~2K€). Pourrait démarrer par une landing page + GMB.',
            interet: 'Moyen',
            relance: 'Mail + devis semaine prochaine'
          },
          {
            nom: 'Rénov\'Habitat 76',
            niche: 'BTP / Rénovation',
            site: 'renovhabitat76.fr',
            ville: 'Mont-Saint-Aignan',
            ca: '1M-5M',
            effectif: '15-25',
            secteur: 'Rénovation globale',
            description: 'Rénovation énergétique, certifié RGE. En forte croissance grâce aux aides MaPrimeRénov.',
            score: 38,
            audit_verdict: 'GARDER',
            audit_qualite_site: 'basique',
            audit_raison: 'Site Jimdo très basique. 3 pages. Aucun blog, aucun avis intégré. Énorme décalage avec le CA.',
            dirigeant: 'Laurent Dufresne',
            contact_nom: 'Laurent Dufresne',
            contact_role: 'Dirigeant',
            contact_source: 'Rencontre salon',
            forme_juridique: 'SAS',
            annee_creation: '2019',
            stand: 'Hall A - 33',
            salon_notes: 'CA en forte hausse, veut professionnaliser sa présence web. Prêt à investir 10K€+ pour un vrai site + stratégie SEO. Très chaud.',
            interet: 'Fort',
            relance: 'RDV fixé jeudi 27 mars 14h'
          },
          {
            nom: 'Les Jardins de Sophie',
            niche: 'Paysagisme / Espaces verts',
            site: 'jardins-sophie.fr',
            ville: 'Darnétal',
            ca: '200K-500K',
            effectif: '5-8',
            secteur: 'Paysagisme',
            description: 'Création et entretien de jardins. Clientèle haut de gamme, projets de 5K à 50K€.',
            score: 25,
            audit_verdict: 'DOUTE',
            audit_qualite_site: 'correct',
            audit_raison: 'Site WordPress correct visuellement mais pas de portfolio bien organisé, pas de blog.',
            dirigeant: 'Sophie Delamarre',
            contact_nom: 'Sophie Delamarre',
            contact_role: 'Gérante',
            contact_source: 'Rencontre salon',
            forme_juridique: 'SARL',
            annee_creation: '2016',
            stand: 'Ext. - 5',
            salon_notes: 'Intéressée mais veut d\'abord voir des exemples concrets dans son secteur. Envoyer portfolio paysagistes.',
            interet: 'Moyen',
            relance: 'Envoyer exemples par mail'
          },
          {
            nom: 'Ferme Bio du Vexin',
            niche: 'Agriculture / Circuit court',
            site: null,
            ville: 'Lyons-la-Forêt',
            ca: '100K-200K',
            effectif: '2-3',
            secteur: 'Agriculture biologique',
            description: 'Maraîcher bio, vente directe et paniers. Souhaite développer la vente en ligne.',
            score: 15,
            audit_verdict: 'DOUTE',
            audit_qualite_site: 'nul',
            audit_raison: 'Pas de site web. Page Facebook active mais pas suffisante. Budget très limité.',
            dirigeant: 'Nicolas Petit',
            contact_nom: 'Nicolas Petit',
            contact_role: 'Exploitant',
            contact_source: 'Rencontre salon',
            stand: 'Ext. - 12',
            salon_notes: 'Veut un site e-commerce pour ses paniers mais budget très serré (<1.5K€). Peut-être Shopify basique.',
            interet: 'Faible',
            relance: 'Pas prioritaire'
          }
        ]
      },
      {
        id: 'F2',
        zone: 'Salon Habitat & Déco Rouen',
        villes: ['Parc Expo Rouen'],
        routeKm: 0,
        prospects: [
          {
            nom: 'Concept Déco Intérieur',
            niche: 'Décoration / Architecture intérieure',
            site: 'concept-deco-interieur.fr',
            ville: 'Rouen',
            ca: '300K-500K',
            effectif: '4-6',
            secteur: 'Décoration intérieure',
            description: 'Cabinet d\'architecture intérieure et décoration. Projets résidentiels et commerciaux.',
            score: 30,
            audit_verdict: 'GARDER',
            audit_qualite_site: 'basique',
            audit_raison: 'Site Squarespace visuellement ok mais zéro SEO, pas de blog, pas de page projet structurée.',
            dirigeant: 'Claire Dubois',
            contact_nom: 'Claire Dubois',
            contact_role: 'Fondatrice',
            contact_source: 'Rencontre salon',
            forme_juridique: 'SAS',
            annee_creation: '2017',
            stand: 'Hall D - 21',
            salon_notes: 'Très sensible à l\'esthétique. Veut un site premium qui reflète son positionnement haut de gamme. Budget 8-12K€.',
            interet: 'Fort',
            relance: 'RDV semaine prochaine'
          },
          {
            nom: 'Normandie Domotique',
            niche: 'Domotique / Maison connectée',
            site: 'normandie-domotique.fr',
            ville: 'Le Petit-Quevilly',
            ca: '500K-1M',
            effectif: '8-12',
            secteur: 'Domotique',
            description: 'Installation de systèmes domotiques, alarmes, vidéosurveillance. En pleine expansion.',
            score: 32,
            audit_verdict: 'GARDER',
            audit_qualite_site: 'basique',
            audit_raison: 'Site custom daté, pas responsive. Gros potentiel SEO local non exploité.',
            dirigeant: 'Fabien Morel',
            contact_nom: 'Fabien Morel',
            contact_role: 'Dirigeant',
            contact_source: 'Rencontre salon',
            forme_juridique: 'SAS',
            annee_creation: '2015',
            stand: 'Hall D - 9',
            salon_notes: 'Cherche à se différencier de la concurrence (Somfy, Leroy Merlin). Veut mettre en avant ses installations personnalisées.',
            interet: 'Fort',
            relance: 'Appel lundi 31 mars'
          },
          {
            nom: 'Charpente Normande Tradition',
            niche: 'BTP / Charpente',
            site: 'charpente-normande.fr',
            ville: 'Barentin',
            ca: '1M-5M',
            effectif: '20-30',
            secteur: 'Charpente / Couverture',
            description: 'Charpentier traditionnel, restauration patrimoine. Intervient sur des projets de monuments historiques.',
            score: 35,
            audit_verdict: 'GARDER',
            audit_qualite_site: 'correct',
            audit_raison: 'Site WordPress correct mais blog abandonné depuis 2 ans. Portfolio mal mis en valeur.',
            dirigeant: 'Philippe Renault',
            contact_nom: 'Philippe Renault',
            contact_role: 'Président',
            contact_source: 'Rencontre salon',
            forme_juridique: 'SAS',
            annee_creation: '1998',
            stand: 'Hall B - 7',
            salon_notes: 'Entreprise prestigieuse, travaille avec les Monuments Historiques. Veut mettre en avant ce positionnement premium sur le web.',
            interet: 'Fort',
            relance: 'Envoyer proposition détaillée'
          }
        ]
      }
    ]
  };
}

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

    DATA.sessions[0].prospects = DATA.sessions[0].prospects.filter(
      p => !p.nom.toUpperCase().includes('STATION SERVICE')
    );
  }

  // Load salon data from JSON
  try {
    const salonResp = await fetch('salon_data.json');
    SALON_DATA = await salonResp.json();
  } catch {
    SALON_DATA = { sessions: [] };
  }

  if (history.pushState) history.pushState({ view: 'dashboard' }, '', '');

  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('main-app').classList.remove('hidden');
    renderDashboard();
  }, 2000);
}

init();
