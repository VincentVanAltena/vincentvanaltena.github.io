/* ══════════════════════════════════════════
   Vincent van Altena — Publii Theme JS
   ══════════════════════════════════════════ */

/* ── Year ── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ── Language toggle ── */
function setLang(lang) {
  document.documentElement.lang = lang;
  const btnNl = document.getElementById('btn-nl');
  const btnEn = document.getElementById('btn-en');
  if (btnNl) btnNl.classList.toggle('active', lang === 'nl');
  if (btnEn) btnEn.classList.toggle('active', lang === 'en');
  try { localStorage.setItem('lang', lang); } catch(e) {}
}
try {
  const saved = localStorage.getItem('lang');
  if (saved === 'nl' || saved === 'en') setLang(saved);
} catch(e) {}

/* ── Curated publication filter ── */
function filterPubs(cat, btn) {
  document.querySelectorAll('#publicaties .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#pub-list .pub-item').forEach(item => {
    item.style.display = (cat === 'all' || item.dataset.cat === cat) ? 'flex' : 'none';
  });
}

/* ══════════════════════════════════════════
   ZOTERO LIVE BIBLIOGRAPHY
   Config injected by bibliography.hbs:
     window.ZOTERO_USER
     window.ZOTERO_COLLECTION
   ══════════════════════════════════════════ */
(function() {
  const USER       = window.ZOTERO_USER       || '1380493';
  const COLLECTION = window.ZOTERO_COLLECTION || '9. For website';
  const API        = `https://api.zotero.org/users/${USER}`;
  const PAGE_SIZE  = 24;
  const PUB_TYPES  = ['journalArticle','book','bookSection','conferencePaper','thesis','report','presentation','preprint'];

  let zAllItems    = [];
  let zFiltered    = [];
  let zCurrentType = 'all';
  let zCurrentSearch = '';
  let zShown       = 0;

  /* ── Labels & colours per item type ── */
  const TYPE_LABELS = {
    journalArticle:  { nl: 'Artikel',      en: 'Article'      },
    book:            { nl: 'Boek',          en: 'Book'         },
    bookSection:     { nl: 'Hoofdstuk',     en: 'Chapter'      },
    conferencePaper: { nl: 'Conferentie',   en: 'Conference'   },
    thesis:          { nl: 'Proefschrift',  en: 'Thesis'       },
    report:          { nl: 'Rapport',       en: 'Report'       },
    preprint:        { nl: 'Preprint',      en: 'Preprint'     },
    presentation:    { nl: 'Presentatie',   en: 'Presentation' },
  };
  const TYPE_COLORS = {
    journalArticle:  { bg: '#EAF3DE', color: '#3B6D11' },
    book:            { bg: '#E1F5EE', color: '#0F6E56' },
    bookSection:     { bg: '#EEEDFE', color: '#534AB7' },
    conferencePaper: { bg: '#E6F1FB', color: '#185FA5' },
    thesis:          { bg: '#FAEEDA', color: '#854F0B' },
    default:         { bg: '#F1EDE7', color: '#6B6560' },
  };

  function lang() { return document.documentElement.lang || 'nl'; }
  function typeLabel(type) { return (TYPE_LABELS[type] && TYPE_LABELS[type][lang()]) || type; }
  function badgeStyle(type) { const c = TYPE_COLORS[type] || TYPE_COLORS.default; return `background:${c.bg};color:${c.color};`; }

  function formatAuthors(creators) {
    if (!creators || !creators.length) return '';
    const names = creators.filter(c => c.creatorType === 'author').map(c => c.lastName || c.name || '').filter(Boolean);
    if (!names.length) return '';
    return names.length <= 3 ? names.join(', ') : names.slice(0,3).join(', ') + ' et al.';
  }

  function getYear(item) {
    const m = (item.data.date || '').match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : '';
  }

  function getISBN(d) {
    if (!d.ISBN) return null;
    for (const part of d.ISBN.split(/[\s,;]+/)) {
      const c = part.replace(/[^0-9X]/gi, '');
      if (c.length === 10 || c.length === 13) return c;
    }
    return null;
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function coverPlaceholderHTML(type) {
    const isBook = ['book','bookSection'].includes(type);
    const hint = isBook ? (lang() === 'nl' ? 'Voeg cover toe via Extra-veld' : 'Add cover via Extra field') : '';
    return `<div class="zotero-card-cover-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="2" width="14" height="20" rx="1"/><path d="M7 6h6M7 10h6M7 14h4"/>
      </svg>
      ${hint ? `<span>${hint}</span>` : ''}
    </div>`;
  }

  window.makePlaceholder = function(type) {
    const div = document.createElement('div');
    div.innerHTML = coverPlaceholderHTML(type);
    return div.firstElementChild;
  };

  function buildCover(d, type) {
    const extra = d.extra || '';
    const manual = extra.match(/^cover:\s*(https?:\/\/\S+)/im);
    if (manual) return `<img class="zotero-card-cover" src="${escHtml(manual[1])}" alt="" loading="lazy" onerror="this.replaceWith(makePlaceholder('${escHtml(type)}'))">`;

    if (['book','bookSection'].includes(type)) {
      const isbn = getISBN(d);
      if (isbn) return `<img class="zotero-card-cover" src="https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg" alt="" loading="lazy" onerror="this.replaceWith(makePlaceholder('${escHtml(type)}'))">`;
    }
    return coverPlaceholderHTML(type);
  }

  function renderCard(item) {
    const d     = item.data;
    const type  = d.itemType;
    const title = d.title || (lang() === 'nl' ? '(geen titel)' : '(no title)');
    const year  = getYear(item);
    const auth  = formatAuthors(d.creators);
    const venue = d.publicationTitle || d.bookTitle || d.publisher || d.institution || '';
    const url   = d.url || (d.DOI ? `https://doi.org/${d.DOI}` : '');

    const badge    = `<span class="zotero-card-type" style="${badgeStyle(type)};font-size:10px;padding:2px 8px;border-radius:12px;">${typeLabel(type)}</span>`;
    const yearSpan = year ? `<span class="zotero-card-year">${year}</span>` : '';
    const meta     = [auth, venue].filter(Boolean).map(escHtml).join(' — ');
    const cover    = buildCover(d, type);
    const body     = `<div class="zotero-card-body">
      ${badge}${yearSpan}
      <div class="zotero-card-title">${escHtml(title)}</div>
      ${meta ? `<div class="zotero-card-meta">${meta}</div>` : ''}
    </div>`;

    const inner = cover + body;
    return url
      ? `<a class="zotero-card" href="${escHtml(url)}" target="_blank" rel="noopener">${inner}</a>`
      : `<div class="zotero-card">${inner}</div>`;
  }

  function applyFilters() {
    const q = zCurrentSearch.toLowerCase();
    zFiltered = zAllItems.filter(item => {
      if (zCurrentType !== 'all' && item.data.itemType !== zCurrentType) return false;
      if (!q) return true;
      return [item.data.title||'', formatAuthors(item.data.creators), item.data.publicationTitle||'', item.data.bookTitle||'', getYear(item)]
        .join(' ').toLowerCase().includes(q);
    });
    zShown = 0;
    renderVisible();
  }

  function renderVisible() {
    const grid    = document.getElementById('zotero-grid');
    const btn     = document.getElementById('zotero-more');
    const countEl = document.getElementById('zotero-count');
    if (!grid) return;

    const slice = zFiltered.slice(0, zShown + PAGE_SIZE);
    grid.innerHTML = slice.map(renderCard).join('');
    zShown = slice.length;

    const total = zFiltered.length;
    if (countEl) countEl.textContent = lang() === 'nl' ? `${zShown} van ${total}` : `${zShown} of ${total}`;

    if (btn) btn.style.display = zShown < total ? 'block' : 'none';
    if (total === 0 && zAllItems.length > 0) {
      grid.innerHTML = `<p class="zotero-empty">${lang() === 'nl' ? 'Geen resultaten gevonden.' : 'No results found.'}</p>`;
    }
  }

  window.zoteroFilter = function(type, btn) {
    document.querySelectorAll('#zotero-filters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    zCurrentType = type;
    applyFilters();
  };
  window.zoteroSearch = function(val) { zCurrentSearch = val.trim(); applyFilters(); };
  window.zoteroLoadMore = function() { renderVisible(); };

  /* ── API helpers ── */
  async function fetchAllPages(url) {
    let start = 0, limit = 100, total = null, results = [];
    while (true) {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}format=json&limit=${limit}&start=${start}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (total === null) total = parseInt(res.headers.get('Total-Results') || '0', 10);
      const batch = await res.json();
      if (!batch.length) break;
      results = results.concat(batch);
      start += limit;
      if (start >= total) break;
    }
    return results;
  }

  async function resolveCollectionKey() {
    const all = await fetchAllPages(`${API}/collections`);
    const match = all.find(c => c.data.name.trim().toLowerCase() === COLLECTION.trim().toLowerCase());
    if (!match) throw new Error(`Collection "${COLLECTION}" not found`);
    return match.key;
  }

  async function getSubcollectionKeys(parentKey) {
    const subs = await fetchAllPages(`${API}/collections/${parentKey}/collections`);
    return subs.map(s => s.key);
  }

  async function fetchItemsForCollection(key) {
    const all = await fetchAllPages(`${API}/collections/${key}/items?sort=date&direction=desc`);
    return all.filter(i => PUB_TYPES.includes(i.data.itemType));
  }

  async function fetchAllZoteroItems() {
    const loadingEl = document.getElementById('zotero-loading');
    const errorEl   = document.getElementById('zotero-error');
    try {
      const rootKey = await resolveCollectionKey();
      const subKeys = await getSubcollectionKeys(rootKey);
      const batches = await Promise.all([rootKey, ...subKeys].map(fetchItemsForCollection));
      const flat    = batches.flat();

      const seen  = new Set();
      const items = flat.filter(i => { if (seen.has(i.key)) return false; seen.add(i.key); return true; });
      items.sort((a, b) => (parseInt(getYear(b),10)||0) - (parseInt(getYear(a),10)||0));

      zAllItems = items;
      if (loadingEl) loadingEl.style.display = 'none';
      if (!items.length) { if (errorEl) errorEl.style.display = 'block'; return; }
      applyFilters();
    } catch(err) {
      console.warn('Zotero:', err);
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'block';
    }
  }

  /* Start fetching when bibliography section enters viewport */
  const section = document.getElementById('bibliografie');
  if (section) {
    new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting) { obs.disconnect(); fetchAllZoteroItems(); }
    }, { rootMargin: '300px' }).observe(section);
  }
})();
