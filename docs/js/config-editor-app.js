'use strict';

let cfg = null;

const INPUT_TYPES = [
  { id: 'si_no', label: 'Sì/No', hint: 'Checklist sì/no. Score tipico: count_value.' },
  { id: 'si_no_na', label: 'Sì/No/N/A', hint: 'Checklist con N/A. Score tipico: count_value_with_override.' },
  { id: 'scelta_unica', label: 'Scelta unica', hint: 'Opzioni esclusive con valore numerico. Score: selected_value.' },
  { id: 'campi_numerici', label: 'Campi numerici', hint: 'N input number. Score: linear_combination o sum_fields.' },
  { id: 'vitalita', label: 'Vitalità', hint: 'Metriche repository. Score: vitalita (pesi in score.weights).' },
  { id: 'tco', label: 'TCO (sola lettura)', hint: 'Step TCO separato. Score: sum_tco.', readOnly: true },
  { id: 'requisiti_percent', label: 'Requisiti % (sola lettura)', hint: 'Aggregato da step Requisiti. Score: weighted_average_percent.', readOnly: true },
];

const SCORE_METHODS = [
  { id: 'count_value', label: 'Conta valore (es. sì)' },
  { id: 'count_value_with_override', label: 'Conta valore + override (N/A)' },
  { id: 'selected_value', label: 'Valore scelta unica' },
  { id: 'linear_combination', label: 'Combinazione lineare campi' },
  { id: 'sum_fields', label: 'Somma campi' },
  { id: 'vitalita', label: 'Formula vitalità' },
  { id: 'sum_tco', label: 'Somma TCO' },
  { id: 'weighted_average_percent', label: 'Media pesata % requisiti' },
];

const TYPE_HINT = Object.fromEntries(INPUT_TYPES.map(t => [t.id, t.hint]));

function showStatus(msg, type) {
  document.getElementById('status').innerHTML = msg
    ? `<div class="alert alert-${type || 'info'} py-2 small mb-0">${msg}</div>` : '';
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function slugId(s) {
  return String(s || '').trim().replace(/\s+/g, '_').replace(/[^\w]/g, '_');
}

function defaultInputForType(type) {
  if (type === 'si_no' || type === 'si_no_na') {
    return { type, items: [{ id: 'v1', testo: 'Nuova voce', obbligatorio: false }] };
  }
  if (type === 'scelta_unica') {
    return {
      type,
      items: [
        { id: 'r0', testo: 'Opzione bassa', valore: 0 },
        { id: 'r1', testo: 'Opzione media', valore: 1 },
        { id: 'r2', testo: 'Opzione alta', valore: 2 },
      ],
    };
  }
  if (type === 'campi_numerici') {
    return { type, fields: [{ id: 'campo1', label: 'Campo 1' }] };
  }
  if (type === 'vitalita') {
    return {
      type,
      fields: [
        { id: 'giorni', label: "Giorni dall'ultimo commit" },
        { id: 'commit', label: 'Commit (3 anni)' },
        { id: 'contributi', label: 'Contributori (3 anni)' },
        { id: 'release', label: 'Release (3 anni)' },
      ],
    };
  }
  if (type === 'tco') return { type: 'tco' };
  if (type === 'requisiti_percent') return { type: 'requisiti_percent' };
  return { type: 'si_no', items: [{ id: 'v1', testo: 'Nuova voce', obbligatorio: false }] };
}

function defaultScoreForType(type) {
  switch (type) {
    case 'si_no': return { method: 'count_value', value: 'si' };
    case 'si_no_na': return { method: 'count_value_with_override', value: 'si', if_any: { value: 'na', then: 3 } };
    case 'scelta_unica': return { method: 'selected_value' };
    case 'campi_numerici': return { method: 'sum_fields' };
    case 'vitalita': return {
      method: 'vitalita', requires_nonzero: 'commit', giorni_soglia: 365,
      weights: { commit: 0.4, contributi: 0.15, release: 0.15, giorni_bonus: 0.3 },
    };
    case 'tco': return { method: 'sum_tco' };
    case 'requisiti_percent': return { method: 'weighted_average_percent', weight_field: 'peso' };
    default: return { method: 'count_value', value: 'si' };
  }
}

function defaultDirectionForType(type) {
  return type === 'tco' || (type === 'campi_numerici') ? 'cost' : 'benefit';
}

function ensurePresetKeys(criterionId, defVal = 0) {
  Object.keys(cfg.pesi_preset || {}).forEach(cat => {
    if (!cfg.pesi_preset[cat]) cfg.pesi_preset[cat] = {};
    if (cfg.pesi_preset[cat][criterionId] === undefined) cfg.pesi_preset[cat][criterionId] = defVal;
  });
}

function removePresetKey(criterionId) {
  Object.keys(cfg.pesi_preset || {}).forEach(cat => {
    if (cfg.pesi_preset[cat]) delete cfg.pesi_preset[cat][criterionId];
  });
}

function renamePresetKey(oldId, newId) {
  Object.keys(cfg.pesi_preset || {}).forEach(cat => {
    const p = cfg.pesi_preset[cat];
    if (p && p[oldId] !== undefined) {
      p[newId] = p[oldId];
      delete p[oldId];
    }
  });
}

function renameFieldHelpPrefix(oldPrefix, newPrefix) {
  if (!cfg.field_help) return;
  Object.keys(cfg.field_help).forEach(k => {
    if (k === oldPrefix || k.startsWith(oldPrefix + '.')) {
      cfg.field_help[newPrefix + k.slice(oldPrefix.length)] = cfg.field_help[k];
      delete cfg.field_help[k];
    }
  });
}

function renderInputTypeOptions(selected, readOnly) {
  return INPUT_TYPES.filter(t => !readOnly || t.readOnly).map(t =>
    `<option value="${t.id}"${t.id === selected ? ' selected' : ''}>${esc(t.label)}</option>`
  ).join('');
}

function renderScoreMethodOptions(selected) {
  return SCORE_METHODS.map(m =>
    `<option value="${m.id}"${m.id === selected ? ' selected' : ''}>${esc(m.label)}</option>`
  ).join('');
}

function renderScoreEditor(c, idx) {
  const s = c.score || {};
  const method = s.method || '';
  let extra = '';
  if (method === 'count_value' || method === 'count_value_with_override') {
    extra += `<div class="col-md-3"><label class="form-label small mb-0">Valore da contare</label>
      <input class="form-control form-control-sm" data-cri="${idx}" data-score-k="value" value="${esc(s.value || 'si')}" /></div>`;
  }
  if (method === 'count_value_with_override') {
    extra += `<div class="col-md-3"><label class="form-label small mb-0">Override se valore</label>
      <input class="form-control form-control-sm" data-cri="${idx}" data-score-k="if_any.value" value="${esc(s.if_any?.value || 'na')}" /></div>
      <div class="col-md-3"><label class="form-label small mb-0">Punteggio override</label>
      <input type="number" class="form-control form-control-sm" data-cri="${idx}" data-score-k="if_any.then" value="${s.if_any?.then ?? 3}" /></div>`;
  }
  if (method === 'linear_combination') {
    const terms = s.terms || [];
    extra += `<div class="col-12"><label class="form-label small mb-0">Termini (campo × fattore, JSON)</label>
      <textarea class="form-control form-control-sm font-monospace" rows="2" data-cri="${idx}" data-score-k="terms-json">${esc(JSON.stringify(terms))}</textarea></div>`;
  }
  if (method === 'vitalita') {
    extra += `<div class="col-md-3"><label class="form-label small mb-0">Campo obbligatorio ≠ 0</label>
      <input class="form-control form-control-sm" data-cri="${idx}" data-score-k="requires_nonzero" value="${esc(s.requires_nonzero || 'commit')}" /></div>
      <div class="col-md-3"><label class="form-label small mb-0">Soglia giorni</label>
      <input type="number" class="form-control form-control-sm" data-cri="${idx}" data-score-k="giorni_soglia" value="${s.giorni_soglia ?? 365}" /></div>
      <div class="col-12"><label class="form-label small mb-0">Pesi (JSON)</label>
      <textarea class="form-control form-control-sm font-monospace" rows="2" data-cri="${idx}" data-score-k="weights-json">${esc(JSON.stringify(s.weights || {}))}</textarea></div>`;
  }
  if (method === 'weighted_average_percent') {
    extra += `<div class="col-md-4"><label class="form-label small mb-0">Campo peso requisito</label>
      <input class="form-control form-control-sm" data-cri="${idx}" data-score-k="weight_field" value="${esc(s.weight_field || 'peso')}" /></div>`;
  }
  return `<div class="score-editor mt-2 p-2 bg-light rounded">
    <span class="field-label">Score</span>
    <div class="row g-2 align-items-end">
      <div class="col-md-4">
        <label class="form-label small mb-0">Metodo</label>
        <select class="form-select form-select-sm" data-cri="${idx}" data-score-k="method">${renderScoreMethodOptions(method)}</select>
      </div>
      ${extra}
    </div>
  </div>`;
}

function renderCriteriItems(c, idx) {
  const type = c.input?.type;
  if (type === 'tco' || type === 'requisiti_percent') {
    return '<p class="cri-empty-msg mb-0">Nessuna voce — gestito in step dedicato del wizard.</p>';
  }
  if (type === 'campi_numerici') {
    const rows = (c.input.fields || []).map((f, j) => `
      <tr>
        <td class="col-id"><input class="form-control form-control-sm font-monospace" data-cri="${idx}" data-field data-j="${j}" data-k="id" value="${esc(f.id)}" /></td>
        <td><input class="form-control form-control-sm" data-cri="${idx}" data-field data-j="${j}" data-k="label" value="${esc(f.label)}" /></td>
        <td class="col-act"><button type="button" class="btn btn-outline-danger btn-sm py-0 px-2" data-action="del-field" data-idx="${idx}" data-j="${j}">Elimina</button></td>
      </tr>`).join('');
    return `<table class="cri-items-table"><thead><tr><th class="col-id">ID</th><th>Etichetta</th><th class="col-act"></th></tr></thead><tbody>${rows}</tbody></table>
      <button type="button" class="btn btn-outline-secondary btn-sm" data-action="add-field" data-idx="${idx}">+ Campo</button>`;
  }
  if (type === 'vitalita') {
    const rows = (c.input.fields || []).map((f, j) => `
      <tr>
        <td class="col-id"><input class="form-control form-control-sm font-monospace" data-cri="${idx}" data-field data-j="${j}" data-k="id" value="${esc(f.id)}" /></td>
        <td><input class="form-control form-control-sm" data-cri="${idx}" data-field data-j="${j}" data-k="label" value="${esc(f.label)}" /></td>
        <td class="col-act"><button type="button" class="btn btn-outline-danger btn-sm py-0 px-2" data-action="del-field" data-idx="${idx}" data-j="${j}">Elimina</button></td>
      </tr>`).join('');
    return `<table class="cri-items-table"><thead><tr><th class="col-id">ID</th><th>Etichetta</th><th class="col-act"></th></tr></thead><tbody>${rows}</tbody></table>
      <p class="small text-muted mb-1">I pesi della formula sono in <code>score.weights</code>, non nei campi input.</p>
      <button type="button" class="btn btn-outline-secondary btn-sm" data-action="add-field" data-idx="${idx}">+ Campo</button>`;
  }
  const isRadio = type === 'scelta_unica';
  const showObbl = type === 'si_no' || type === 'si_no_na';
  const rows = (c.input?.items || []).map((item, j) => `
    <tr>
      <td class="col-id"><input class="form-control form-control-sm font-monospace" data-cri="${idx}" data-item data-j="${j}" data-k="id" value="${esc(item.id)}" /></td>
      <td><input class="form-control form-control-sm" data-cri="${idx}" data-item data-j="${j}" data-k="testo" value="${esc(item.testo || '')}" /></td>
      ${isRadio ? `<td class="col-val"><input type="number" class="form-control form-control-sm" data-cri="${idx}" data-item data-j="${j}" data-k="valore" value="${item.valore ?? 0}" /></td>` : ''}
      ${showObbl ? `<td class="col-obbl"><input type="checkbox" class="form-check-input" data-cri="${idx}" data-item data-j="${j}" data-k="obbligatorio" ${item.obbligatorio ? 'checked' : ''} /></td>` : ''}
      <td class="col-act"><button type="button" class="btn btn-outline-danger btn-sm py-0 px-2" data-action="del-item" data-idx="${idx}" data-j="${j}">Elimina</button></td>
    </tr>`).join('');
  const head = isRadio
    ? '<th class="col-id">ID</th><th>Testo</th><th class="col-val">Val.</th><th class="col-act"></th>'
    : showObbl
      ? '<th class="col-id">ID</th><th>Testo</th><th class="col-obbl">Obbl.</th><th class="col-act"></th>'
      : '<th class="col-id">ID</th><th>Testo</th><th class="col-act"></th>';
  return `<table class="cri-items-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
    <button type="button" class="btn btn-outline-secondary btn-sm" data-action="add-item" data-idx="${idx}">+ Voce</button>`;
}

function renderCriteri() {
  const root = document.getElementById('criteri-editor');
  const list = cfg.criteri || [];
  root.innerHTML = list.map((c, idx) => {
    const type = c.input?.type || 'si_no';
    const readOnly = INPUT_TYPES.find(t => t.id === type)?.readOnly;
    return `<article class="cri-group-card" data-cri-idx="${idx}">
      <div class="cri-group-head">
        <div><span class="field-label">ID</span>
          <input class="form-control form-control-sm font-monospace" data-cri="${idx}" data-k="id" value="${esc(c.id)}" ${readOnly ? 'readonly' : ''} /></div>
        <div><span class="field-label">Etichetta</span>
          <input class="form-control form-control-sm" data-cri="${idx}" data-k="label" value="${esc(c.label)}" /></div>
        <div><span class="field-label">Input type</span>
          <select class="form-select form-select-sm" data-cri="${idx}" data-k="input.type" ${readOnly ? 'disabled' : ''}>${renderInputTypeOptions(type, false)}</select>
          <div class="tipo-hint">${esc(TYPE_HINT[type] || '')}</div></div>
        <div class="cri-group-actions">
          <div class="form-check mb-0">
            <input type="checkbox" class="form-check-input" data-cri="${idx}" data-k="obbligatorio" ${c.obbligatorio ? 'checked' : ''} id="grp-obb-${idx}" />
            <label class="form-check-label small" for="grp-obb-${idx}">Obbligatorio</label>
          </div>
          ${readOnly ? '' : `<button type="button" class="btn btn-outline-danger btn-sm" data-action="del-group" data-idx="${idx}">Elimina</button>`}
        </div>
      </div>
      <div class="cri-group-body">
        ${renderCriteriItems(c, idx)}
        ${renderScoreEditor(c, idx)}
      </div>
    </article>`;
  }).join('') || '<p class="text-muted small">Nessun criterio.</p>';
}

function syncScoreFromForm(c, idx) {
  document.querySelectorAll(`[data-cri="${idx}"][data-score-k]`).forEach(el => {
    const k = el.dataset.scoreK;
    if (k === 'method') c.score.method = el.value;
    else if (k === 'value') c.score.value = el.value;
    else if (k === 'if_any.value') {
      c.score.if_any = c.score.if_any || {};
      c.score.if_any.value = el.value;
    } else if (k === 'if_any.then') {
      c.score.if_any = c.score.if_any || {};
      c.score.if_any.then = +el.value || 0;
    } else if (k === 'requires_nonzero') c.score.requires_nonzero = el.value;
    else if (k === 'giorni_soglia') c.score.giorni_soglia = +el.value || 365;
    else if (k === 'weight_field') c.score.weight_field = el.value;
    else if (k === 'terms-json') {
      try { c.score.terms = JSON.parse(el.value || '[]'); } catch {}
    } else if (k === 'weights-json') {
      try { c.score.weights = JSON.parse(el.value || '{}'); } catch {}
    }
  });
}

function syncCriteriFromForm() {
  if (!cfg?.criteri) return;
  let needsRerender = false;

  cfg.criteri.forEach((c, idx) => {
    const idInp = document.querySelector(`[data-cri="${idx}"][data-k="id"]`);
    if (idInp && !idInp.readOnly) {
      const newId = slugId(idInp.value);
      if (newId && newId !== c.id) {
        if (cfg.criteri.some((x, i) => i !== idx && x.id === newId)) throw new Error(`ID duplicato: ${newId}`);
        renameFieldHelpPrefix(`criteri.${c.id}`, `criteri.${newId}`);
        renamePresetKey(c.id, newId);
        c.id = newId;
        needsRerender = true;
      }
    }
    const labelInp = document.querySelector(`[data-cri="${idx}"][data-k="label"]`);
    if (labelInp) c.label = labelInp.value;
    const obbInp = document.querySelector(`[data-cri="${idx}"][data-k="obbligatorio"]`);
    if (obbInp) c.obbligatorio = obbInp.checked;

    const typeEl = document.querySelector(`[data-cri="${idx}"][data-k="input.type"]`);
    if (typeEl && !typeEl.disabled && typeEl.value !== c.input?.type) {
      const label = c.label;
      const obb = c.obbligatorio;
      const peso = c.peso_default;
      const dir = c.direction;
      c.input = defaultInputForType(typeEl.value);
      c.score = defaultScoreForType(typeEl.value);
      c.label = label;
      c.obbligatorio = obb;
      c.peso_default = peso;
      c.direction = dir || defaultDirectionForType(typeEl.value);
      needsRerender = true;
      return;
    }

    document.querySelectorAll(`[data-cri="${idx}"][data-item]`).forEach(el => {
      const j = +el.dataset.j;
      const k = el.dataset.k;
      if (!c.input.items?.[j]) return;
      if (k === 'obbligatorio') c.input.items[j][k] = el.checked;
      else if (k === 'valore') c.input.items[j][k] = +el.value || 0;
      else c.input.items[j][k] = el.value;
    });

    document.querySelectorAll(`[data-cri="${idx}"][data-field]`).forEach(el => {
      const j = +el.dataset.j;
      const k = el.dataset.k;
      if (!c.input.fields?.[j]) return;
      c.input.fields[j][k] = el.value;
    });

    syncScoreFromForm(c, idx);
  });

  if (needsRerender) renderCriteri();
}

function syncFromForm() {
  if (!cfg) return;
  cfg.versione = document.getElementById('f-versione').value.trim();
  cfg.id = document.getElementById('f-id').value.trim();
  cfg.descrizione = document.getElementById('f-descrizione').value.trim();
  syncCriteriFromForm();
  syncPesiFromForm();
  syncPresetFromForm();
  syncJsonEditor();
}

function syncToForm() {
  document.getElementById('f-versione').value = cfg.versione || '';
  document.getElementById('f-id').value = cfg.id || '';
  document.getElementById('f-descrizione').value = cfg.descrizione || '';
  renderPesi();
  renderPreset();
  renderCriteri();
  renderTco();
  renderHelp();
  renderLinks();
  syncJsonEditor();
}

function syncJsonEditor() {
  document.getElementById('json-editor').value = JSON.stringify(cfg, null, 2);
}

function renderPesi() {
  document.getElementById('pesi-tbody').innerHTML = (cfg.criteri || []).map((c, i) => `
    <tr>
      <td><code>${esc(c.id)}</code></td>
      <td><input class="form-control form-control-sm" data-pesi="${i}" data-k="label" value="${esc(c.label)}" /></td>
      <td><input type="number" step="0.05" class="form-control form-control-sm" style="width:80px" data-pesi="${i}" data-k="peso_default" value="${c.peso_default ?? 0}" /></td>
      <td><select class="form-select form-select-sm" style="width:100px" data-pesi="${i}" data-k="direction">
        <option value="benefit"${c.direction === 'benefit' ? ' selected' : ''}>benefit</option>
        <option value="cost"${c.direction === 'cost' ? ' selected' : ''}>cost</option>
      </select></td>
      <td><input class="form-control form-control-sm" data-pesi="${i}" data-k="note" value="${esc(c.note || '')}" /></td>
      <td><input type="checkbox" data-pesi="${i}" data-k="fixed" ${c.fixed ? 'checked' : ''} /></td>
    </tr>`).join('');
}

function syncPesiFromForm() {
  document.querySelectorAll('#pesi-tbody [data-pesi]').forEach(el => {
    const i = +el.dataset.pesi;
    const k = el.dataset.k;
    const c = cfg.criteri[i];
    if (!c) return;
    if (k === 'fixed') c.fixed = el.checked;
    else if (k === 'peso_default') c.peso_default = +el.value || 0;
    else if (k === 'direction') c.direction = el.value;
    else c[k] = el.value;
  });
}

function renderPreset() {
  const root = document.getElementById('preset-editor');
  const cats = cfg.categorie_preset || Object.keys(cfg.pesi_preset || {}).map(id => ({ id, label: id }));
  const ids = (cfg.criteri || []).map(c => c.id);
  root.innerHTML = cats.map(cat => {
    const preset = cfg.pesi_preset?.[cat.id] || {};
    const cells = ids.map(id => `
      <td><input type="number" step="0.05" min="0" max="1" class="form-control form-control-sm" style="width:70px"
        data-preset-cat="${esc(cat.id)}" data-preset-id="${esc(id)}" value="${preset[id] ?? 0}" /></td>`).join('');
    return `<div class="mb-3"><strong class="small">${esc(cat.label)}</strong> <code class="small">${esc(cat.id)}</code>
      <div class="table-scroll"><table class="table table-sm"><thead><tr>${ids.map(id => `<th class="small">${esc(id)}</th>`).join('')}</tr></thead>
      <tbody><tr>${cells}</tr></tbody></table></div></div>`;
  }).join('');
}

function syncPresetFromForm() {
  document.querySelectorAll('[data-preset-cat]').forEach(el => {
    const cat = el.dataset.presetCat;
    const id = el.dataset.presetId;
    if (!cfg.pesi_preset[cat]) cfg.pesi_preset[cat] = {};
    cfg.pesi_preset[cat][id] = +el.value || 0;
  });
}

function renderTco() {
  document.getElementById('tco-tbody').innerHTML = (cfg.tco_voci || []).map((v, i) => `
    <tr>
      <td><input class="form-control form-control-sm" data-tco="${i}" data-k="id" value="${esc(v.id)}" /></td>
      <td><input class="form-control form-control-sm" style="width:90px" data-tco="${i}" data-k="gruppo" value="${esc(v.gruppo)}" /></td>
      <td><input class="form-control form-control-sm" data-tco="${i}" data-k="label" value="${esc(v.label)}" /></td>
    </tr>`).join('');
  document.querySelectorAll('[data-tco]').forEach(el => {
    el.addEventListener('input', () => { cfg.tco_voci[+el.dataset.tco][el.dataset.k] = el.value; });
  });
}

function renderHelp() {
  const root = document.getElementById('help-editor');
  root.innerHTML = Object.entries(cfg.field_help || {}).map(([key, h]) => `
    <div class="row g-2 mb-2 align-items-start">
      <div class="col-md-3"><input class="form-control form-control-sm font-monospace" value="${esc(key)}" disabled /></div>
      <div class="col-md-5"><textarea class="form-control form-control-sm" rows="2" data-help="${esc(key)}" data-k="help">${esc(h.help || '')}</textarea></div>
      <div class="col-md-2"><input class="form-control form-control-sm" placeholder="link key" data-help="${esc(key)}" data-k="link" value="${esc(h.link || '')}" /></div>
      <div class="col-md-2"><input class="form-control form-control-sm" placeholder="link label" data-help="${esc(key)}" data-k="linkLabel" value="${esc(h.linkLabel || '')}" /></div>
    </div>`).join('');
  root.querySelectorAll('[data-help]').forEach(el => {
    el.addEventListener('input', () => { cfg.field_help[el.dataset.help][el.dataset.k] = el.value; });
  });
}

function renderLinks() {
  const root = document.getElementById('links-editor');
  root.innerHTML = Object.entries(cfg.ref_links || {}).map(([key, url]) => `
    <div class="row g-2 mb-2">
      <div class="col-md-3"><input class="form-control form-control-sm" value="${esc(key)}" disabled /></div>
      <div class="col-md-9"><input class="form-control form-control-sm" data-link="${esc(key)}" value="${esc(url)}" /></div>
    </div>`).join('');
  root.querySelectorAll('[data-link]').forEach(el => {
    el.addEventListener('input', () => { cfg.ref_links[el.dataset.link] = el.value; });
  });
}

function addCriterioGroup() {
  syncFromForm();
  let id = 'nuovo_criterio';
  let n = 1;
  while ((cfg.criteri || []).some(c => c.id === id)) id = `nuovo_criterio_${n++}`;
  const input = defaultInputForType('si_no');
  const c = {
    id, label: 'Nuovo criterio', peso_default: 0, direction: 'benefit',
    input, score: defaultScoreForType('si_no'),
  };
  cfg.criteri.push(c);
  ensurePresetKeys(id, 0);
  renderCriteri();
  renderPesi();
  renderPreset();
  syncJsonEditor();
  showStatus(`Criterio <code>${esc(id)}</code> aggiunto.`, 'success');
}

function deleteCriterioGroup(idx) {
  const c = cfg.criteri[idx];
  if (!c) return;
  if (['tco', 'copertura_req'].includes(c.id)) {
    showStatus('TCO e copertura requisiti non possono essere eliminati.', 'warning');
    return;
  }
  if (!confirm(`Eliminare il criterio «${c.label}» (${c.id})?`)) return;
  syncFromForm();
  removePresetKey(c.id);
  removeFieldHelpForGroup(c.id);
  cfg.criteri.splice(idx, 1);
  renderCriteri();
  renderPesi();
  renderPreset();
  syncJsonEditor();
}

function removeFieldHelpForGroup(groupId) {
  const prefix = `criteri.${groupId}`;
  Object.keys(cfg.field_help || {}).forEach(k => {
    if (k === prefix || k.startsWith(prefix + '.')) delete cfg.field_help[k];
  });
}

function addCriterioItem(idx) {
  syncFromForm();
  const c = cfg.criteri[idx];
  if (!c.input?.items) return;
  let id = 'v1', n = 1;
  const ids = new Set(c.input.items.map(i => i.id));
  while (ids.has(id)) id = `v${++n}`;
  c.input.items.push(c.input.type === 'scelta_unica'
    ? { id, testo: 'Nuova opzione', valore: c.input.items.length }
    : { id, testo: 'Nuova voce', obbligatorio: false });
  renderCriteri();
  syncJsonEditor();
}

function deleteCriterioItem(idx, j) {
  syncFromForm();
  const items = cfg.criteri[idx]?.input?.items;
  if (!items || items.length <= 1) { showStatus('Serve almeno una voce.', 'warning'); return; }
  items.splice(j, 1);
  renderCriteri();
  syncJsonEditor();
}

function addField(idx) {
  syncFromForm();
  const c = cfg.criteri[idx];
  if (!c.input.fields) c.input.fields = [];
  c.input.fields.push({ id: 'campo', label: 'Nuovo campo' });
  renderCriteri();
  syncJsonEditor();
}

function deleteField(idx, j) {
  syncFromForm();
  const fields = cfg.criteri[idx]?.input?.fields;
  if (!fields || fields.length <= 1) { showStatus('Serve almeno un campo.', 'warning'); return; }
  fields.splice(j, 1);
  renderCriteri();
  syncJsonEditor();
}

document.getElementById('criteri-editor').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const idx = +btn.dataset.idx;
  const j = btn.dataset.j !== undefined ? +btn.dataset.j : -1;
  const action = btn.dataset.action;
  if (action === 'del-group') deleteCriterioGroup(idx);
  else if (action === 'add-item') addCriterioItem(idx);
  else if (action === 'del-item') deleteCriterioItem(idx, j);
  else if (action === 'add-field') addField(idx);
  else if (action === 'del-field') deleteField(idx, j);
});

document.getElementById('criteri-editor').addEventListener('change', e => {
  if (e.target.matches('[data-k="input.type"]') || e.target.matches('[data-score-k="method"]')) {
    try { syncCriteriFromForm(); } catch (err) { showStatus(err.message, 'danger'); return; }
    renderCriteri();
    syncJsonEditor();
  }
});

document.getElementById('add-cri-group-btn').addEventListener('click', addCriterioGroup);

async function loadDefault() {
  await ValcompConfig.load();
  cfg = structuredClone(ValcompConfig.getConfig());
  cfg.tipo = 'criteri-config-valcomp';
  syncToForm();
  showStatus('Configurazione caricata da <code>config/criteri-config-v2.0.json</code>.', 'success');
}

document.querySelectorAll('#cfg-tabs .nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    try { syncFromForm(); } catch (e) { showStatus(e.message, 'danger'); return; }
    document.querySelectorAll('#cfg-tabs .nav-link').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.cfg-section').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('pane-' + btn.dataset.pane).classList.add('active');
  });
});

document.getElementById('pesi-tbody').addEventListener('input', syncPesiFromForm);
document.getElementById('preset-editor').addEventListener('input', syncPresetFromForm);

document.getElementById('reload-btn').addEventListener('click', () => loadDefault().catch(e => showStatus(e.message, 'danger')));
document.getElementById('validate-btn').addEventListener('click', () => {
  try { syncFromForm(); ValcompConfig.validate(cfg); showStatus('Configurazione valida.', 'success'); }
  catch (e) { showStatus(e.message, 'danger'); }
});

document.getElementById('download-btn').addEventListener('click', () => {
  try { syncFromForm(); ValcompConfig.validate(cfg); } catch (e) { showStatus(e.message, 'danger'); return; }
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: (cfg.id || 'criteri-config') + '.json',
  });
  a.click();
  URL.revokeObjectURL(a.href);
  showStatus('File scaricato. Sostituire <code>docs/config/criteri-config-v2.0.json</code> nel repository.', 'success');
});

document.getElementById('load-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      cfg = ValcompConfig.validate(JSON.parse(ev.target.result));
      syncToForm();
      showStatus('File caricato.', 'success');
    } catch (err) { showStatus(err.message, 'danger'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('apply-json-btn').addEventListener('click', () => {
  try {
    cfg = ValcompConfig.validate(JSON.parse(document.getElementById('json-editor').value));
    syncToForm();
    showStatus('JSON applicato.', 'success');
  } catch (e) { showStatus(e.message, 'danger'); }
});

document.getElementById('add-tco-btn').addEventListener('click', () => {
  syncFromForm();
  cfg.tco_voci.push({ id: 'nuova_voce', label: 'Nuova voce', gruppo: 'ALTRO' });
  renderTco();
});

document.getElementById('add-help-btn').addEventListener('click', () => {
  syncFromForm();
  cfg.field_help['nuovo.campo'] = { help: 'Testo suggerimento…' };
  renderHelp();
});

document.getElementById('add-link-btn').addEventListener('click', () => {
  syncFromForm();
  cfg.ref_links.nuovoLink = 'https://';
  renderLinks();
});

loadDefault().catch(e => showStatus(e.message, 'danger'));
