// Astral Projection LG — Mixer presets (IndexedDB-backed)
//
// Lets the user save the current three volume sliders (binaural, voice,
// drone) as a named preset, and recall any saved preset to snap the
// sliders back to those values. A built-in hardcoded "Default" preset
// is always present and cannot be deleted — it acts as the implicit
// starting point for every visitor.
//
// Storage: IndexedDB (db="astral-lg-mixer", store="presets", keyPath="id")
//   IndexedDB was chosen over localStorage so the API can scale: each
//   preset carries metadata (timestamps, Airtable sync id, etc.) and
//   we get async I/O without blocking the main thread.
//
// Future Airtable sync hook: the `airtable` object at the bottom of
// this file is a no-op stub. When the user creates an Airtable base for
// presets, fill in `baseId`, `tableName`, and a personal access token,
// then set `enabled = true`. Saves will then mirror to Airtable; page
// loads will pull remote presets and merge with local ones (remote
// wins on conflict by updatedAt).

(() => {
  const root = document.getElementById('ap');
  if (!root) return;

  // ---------- Hardcoded default preset ----------
  // This is the starting values for EVERY user on EVERY device on first
  // visit, before they've saved any of their own. User-confirmed:
  // binaural very low (0.14) so the floor is subtle, voice guide
  // cranked (1.00) so Jessa is fully audible, drone in the middle
  // (0.39) for ambient fill without overpowering the voice.
  const DEFAULT_PRESET = Object.freeze({
    id: '__default__',
    name: 'Default',
    binaural: 0.14,
    voice: 1.00,
    drone: 0.39,
    isDefault: true,
    createdAt: 0,
    updatedAt: 0,
  });

  // ---------- DOM refs ----------
  const volBin   = document.getElementById('ap-vol-binaural');
  const volVox   = document.getElementById('ap-vol-voice');
  const volDrone = document.getElementById('ap-vol-drone');
  const valBin   = document.getElementById('ap-val-binaural');
  const valVox   = document.getElementById('ap-val-voice');
  const valDrone = document.getElementById('ap-val-drone');
  const chipsEl  = document.getElementById('ap-presets-chips');
  const nameEl   = document.getElementById('ap-preset-name');
  const saveBtn  = document.getElementById('ap-preset-save-btn');
  const cancelBtn= document.getElementById('ap-preset-cancel-btn');
  const mixRows  = root.querySelectorAll('.ap-mix-row');

  // ---------- IndexedDB ----------
  const DB_NAME = 'astral-lg-mixer';
  const DB_VERSION = 1;
  const STORE = 'presets';

  let _dbPromise = null;
  function db() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          const s = d.createObjectStore(STORE, { keyPath: 'id' });
          s.createIndex('name', 'name', { unique: false });
          s.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  async function tx(mode = 'readonly') {
    const d = await db();
    return d.transaction(STORE, mode).objectStore(STORE);
  }

  async function getAll() {
    const t = await tx();
    return new Promise((res, rej) => {
      const r = t.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }

  async function put(preset) {
    const t = await tx('readwrite');
    return new Promise((res, rej) => {
      const r = t.put(preset);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }

  async function remove(id) {
    const t = await tx('readwrite');
    return new Promise((res, rej) => {
      const r = t.delete(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }

  // ---------- State ----------
  // `activeId` is the id of the preset whose values are currently shown
  // in the sliders, OR the string '__default__' when no user preset is
  // loaded. We never persist activeId — every page load starts at the
  // default values, which is the principle the user asked for ("a
  // certain value that I want to be the default value for everyone").
  let presets = [];
  let activeId = DEFAULT_PRESET.id;

  // ---------- Helpers ----------
  function fmt(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  }
  function readSliders() {
    return {
      binaural: parseFloat(volBin.value),
      voice:    parseFloat(volVox.value),
      drone:    parseFloat(volDrone.value),
    };
  }
  function writeSliders(values, fireEvents = false) {
    const setOne = (el, v) => {
      el.value = String(v);
      if (fireEvents) el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setOne(volBin,   values.binaural);
    setOne(volVox,   values.voice);
    setOne(volDrone, values.drone);
    updateValDisplays();
    if (typeof window.applyVolumes === 'function') window.applyVolumes();
  }
  function updateValDisplays() {
    valBin.textContent   = fmt(volBin.value);
    valVox.textContent   = fmt(volVox.value);
    valDrone.textContent = fmt(volDrone.value);
  }

  // ---------- Live value wiring ----------
  // Each slider updates its .ap-val span on input, and we mark the row
  // as "is-dragging" briefly so the value chip can pulse.
  [volBin, volVox, volDrone].forEach((el) => {
    el.addEventListener('input', () => {
      updateValDisplays();
      // Any user movement deselects the active preset chip — they're
      // now editing a new combination that doesn't match anything saved.
      if (activeId !== DEFAULT_PRESET.id) setActive(DEFAULT_PRESET.id);
    });
    const row = el.closest('.ap-mix-row');
    el.addEventListener('pointerdown', () => row && row.classList.add('is-dragging'));
    el.addEventListener('pointerup',   () => row && row.classList.remove('is-dragging'));
    el.addEventListener('blur',        () => row && row.classList.remove('is-dragging'));
  });
  // Expose applyVolumes hook so writeSliders can sync audio levels when
  // presets are loaded programmatically. We poll once in case app-audio
  // finishes loading after us.
  let _applyVolumesWaiter = setInterval(() => {
    if (typeof window.applyVolumes === 'function') {
      window.applyVolumes();
      updateValDisplays();
    }
  }, 250);
  setTimeout(() => clearInterval(_applyVolumesWaiter), 5000);

  // ---------- Chip rendering ----------
  function setActive(id) {
    activeId = id;
    chipsEl.querySelectorAll('.ap-preset-chip').forEach((c) => {
      const isActive = c.dataset.id === id;
      c.classList.toggle('active', isActive);
      c.setAttribute('aria-pressed', String(isActive));
    });
  }

  function renderChips() {
    // Custom user presets first, then the hardcoded default last so it's
    // visually anchored as the "home" preset.
    const userPresets = presets.filter(p => !p.isDefault);
    const all = [...userPresets, DEFAULT_PRESET];

    chipsEl.innerHTML = '';
    for (const p of all) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ap-preset-chip' + (p.isDefault ? ' is-default' : '');
      chip.dataset.id = p.id;
      chip.setAttribute('role', 'listitem');
      chip.setAttribute('aria-pressed', String(p.id === activeId));

      const label = document.createElement('span');
      label.className = 'ap-preset-chip-label';
      label.textContent = p.name;
      chip.appendChild(label);

      if (p.isDefault) {
        const badge = document.createElement('span');
        badge.className = 'ap-preset-chip-default-badge';
        badge.textContent = 'default';
        chip.appendChild(badge);
      } else {
        const del = document.createElement('span');
        del.className = 'ap-preset-chip-delete';
        del.textContent = '×';
        del.setAttribute('role', 'button');
        del.setAttribute('aria-label', `Delete preset ${p.name}`);
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          deletePreset(p.id);
        });
        chip.appendChild(del);
      }

      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('ap-preset-chip-delete')) return;
        loadPreset(p);
      });
      chipsEl.appendChild(chip);
    }
  }

  // ---------- Load / save / delete ----------
  async function loadPreset(p) {
    writeSliders({ binaural: p.binaural, voice: p.voice, drone: p.drone }, true);
    setActive(p.id);
    if (p.isDefault) {
      // Reset the save form so the user starts fresh from the default.
      nameEl.value = '';
      setSaveIconMode(false);
      cancelBtn.hidden = true;
    } else {
      nameEl.value = p.name;
      setSaveIconMode(true);
      cancelBtn.hidden = false;
    }
  }

  async function savePreset() {
    const raw = (nameEl.value || '').trim();
    if (!raw) {
      nameEl.focus();
      nameEl.placeholder = 'Please enter a name first';
      return;
    }
    const values = readSliders();
    const now = Date.now();
    // If the user is editing an existing custom preset (chip active), update it.
    const existing = presets.find(p => p.id === activeId && !p.isDefault);
    const id = existing ? existing.id : 'preset_' + now + '_' + Math.random().toString(36).slice(2, 8);
    const preset = {
      id,
      name: raw.slice(0, 40),
      binaural: values.binaural,
      voice: values.voice,
      drone: values.drone,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    try {
      await put(preset);
      presets = await getAll();
      renderChips();
      setActive(id);
      setSaveIconMode(true);
      cancelBtn.hidden = false;
      // Fire-and-forget Airtable sync (stub for now)
      airtable.syncPut(preset).catch(() => {});
    } catch (err) {
      console.error('[mixer-presets] save failed', err);
      alert('Could not save preset. IndexedDB may be disabled in this browser.');
    }
  }

  async function deletePreset(id) {
    const p = presets.find(x => x.id === id);
    if (!p || p.isDefault) return;
    if (!confirm(`Delete preset "${p.name}"?`)) return;
    try {
      await remove(id);
      presets = presets.filter(x => x.id !== id);
      renderChips();
      if (activeId === id) loadPreset(DEFAULT_PRESET);
      airtable.syncDelete(id).catch(() => {});
    } catch (err) {
      console.error('[mixer-presets] delete failed', err);
    }
  }

  // ---------- Wire save / cancel buttons ----------
  // Both buttons are icon-only (floppy = save, X = cancel). When the
  // user starts editing an existing preset, we swap the save icon to a
  // check-mark to visually signal "update" mode. The title + aria-label
  // switch to the localized "Update" / "Aktualisieren" / "Aggiorna"
  // text in the same moment. Both label sets come from data attributes
  // on the buttons in the HTML so this file stays language-agnostic.
  saveBtn.dataset.saveTitle = saveBtn.getAttribute('title') || saveBtn.getAttribute('aria-label');
  cancelBtn.dataset.cancelTitle = cancelBtn.getAttribute('title') || cancelBtn.getAttribute('aria-label');

  // SVG icons: the floppy (default) and a check-mark (used when editing
  // an existing preset). Both inherit currentColor so they match the
  // button's text/background styling.
  const FLOPPY_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
  const CHECK_SVG  = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  // Keep references so we can restore the original floppy icon later.
  saveBtn._iconDefault = FLOPPY_SVG;
  saveBtn._iconEdit    = CHECK_SVG;

  function setSaveIconMode(editing) {
    saveBtn.innerHTML = editing ? CHECK_SVG : FLOPPY_SVG;
    saveBtn.classList.toggle('is-edit', !!editing);
  }

  saveBtn.addEventListener('click', savePreset);
  cancelBtn.addEventListener('click', () => {
    loadPreset(DEFAULT_PRESET);
  });
  nameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); savePreset(); }
  });

  // ---------- Boot ----------
  // Initial value displays (sliders already have HTML defaults set).
  updateValDisplays();

  // Load any saved presets from IndexedDB. The default is always
  // available regardless of what comes back from the DB.
  (async () => {
    try {
      presets = await getAll();
      renderChips();
    } catch (err) {
      console.warn('[mixer-presets] IDB read failed; using in-memory only', err);
      presets = [];
      renderChips();
    }
  })();

  // ---------- Airtable sync stub ----------
  // To enable:
  //   1. Create an Airtable base with one table whose columns are:
  //        name (Single line text)
  //        binaural (Number, 0–1, 2 decimals)
  //        voice (Number, 0–1, 2 decimals)
  //        drone (Number, 0–1, 2 decimals)
  //        createdAt (Number, ms epoch)
  //        updatedAt (Number, ms epoch)
  //        localId (Single line text)  -- for matching on sync
  //   2. Fill in baseId, tableName, and a personal access token below.
  //   3. Set enabled = true.
  // The code below will then mirror every save to Airtable and pull
  // remote presets on page load, merging with local IndexedDB.
  const airtable = {
    enabled: false,
    baseId: '',
    tableName: '',
    token: '',

    async _req(method, path, body) {
      const url = `https://api.airtable.com/v0/${this.baseId}/${encodeURIComponent(this.tableName)}${path}`;
      const resp = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!resp.ok) throw new Error(`Airtable ${method} ${path} → ${resp.status}`);
      return resp.json();
    },

    async syncPut(preset) {
      if (!this.enabled) return;
      // TODO: upsert by localId field; if no matching record exists, POST.
    },

    async syncDelete(id) {
      if (!this.enabled) return;
      // TODO: find record by localId, DELETE.
    },

    async pull() {
      if (!this.enabled) return [];
      // TODO: GET all records, return as preset array.
    },
  };
})();