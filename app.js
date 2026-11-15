/* Wo ist's? – lokale Lager-App. Alle Daten liegen in der IndexedDB dieses Browsers. */
'use strict';

const TYPES = {
  raum:   { label: 'Raum', icon: '🏠', child: 'moebel' },
  moebel: { label: 'Schrank / Regal', icon: '🗄️', child: 'karton' },
  fach:   { label: 'Fach / Schublade', icon: '🗂️', child: 'karton' },
  karton: { label: 'Karton / Kiste', icon: '📦', child: 'karton' },
};
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const byName = (a, b) => a.name.localeCompare(b.name, 'de', { numeric: true });

/* ---------- Datenhaltung (IndexedDB) ---------- */
let db;
const places = new Map(), items = new Map();

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('woists', 1);
    r.onupgradeneeded = () => ['places', 'items', 'photos'].forEach(s => r.result.createObjectStore(s, { keyPath: 'id' }));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function tx(store, mode, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = t.onabort = () => rej(t.error);
  });
}
const dbPut = (s, v) => tx(s, 'readwrite', o => o.put(v));
const dbDel = (s, id) => tx(s, 'readwrite', o => o.delete(id));
const dbGet = (s, id) => tx(s, 'readonly', o => o.get(id));
const dbAll = s => tx(s, 'readonly', o => o.getAll());
const dbClear = s => tx(s, 'readwrite', o => o.clear());

async function loadAll() {
  places.clear(); items.clear();
  (await dbAll('places')).forEach(p => places.set(p.id, p));
  (await dbAll('items')).forEach(i => items.set(i.id, i));
}
async function savePlace(p) { places.set(p.id, p); await dbPut('places', p); }
async function saveItem(i) { i.updatedAt = Date.now(); items.set(i.id, i); await dbPut('items', i); }

/* ---------- Baum-Helfer ---------- */
const childrenOf = pid => [...places.values()].filter(p => (p.parentId || null) === (pid || null)).sort(byName);
const itemsIn = pid => [...items.values()].filter(i => i.placeId === pid).sort(byName);
function pathOf(pid) {
  const out = [];
  for (let p = places.get(pid), n = 0; p && n < 50; p = places.get(p.parentId), n++) out.unshift(p);
  return out;
}
function descendants(pid) {
  const out = new Set([pid]);
  const walk = id => childrenOf(id).forEach(c => { out.add(c.id); walk(c.id); });
  walk(pid);
  return out;
}
const countDeep = pid => { const d = descendants(pid); return [...items.values()].filter(i => d.has(i.placeId)).length; };
const placeName = p => (p.code ? p.code + ' · ' : '') + p.name;
const pathText = pid => pathOf(pid).map(p => p.name).join(' › ') || 'Ohne Ort';
function nextCode() {
  let max = 0;
  places.forEach(p => { const m = /^K-(\d+)$/.exec(p.code || ''); if (m) max = Math.max(max, +m[1]); });
  return 'K-' + String(max + 1).padStart(3, '0');
}
function placeOptions(selected, exclude = new Set(), withRoot = false) {
  let html = withRoot ? `<option value="">— oberste Ebene —</option>` : '';
  const walk = (pid, depth) => childrenOf(pid).forEach(p => {
    if (exclude.has(p.id)) return;
    html += `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${' '.repeat(depth)}${TYPES[p.type].icon} ${esc(placeName(p))}</option>`;
    walk(p.id, depth + 1);
  });
  walk(null, 0);
  return html;
}

/* ---------- Fotos (verkleinert, ohne EXIF/GPS, nur lokal) ---------- */
const urlCache = new Map();
async function scaled(file, max, q) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
  }
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, 'image/jpeg', q));
}
async function addPhoto(file) {
  const id = uid();
  // Neu-Kodierung über Canvas entfernt alle Metadaten (Standort, Kameradaten).
  await dbPut('photos', { id, blob: await scaled(file, 1280, 0.8), thumb: await scaled(file, 240, 0.7) });
  return id;
}
async function photoUrl(id, size) {
  const key = id + size;
  if (!urlCache.has(key)) {
    const ph = await dbGet('photos', id);
    if (!ph) return '';
    urlCache.set(key, URL.createObjectURL(size === 'thumb' ? ph.thumb : ph.blob));
  }
  return urlCache.get(key);
}
function hydratePhotos(root = document) {
  root.querySelectorAll('img[data-photo]:not([src])').forEach(async img => {
    const u = await photoUrl(img.dataset.photo, img.dataset.size || 'thumb');
    if (u) img.src = u;
  });
}

/* ---------- Suche ---------- */
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
function fuzzy(tok, words) {
  if (tok.length < 5) return false;
  const max = tok.length >= 8 ? 2 : 1;
  return words.some(w => lev(tok, w, max) <= max || (w.length > tok.length && lev(tok, w.slice(0, tok.length), max) <= max));
}
function search(q) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return null;
  const exp = toks.map(expandQuery);
  const direct = [], related = [], foundPlaces = [];
  for (const it of items.values()) {
    const name = norm(it.name), tags = (it.tags || []).map(norm), notes = norm(it.notes);
    const path = norm(pathOf(it.placeId).map(placeName).join(' '));
    const words = (name + ' ' + tags.join(' ')).split(/[^a-z0-9]+/).filter(Boolean);
    let score = 0, isDirect = true, ok = true;
    toks.forEach((t, i) => {
      if (name.includes(t)) score += name.startsWith(t) ? 15 : 10;
      else if (tags.some(x => x.includes(t))) score += 7;
      else if (path.includes(t)) score += 5;
      else if (notes.includes(t)) score += 4;
      else if (fuzzy(t, words)) score += 3;
      else if (tags.some(x => exp[i].tags.has(x)) || [...exp[i].words].some(w => name.includes(w))) { score += 2; isDirect = false; }
      else ok = false;
    });
    if (ok) (isDirect ? direct : related).push({ it, score });
  }
  for (const p of places.values()) {
    const hay = norm(placeName(p) + ' ' + (p.notes || ''));
    if (toks.every(t => hay.includes(t))) foundPlaces.push(p);
  }
  const sort = arr => arr.sort((a, b) => b.score - a.score || byName(a.it, b.it)).map(x => x.it);
  return { direct: sort(direct), related: sort(related), places: foundPlaces.sort(byName) };
}

/* ---------- Bausteine ---------- */
function itemRow(it) {
  const ico = it.photoIds?.length ? `<img data-photo="${it.photoIds[0]}" alt="">` : (it.kind === 'sammel' ? '🧺' : '🔹');
  return `<a class="row" href="#/item/${it.id}">
    <div class="ico">${ico}</div>
    <div class="body">
      <div class="title">${esc(it.name)}${it.qty ? ` <span class="badge">×${esc(it.qty)}</span>` : ''}${it.out ? ' <span class="badge out">herausgenommen</span>' : ''}</div>
      <div class="sub">📍 ${esc(pathText(it.placeId))}</div>
    </div><span class="chev">›</span></a>`;
}
function placeRow(p) {
  const n = countDeep(p.id), kids = childrenOf(p.id).length;
  const ico = p.photoIds?.length ? `<img data-photo="${p.photoIds[0]}" alt="">` : TYPES[p.type].icon;
  return `<a class="row" href="#/ort/${p.id}">
    <div class="ico">${ico}</div>
    <div class="body">
      <div class="title">${p.code ? `<span class="code">${esc(p.code)}</span> ` : ''}${esc(p.name)}</div>
      <div class="sub">${TYPES[p.type].label} · ${n} ${n === 1 ? 'Gegenstand' : 'Gegenstände'}${kids ? ` · ${kids} Unterorte` : ''}</div>
    </div><span class="chev">›</span></a>`;
}
const list = rows => rows.length ? `<div class="list">${rows.join('')}</div>` : '';
const crumbs = (pid, last) => `<div class="crumbs"><a href="#/orte">Orte</a>${pathOf(pid).map(p => ` › <a href="#/ort/${p.id}">${esc(p.name)}</a>`).join('')}${last ? ` › <b>${esc(last)}</b>` : ''}</div>`;
const gallery = ids => ids?.length ? `<div class="photos">${ids.map(id => `<img data-photo="${id}" data-size="full" data-act="zoom" alt="Foto">`).join('')}</div>` : '';

/* ---------- Ansichten ---------- */
let lastQuery = '';
const views = {
  suche() {
    $('#view').innerHTML = `
      <input class="searchbox" type="search" id="q" placeholder="Was suchst du? z. B. Winterjacke" value="${esc(lastQuery)}" autocomplete="off">
      <div id="results"></div>`;
    renderResults();
  },
  orte() {
    const top = childrenOf(null);
    $('#view').innerHTML = `<h1>Orte</h1>
      <p class="muted small">Raum › Schrank/Regal › Fach › Karton – beliebig verschachtelbar.</p>
      ${list(top.map(placeRow)) || `<div class="empty"><div class="big">🏠</div>Noch keine Orte. Lege zuerst einen Raum an.</div>`}
      <div class="btnrow"><button class="btn primary" data-act="add-place" data-type="raum">＋ Raum</button>
      <button class="btn" data-act="add-place" data-type="karton">＋ Karton</button></div>`;
  },
  ort(id) {
    const p = places.get(id);
    if (!p) return views.orte();
    const kids = childrenOf(id), its = itemsIn(id), t = TYPES[p.type];
    $('#view').innerHTML = `${crumbs(p.parentId, p.name)}
      <h1>${t.icon} ${p.code ? `<span class="code">${esc(p.code)}</span> ` : ''}${esc(p.name)}</h1>
      <div class="muted small">${t.label}</div>
      ${gallery(p.photoIds)}
      ${p.notes ? `<p>${esc(p.notes)}</p>` : ''}
      <div class="btnrow">
        <button class="btn primary" data-act="add-item" data-place="${id}">＋ Gegenstand</button>
        <button class="btn" data-act="add-place" data-parent="${id}" data-type="${t.child}">＋ Unterort</button>
        <button class="btn" data-act="edit-place" data-id="${id}">✏️ Bearbeiten / Verschieben</button>
        <button class="btn danger" data-act="del-place" data-id="${id}">Löschen</button>
      </div>
      ${kids.length ? `<h2>Darin</h2>${list(kids.map(placeRow))}` : ''}
      <h2>Inhalt</h2>
      ${list(its.map(itemRow)) || `<p class="muted">Hier liegt direkt noch nichts.</p>`}`;
  },
  item(id) {
    const it = items.get(id);
    if (!it) return views.suche();
    const path = pathOf(it.placeId);
    $('#view').innerHTML = `${crumbs(it.placeId, it.name)}
      <h1>${esc(it.name)}${it.qty ? ` <span class="badge">×${esc(it.qty)}</span>` : ''}</h1>
      <div class="muted small">${it.kind === 'sammel' ? 'Sammlung / Gruppe' : 'Einzelstück'}${it.out ? ' · <span class="badge out">herausgenommen</span>' : ''}</div>
      ${gallery(it.photoIds)}
      <div class="card where"><div class="small muted">Liegt hier</div>
        <div class="path">${path.map(p => `<a href="#/ort/${p.id}">${TYPES[p.type].icon} ${esc(placeName(p))}</a>`).join(' › ') || 'Ohne Ort'}</div></div>
      ${it.tags?.length ? `<div class="chips">${it.tags.map(t => `<a class="chip" href="#/" data-act="tag-search" data-tag="${esc(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
      ${it.notes ? `<p>${esc(it.notes)}</p>` : ''}
      <div class="btnrow">
        <button class="btn primary" data-act="edit-item" data-id="${id}">✏️ Bearbeiten / Umlagern</button>
        <button class="btn" data-act="toggle-out" data-id="${id}">${it.out ? '↩️ Wieder eingelagert' : '📤 Herausgenommen'}</button>
        <button class="btn danger" data-act="del-item" data-id="${id}">Löschen</button>
      </div>
      <p class="muted small">Eingelagert am ${new Date(it.createdAt).toLocaleDateString('de-DE')}</p>`;
  },
  etiketten() {
    const boxes = [...places.values()].filter(p => p.code).sort((a, b) => a.code.localeCompare(b.code));
    $('#view').innerHTML = `<h1 class="noprint">Etiketten</h1>
      <p class="muted small noprint">Jeder Karton bekommt einen kurzen Code. Auf dem Etikett steht bewusst kein Inhalt – Besuch sieht nur „K-003“, du findest den Inhalt über die Suche.</p>
      <div class="btnrow noprint"><button class="btn primary" data-act="print">🖨️ Drucken</button></div>
      ${boxes.length ? `<div class="labels">${boxes.map(p => `<div class="label"><div class="code">${esc(p.code)}</div>
        <div class="n">${esc(p.name)}</div><div class="p">${esc(pathText(p.parentId))}</div></div>`).join('')}</div>`
        : `<div class="empty">Noch keine Kartons angelegt.</div>`}`;
  },
  mehr() {
    $('#view').innerHTML = `<h1>Mehr</h1>
      <h2>Privatsphäre</h2>
      <div class="card"><b>🔒 Deine Daten bleiben auf diesem Gerät.</b>
        <p class="small">Kein Konto, keine Cloud, keine Werbung, kein Tracking. Namen, Orte und Fotos liegen ausschließlich im lokalen Speicher dieses Browsers. Tags werden von einem eingebauten Wörterbuch vorgeschlagen – nichts wird zur Analyse verschickt. Fotos werden verkleinert und ohne Standort-/Kameradaten gespeichert.</p>
        <p class="small muted" id="persist"></p></div>
      <h2>Sicherung</h2>
      <div class="card"><p class="small">Weil nichts in einer Cloud liegt, bist du selbst für die Sicherung zuständig. Die Datei enthält alle Orte, Gegenstände und Fotos – mit Passwort wird sie verschlüsselt (AES-256).</p>
        <label class="f"><span>Passwort (optional)</span><input type="password" id="pw" autocomplete="new-password"></label>
        <div class="btnrow"><button class="btn primary" data-act="export">⬇️ Sicherung speichern</button>
          <label class="btn filebtn">⬆️ Sicherung einspielen<input type="file" id="importfile" accept=".json,application/json"></label></div></div>
      <h2>Daten</h2>
      <div class="btnrow"><button class="btn" data-act="demo">Beispieldaten laden</button>
        <button class="btn danger" data-act="wipe">Alles löschen</button></div>
      <p class="muted small">${items.size} Gegenstände · ${places.size} Orte</p>`;
    navigator.storage?.persisted?.().then(ok => {
      const el = $('#persist');
      if (el) el.textContent = ok ? 'Dauerhafter Speicher ist aktiv.' : 'Tipp: App zum Home-Bildschirm hinzufügen, damit der Browser die Daten nicht automatisch aufräumt.';
    });
  },
};

function renderResults() {
  const box = $('#results');
  if (!box) return;
  const r = search(lastQuery);
  if (!r) {
    const recent = [...items.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
    box.innerHTML = items.size
      ? `<p class="muted small">${items.size} Gegenstände an ${places.size} Orten</p><h2>Zuletzt eingelagert</h2>${list(recent.map(itemRow))}`
      : `<div class="empty"><div class="big">📦</div><p><b>Willkommen!</b><br>Lege einen Raum an, dann Schränke und Kartons – und lagere Dinge ein.</p>
         <div class="btnrow center"><button class="btn primary" data-act="add-place" data-type="raum">＋ Ersten Raum anlegen</button>
         <button class="btn" data-act="demo">Beispieldaten ansehen</button></div></div>`;
  } else if (!r.direct.length && !r.related.length && !r.places.length) {
    box.innerHTML = `<div class="empty">Nichts gefunden für „${esc(lastQuery)}“.</div>`;
  } else {
    box.innerHTML = (r.direct.length ? `<h2>Treffer</h2>${list(r.direct.map(itemRow))}` : '')
      + (r.places.length ? `<h2>Orte</h2>${list(r.places.map(placeRow))}` : '')
      + (r.related.length ? `<h2>Verwandte Treffer</h2>${list(r.related.map(itemRow))}` : '');
  }
  hydratePhotos(box);
}

function route() {
  const [, name = 'suche', id] = location.hash.split('/');
  const view = views[name] ? name : 'suche';
  views[view](id);
  const tab = { ort: 'orte', item: 'suche' }[view] || view;
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  hydratePhotos();
  window.scrollTo(0, 0);
}

/* ---------- Dialoge ---------- */
const dlg = $('#dlg');
let dlgState = null;
function openDialog(html, state) {
  dlg.innerHTML = html;
  dlgState = state;
  dlg.showModal();
  hydratePhotos(dlg);
}
async function closeDialog(cancelled) {
  if (cancelled && dlgState?.newPhotos) for (const id of dlgState.newPhotos) await dbDel('photos', id);
  dlgState = null;
  dlg.close();
  dlg.innerHTML = '';
}
dlg.addEventListener('cancel', e => { e.preventDefault(); closeDialog(true); });

const photoEditor = () => `<div class="photos edit" id="phs">${dlgState.photoIds.map(id =>
  `<div class="ph"><img data-photo="${id}" alt=""><button type="button" data-act="rm-photo" data-id="${id}" aria-label="Foto entfernen">×</button></div>`).join('')}</div>`;
function refreshPhotos() { $('#phs', dlg).outerHTML = photoEditor(); hydratePhotos(dlg); }

function formTags() {
  const s = dlgState;
  const auto = suggestTags($('#f-name', dlg).value + ' ' + $('#f-notes', dlg).value).filter(t => !s.removed.includes(norm(t)));
  const manual = s.manual.filter(t => !auto.some(a => norm(a) === norm(t)));
  return { auto, manual };
}
function refreshTags() {
  const { auto, manual } = formTags();
  $('#f-tags', dlg).innerHTML =
    auto.map(t => `<button type="button" class="chip auto" data-act="rm-tag" data-tag="${esc(t)}" data-auto="1">✨ ${esc(t)} ×</button>`).join('') +
    manual.map(t => `<button type="button" class="chip" data-act="rm-tag" data-tag="${esc(t)}">${esc(t)} ×</button>`).join('') ||
    '<span class="muted small">Tags erscheinen automatisch, sobald du einen Namen eingibst.</span>';
}
function addManualTag() {
  const inp = $('#f-tag', dlg);
  inp.value.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
    dlgState.removed = dlgState.removed.filter(r => r !== norm(t));
    if (!dlgState.manual.some(m => norm(m) === norm(t))) dlgState.manual.push(t);
  });
  inp.value = '';
  refreshTags();
}

function itemForm(it, placeId) {
  if (!places.size) { alert('Lege zuerst einen Ort an (z. B. einen Raum).'); location.hash = '#/orte'; return; }
  const isNew = !it;
  it = it || { kind: 'einzel', placeId, tags: [], photoIds: [] };
  const state = { type: 'item', id: it.id, manual: [...(it.tags || [])], removed: [...(it.tagsRemoved || [])], photoIds: [...(it.photoIds || [])], newPhotos: [] };
  openDialog(`<form id="form" autocomplete="off">
    <h1>${isNew ? 'Gegenstand einlagern' : 'Gegenstand bearbeiten'}</h1>
    <label class="f"><span>Was ist es?</span><input type="text" id="f-name" required value="${esc(it.name)}" placeholder="z. B. Sommerkleider oder Bohrmaschine Bosch"></label>
    <label class="f"><span>Art</span></label>
    <div class="seg"><label><input type="radio" name="kind" value="einzel" ${it.kind !== 'sammel' ? 'checked' : ''}>🔹 Einzelstück</label>
      <label><input type="radio" name="kind" value="sammel" ${it.kind === 'sammel' ? 'checked' : ''}>🧺 Sammlung / Gruppe</label></div>
    <label class="f"><span>Wo liegt es?</span><select id="f-place" required>${placeOptions(it.placeId)}</select></label>
    <label class="f"><span>Menge (optional)</span><input type="text" id="f-qty" inputmode="numeric" value="${esc(it.qty)}" placeholder="z. B. 4"></label>
    <label class="f"><span>Fotos</span></label>
    ${(dlgState = state, photoEditor())}
    <label class="btn filebtn">📷 Foto hinzufügen<input type="file" id="f-photo" accept="image/*" multiple></label>
    <label class="f"><span>Tags – ✨ automatisch erkannt, antippen zum Entfernen</span></label>
    <div class="chips" id="f-tags"></div>
    <input type="text" id="f-tag" placeholder="Eigenen Tag hinzufügen + Enter" enterkeyhint="done">
    <label class="f"><span>Notiz (optional)</span><textarea id="f-notes" rows="2" placeholder="z. B. Größe 38, von Oma">${esc(it.notes)}</textarea></label>
    <div class="btnrow end">
      <button type="button" class="btn" data-act="cancel">Abbrechen</button>
      ${isNew ? '<button type="submit" class="btn" data-next="1">Speichern & nächster</button>' : ''}
      <button type="submit" class="btn primary">Speichern</button></div>
  </form>`, state);
  refreshTags();
  $('#f-name', dlg).focus();
}

function placeForm(p, parentId, type) {
  const isNew = !p;
  p = p || { type: type || 'raum', parentId: parentId || null, photoIds: [] };
  const state = { type: 'place', id: p.id, photoIds: [...(p.photoIds || [])], newPhotos: [] };
  const excl = p.id ? descendants(p.id) : new Set();
  openDialog(`<form id="form" autocomplete="off">
    <h1>${isNew ? 'Ort anlegen' : 'Ort bearbeiten'}</h1>
    <label class="f"><span>Art</span><select id="f-type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}</select></label>
    <label class="f"><span>Name</span><input type="text" id="f-name" required value="${esc(p.name)}" placeholder="z. B. Keller, Kleiderschrank, Winterkiste"></label>
    <label class="f"><span>Befindet sich in</span><select id="f-parent">${placeOptions(p.parentId, excl, true)}</select></label>
    <label class="f"><span>Foto (optional)</span></label>
    ${(dlgState = state, photoEditor())}
    <label class="btn filebtn">📷 Foto hinzufügen<input type="file" id="f-photo" accept="image/*" multiple></label>
    <label class="f"><span>Notiz (optional)</span><textarea id="f-notes" rows="2">${esc(p.notes)}</textarea></label>
    <p class="muted small">Kartons bekommen automatisch einen kurzen Code (z. B. K-007) fürs Etikett.</p>
    <div class="btnrow end">
      <button type="button" class="btn" data-act="cancel">Abbrechen</button>
      <button type="submit" class="btn primary">Speichern</button></div>
  </form>`, state);
  $('#f-name', dlg).focus();
}

dlg.addEventListener('submit', async e => {
  e.preventDefault();
  const s = dlgState, name = $('#f-name', dlg).value.trim();
  if (!name) return;
  if (s.type === 'item') {
    if ($('#f-tag', dlg).value.trim()) addManualTag();
    const { auto, manual } = formTags();
    const old = items.get(s.id);
    const it = { ...(old || { id: uid(), createdAt: Date.now() }),
      name, kind: dlg.querySelector('[name=kind]:checked').value, placeId: $('#f-place', dlg).value,
      qty: $('#f-qty', dlg).value.trim(), notes: $('#f-notes', dlg).value.trim(),
      tags: [...auto, ...manual], tagsRemoved: s.removed, photoIds: s.photoIds };
    await saveItem(it);
    await closeDialog(false);
    if (e.submitter?.dataset.next) { route(); itemForm(null, it.placeId); }
    else if (location.hash === '#/item/' + it.id || location.hash.startsWith('#/ort/')) route();
    else location.hash = '#/item/' + it.id;
  } else {
    const old = places.get(s.id), type = $('#f-type', dlg).value;
    const p = { ...(old || { id: uid(), createdAt: Date.now() }),
      name, type, parentId: $('#f-parent', dlg).value || null, notes: $('#f-notes', dlg).value.trim(), photoIds: s.photoIds };
    if (type === 'karton' && !p.code) p.code = nextCode();
    await savePlace(p);
    await closeDialog(false);
    if (location.hash === '#/ort/' + p.id) route(); else location.hash = '#/ort/' + p.id;
  }
});

dlg.addEventListener('input', e => { if (dlgState?.type === 'item' && ['f-name', 'f-notes'].includes(e.target.id)) refreshTags(); });
dlg.addEventListener('keydown', e => {
  if (e.target.id === 'f-tag' && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); addManualTag(); }
});
dlg.addEventListener('change', async e => {
  if (e.target.id !== 'f-photo') return;
  for (const f of e.target.files) {
    try { const id = await addPhoto(f); dlgState.photoIds.push(id); dlgState.newPhotos.push(id); }
    catch { alert('Das Foto konnte nicht gelesen werden.'); }
  }
  e.target.value = '';
  refreshPhotos();
});

/* ---------- Sicherung ---------- */
const b64 = { enc: buf => { let s = ''; new Uint8Array(buf).forEach(b => s += String.fromCharCode(b)); return btoa(s); },
  dec: str => Uint8Array.from(atob(str), c => c.charCodeAt(0)) };
const blobToUrl = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
const urlToBlob = url => { const [head, data] = url.split(','); return new Blob([b64.dec(data)], { type: /:(.*?);/.exec(head)[1] }); };
async function keyFrom(pw, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function exportBackup() {
  const photos = [];
  for (const ph of await dbAll('photos')) photos.push({ id: ph.id, blob: await blobToUrl(ph.blob), thumb: await blobToUrl(ph.thumb) });
  let out = JSON.stringify({ app: 'woists', version: 1, exportedAt: new Date().toISOString(), places: [...places.values()], items: [...items.values()], photos });
  const pw = $('#pw').value;
  if (pw) {
    if (!crypto.subtle) return alert('Verschlüsselung ist nur über https verfügbar.');
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(pw, salt), new TextEncoder().encode(out));
    out = JSON.stringify({ app: 'woists', encrypted: true, salt: b64.enc(salt), iv: b64.enc(iv), data: b64.enc(data) });
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], { type: 'application/json' }));
  a.download = `wo-ists-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function importBackup(file) {
  try {
    let data = JSON.parse(await file.text());
    if (data.app !== 'woists') throw new Error('Keine Sicherungsdatei dieser App.');
    if (data.encrypted) {
      const pw = prompt('Passwort der Sicherung:');
      if (pw === null) return;
      try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(data.iv) }, await keyFrom(pw, b64.dec(data.salt)), b64.dec(data.data));
        data = JSON.parse(new TextDecoder().decode(plain));
      } catch { throw new Error('Falsches Passwort.'); }
    }
    if (!Array.isArray(data.places) || !Array.isArray(data.items)) throw new Error('Datei ist unvollständig.');
    if ((items.size || places.size) && !confirm(`Sicherung einspielen? Die aktuellen Daten (${items.size} Gegenstände) werden ersetzt.`)) return;
    for (const s of ['places', 'items', 'photos']) await dbClear(s);
    for (const p of data.places) await dbPut('places', p);
    for (const i of data.items) await dbPut('items', i);
    for (const ph of data.photos || []) await dbPut('photos', { id: ph.id, blob: urlToBlob(ph.blob), thumb: urlToBlob(ph.thumb) });
    urlCache.clear();
    await loadAll();
    alert(`Eingespielt: ${items.size} Gegenstände, ${places.size} Orte.`);
    route();
  } catch (err) { alert('Einspielen fehlgeschlagen: ' + err.message); }
}

async function loadDemo() {
  if (places.size && !confirm('Beispieldaten zusätzlich zu deinen Daten anlegen?')) return;
  const mk = async (name, type, parent) => {
    const p = { id: uid(), name, type, parentId: parent?.id || null, createdAt: Date.now(), photoIds: [] };
    if (type === 'karton') p.code = nextCode();
    await savePlace(p); return p;
  };
  const put = (name, place, kind = 'einzel', extra = {}) =>
    saveItem({ id: uid(), createdAt: Date.now() - Math.random() * 1e9, name, kind, placeId: place.id, tags: suggestTags(name), photoIds: [], ...extra });
  const keller = await mk('Keller', 'raum'), regal = await mk('Metallregal links', 'moebel', keller);
  const k1 = await mk('Weihnachten', 'karton', regal), k2 = await mk('Camping', 'karton', regal);
  const schlaf = await mk('Schlafzimmer', 'raum'), schrank = await mk('Kleiderschrank', 'moebel', schlaf);
  const fach = await mk('Oberstes Fach', 'fach', schrank), k3 = await mk('Sommersachen', 'karton', fach);
  const dach = await mk('Dachboden', 'raum'), k4 = await mk('Babysachen', 'karton', dach);
  await put('Christbaumkugeln rot/gold', k1, 'sammel'); await put('Lichterkette 10 m', k1); await put('Adventskranz', k1);
  await put('Zelt 3 Personen', k2); await put('Schlafsäcke', k2, 'sammel', { qty: '2' }); await put('Gaskocher', k2);
  await put('Sommerkleider', k3, 'sammel'); await put('Badehosen & Bikinis', k3, 'sammel'); await put('Sandalen', k3, 'sammel', { qty: '3' });
  await put('Parka dunkelblau', fach); await put('Skihelm', regal); await put('Bohrmaschine Bosch', regal, 'einzel', { notes: 'inkl. Bohrer-Set im Koffer' });
  await put('Strampler Gr. 62–68', k4, 'sammel'); await put('Lego Duplo Kiste', dach, 'sammel'); await put('Winterreifen', keller, 'sammel', { qty: '4' });
  location.hash = '#/'; route();
}

/* ---------- Aktionen ---------- */
const actions = {
  'add-item': el => itemForm(null, el.dataset.place || (location.hash.startsWith('#/ort/') ? location.hash.split('/')[2] : undefined)),
  'edit-item': el => itemForm(items.get(el.dataset.id)),
  'add-place': el => placeForm(null, el.dataset.parent, el.dataset.type),
  'edit-place': el => placeForm(places.get(el.dataset.id)),
  cancel: () => closeDialog(true),
  'rm-photo': el => { dlgState.photoIds = dlgState.photoIds.filter(id => id !== el.dataset.id); refreshPhotos(); },
  'rm-tag': el => {
    const t = el.dataset.tag;
    if (el.dataset.auto) dlgState.removed.push(norm(t));
    dlgState.manual = dlgState.manual.filter(m => norm(m) !== norm(t));
    refreshTags();
  },
  zoom: async el => { const lb = $('#lightbox'); $('img', lb).src = el.src; lb.showModal(); },
  'tag-search': el => { lastQuery = el.dataset.tag; },
  'toggle-out': async el => { const it = items.get(el.dataset.id); it.out = !it.out; await saveItem(it); route(); },
  'del-item': async el => {
    const it = items.get(el.dataset.id);
    if (!confirm(`„${it.name}“ wirklich löschen?`)) return;
    for (const id of it.photoIds || []) await dbDel('photos', id);
    items.delete(it.id); await dbDel('items', it.id);
    location.hash = it.placeId ? '#/ort/' + it.placeId : '#/';
  },
  'del-place': async el => {
    const p = places.get(el.dataset.id);
    if (childrenOf(p.id).length || itemsIn(p.id).length) return alert('Dieser Ort ist nicht leer. Bitte erst den Inhalt umlagern oder löschen.');
    if (!confirm(`Ort „${p.name}“ löschen?`)) return;
    for (const id of p.photoIds || []) await dbDel('photos', id);
    places.delete(p.id); await dbDel('places', p.id);
    location.hash = p.parentId ? '#/ort/' + p.parentId : '#/orte';
  },
  print: () => window.print(),
  export: () => exportBackup(),
  demo: () => loadDemo(),
  wipe: async () => {
    if (!confirm('Wirklich ALLE Orte, Gegenstände und Fotos auf diesem Gerät löschen?')) return;
    for (const s of ['places', 'items', 'photos']) await dbClear(s);
    urlCache.clear(); await loadAll(); route();
  },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
});
document.addEventListener('input', e => { if (e.target.id === 'q') { lastQuery = e.target.value; renderResults(); } });
document.addEventListener('change', e => { if (e.target.id === 'importfile' && e.target.files[0]) { importBackup(e.target.files[0]); e.target.value = ''; } });
$('#lightbox').addEventListener('click', () => $('#lightbox').close());
window.addEventListener('hashchange', route);

(async function start() {
  db = await openDb();
  await loadAll();
  route();
  navigator.storage?.persist?.();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
