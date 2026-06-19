'use strict';
/** Helper rendering criteri da config v2 (input.type). */
const ValcompRender = (function () {

  function inputType(def) {
    return ValcompConfig.inputType(def);
  }

  function checklistStyle(v) {
    const col = ValcompConfig.getChecklistColors()[v] || '';
    return col ? `border-color:${col};color:${col};font-weight:600` : '';
  }

  function checklistLabel(v) {
    return ValcompConfig.getChecklistLabels()[v] ?? v ?? '—';
  }

  function checklistOnChange(key, itemId, i) {
    return `state.criteri['${key}'].items['${itemId}'][${i}]=this.value;` +
      `const c={si:'#008055',no:'#cc334d',na:'#995c00'}[this.value]||'';` +
      `this.style.borderColor=c;this.style.color=c;this.style.fontWeight=this.value?'600':''`;
  }

  function vitalitaWeightFor(fieldId) {
    const w = (window.CRITERI_BY_ID || {}).vitalita?.score?.weights || {};
    if (fieldId === 'giorni') return w.giorni_bonus ?? 0.3;
    return w[fieldId] ?? '';
  }

  function swHeaders() {
    return range().map(i =>
      `<th scope="col" class="text-center" data-sw-header="${i}" style="color:${swColor(i)};min-width:110px">${swName(i)}</th>`
    ).join('');
  }

  function buildChecklist(key, def, mode) {
    const type = inputType(def);
    const opts = ValcompConfig.getChecklistOptions(type);
    const items = def.input?.items || [];

    if (mode === 'modal') {
      const i = _modalSwIdx;
      return items.map(item => {
        const v = (state.criteri[key].items[item.id] || [])[i] || '';
        const col = ValcompConfig.getChecklistColors()[v] || '';
        return `<div class="mb-2">
          <div class="d-flex align-items-start gap-2">
            <select class="form-select form-select-sm flex-shrink-0" style="max-width:130px${col ? `;${checklistStyle(v)}` : ''}"
              onchange="${checklistOnChange(key, item.id, i)}">
              ${opts.map(([val, lab]) => `<option value="${val}"${v === val ? ' selected' : ''}>${lab}</option>`).join('')}
            </select>
            <span class="small ${item.obbligatorio ? 'fw-semibold' : ''}">${escH(item.testo)}</span>
          </div>
          ${fieldHelpHTML(`criteri.${key}.${item.id}`)}
        </div>`;
      }).join('');
    }

    const rows = items.map(item => {
      const cells = range().map(i => {
        const v = (state.criteri[key].items[item.id] || [])[i] || '';
        if (mode === 'review') {
          const col = ValcompConfig.getChecklistColors()[v] || '#aaa';
          return `<td class="text-center rv-cell" onclick="openSwModal(${i},'swm-cri')" title="Clicca per modificare">
            <span class="rv-cell-val fw-semibold" style="color:${col}">${escH(checklistLabel(v))}</span></td>`;
        }
        if (mode === 'print') {
          const cls = v === 'si' ? 'pr-val-si' : v === 'no' ? 'pr-val-no' : v === 'na' ? 'pr-val-na' : '';
          return `<td class="pr-center ${cls}">${escH(checklistLabel(v))}</td>`;
        }
        return `<td><select class="form-select form-select-sm" style="${checklistStyle(v)}"
          onchange="${checklistOnChange(key, item.id, i)}">
          ${opts.map(([val, lab]) => `<option value="${val}"${v === val ? ' selected' : ''}>${lab}</option>`).join('')}
        </select></td>`;
      }).join('');
      const labelCell = mode === 'print'
        ? `<td>${escH(item.testo)}</td>`
        : `<td class="small">${item.obbligatorio ? '<strong>' : ''}${escH(item.testo)}${item.obbligatorio ? '</strong>' : ''}</td>`;
      return `<tr>${labelCell}${cells}</tr>`;
    }).join('');

    const hdrs = mode === 'print' ? range().map(i => `<th>${escH(swName(i))}</th>`).join('') : swHeaders();
    const thFirst = mode === 'print' ? 'Criterio' : 'Criterio';
    return `<div class="table-scroll"><table class="table table-sm table-hover mb-0">
      <thead><tr><th style="min-width:260px;width:50%">${thFirst}</th>${hdrs}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function buildSceltaUnica(key, def, mode) {
    const items = def.input?.items || [];
    if (mode === 'modal') {
      const i = _modalSwIdx;
      const selVal = state.criteri[key].scelta[i];
      return `<div class="mb-1"><select class="form-select form-select-sm" onchange="state.criteri['${key}'].scelta[${i}]=+this.value">
        ${items.map(item => `<option value="${item.valore}"${selVal === item.valore ? ' selected' : ''}>${escH(item.testo)}</option>`).join('')}
      </select></div>`;
    }
    const rows = items.map(item => {
      const cells = range().map(i => {
        const sel = state.criteri[key].scelta[i] === item.valore;
        if (mode === 'print') return `<td class="pr-center">${sel ? '✓' : '·'}</td>`;
        if (mode === 'review') {
          return `<td class="text-center rv-cell" onclick="openSwModal(${i},'swm-cri')">
            ${sel ? '<span class="fw-bold" style="color:#0066cc">✓</span>' : '<span class="text-muted">·</span>'}</td>`;
        }
        return `<td class="text-center"><input type="radio" name="${key}-sw${i}" value="${item.valore}" ${sel ? 'checked' : ''}
          onchange="state.criteri['${key}'].scelta[${i}]=+this.value" aria-label="${escH(item.testo)} — ${swName(i)}" /></td>`;
      }).join('');
      return `<tr><td class="small">${escH(item.testo)}</td>${cells}</tr>`;
    }).join('');
    const hdrs = mode === 'print' ? range().map(i => `<th>${escH(swName(i))}</th>`).join('') : swHeaders();
    return `<div class="table-scroll"><table class="table table-sm table-hover mb-0">
      <thead><tr><th style="min-width:260px;width:50%">Opzione</th>${hdrs}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function buildCampiNumerici(key, def, mode) {
    const fields = def.input?.fields || [];
    if (mode === 'modal') {
      const i = _modalSwIdx;
      return `<div class="d-flex gap-4 flex-wrap">${fields.map(f => `
        <div><label class="small d-block mb-1">${escH(f.label)}</label>
          <input type="number" class="form-control form-control-sm" style="width:100px" min="0"
            value="${state.criteri[key][f.id]?.[i] || 0}"
            oninput="state.criteri['${key}']['${f.id}'][${i}]=+this.value||0" />
        </div>`).join('')}</div>`;
    }
    const rows = fields.map(f => {
      const cells = range().map(i => {
        const val = state.criteri[key][f.id]?.[i] || 0;
        if (mode === 'review') return `<td class="text-center rv-cell" onclick="openSwModal(${i},'swm-cri')"><span class="rv-cell-val">${val}</span></td>`;
        if (mode === 'print') return `<td class="pr-center">${val}</td>`;
        return `<td><input type="number" class="form-control form-control-sm" style="width:90px" min="0" value="${val}"
          oninput="state.criteri['${key}']['${f.id}'][${i}]=+this.value||0" /></td>`;
      }).join('');
      return `<tr><td class="small">${escH(f.label)}</td>${cells}</tr>`;
    }).join('');
    const hdrs = mode === 'print' ? range().map(i => `<th>${escH(swName(i))}</th>`).join('') : swHeaders();
    const extra = key === 'dipendenze' && mode === 'edit'
      ? '<small class="text-muted d-block mt-1">Punteggio: 2×proprietario + opensource. Valori più bassi = punteggio migliore.</small>' : '';
    return `<div class="table-scroll"><table class="table table-sm table-hover mb-0">
      <thead><tr><th style="min-width:260px;width:50%">Voce</th>${hdrs}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>${extra}`;
  }

  function buildVitalita(key, def, mode) {
    const fields = def.input?.fields || ValcompConfig.getVitalitaFields();
    if (mode === 'modal') {
      const i = _modalSwIdx;
      return `<div class="d-flex gap-3 flex-wrap">${fields.map(f => `
        <div>
          <label class="small d-block mb-1">${escH(f.label)} <span class="text-muted">(w=${vitalitaWeightFor(f.id)})</span></label>
          <input type="number" class="form-control form-control-sm" style="width:100px" min="0"
            value="${state.criteri[key][f.id]?.[i] || 0}"
            oninput="state.criteri['${key}']['${f.id}'][${i}]=+this.value||0" />
          ${fieldHelpHTML('criteri.vitalita.' + f.id)}
        </div>`).join('')}</div>`;
    }
    const showWeight = mode === 'edit';
    const rows = fields.map(f => {
      const cells = range().map(i => {
        const val = state.criteri[key][f.id]?.[i] || 0;
        if (mode === 'review') return `<td class="text-center rv-cell" onclick="openSwModal(${i},'swm-cri')"><span class="rv-cell-val">${val}</span></td>`;
        if (mode === 'print') return `<td class="pr-center">${val}</td>`;
        return `<td><input type="number" class="form-control form-control-sm" style="width:90px" min="0" value="${val}"
          oninput="state.criteri['${key}']['${f.id}'][${i}]=+this.value||0" /></td>`;
      }).join('');
      return `<tr><td class="small">${escH(f.label)}</td>${showWeight ? `<td><small>${vitalitaWeightFor(f.id)}</small></td>` : ''}${cells}</tr>`;
    }).join('');
    const hdrs = mode === 'print' ? range().map(i => `<th>${escH(swName(i))}</th>`).join('') : swHeaders();
    return `<div class="table-scroll"><table class="table table-sm${mode === 'edit' ? '' : ' table-hover'} mb-0">
      <thead><tr><th style="min-width:240px">Metrica</th>${showWeight ? '<th style="width:60px">Peso</th>' : ''}${hdrs}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function renderCriterionBlock(key, def, mode) {
    const type = inputType(def);
    if (type === 'si_no' || type === 'si_no_na') return buildChecklist(key, def, mode);
    if (type === 'scelta_unica') return buildSceltaUnica(key, def, mode);
    if (type === 'campi_numerici') return buildCampiNumerici(key, def, mode);
    if (type === 'vitalita') return buildVitalita(key, def, mode);
    return '';
  }

  /** Righe <tr> per appendice stampa (tabella unificata criteri). */
  function buildPrintRows(key, def, swIndices) {
    const type = inputType(def);
    let rows = '';
    if (type === 'si_no' || type === 'si_no_na') {
      (def.input?.items || []).forEach(item => {
        const cur = state.criteri[key].items[item.id] || swIndices.map(() => '');
        rows += `<tr><td></td><td style="font-size:.75rem">${escH(item.testo)}</td>
          ${swIndices.map(i => {
            const v = cur[i] || '';
            const cls = v === 'si' ? 'pr-val-si' : v === 'no' ? 'pr-val-no' : v === 'na' ? 'pr-val-na' : '';
            return `<td class="pr-center ${cls}">${escH(checklistLabel(v))}</td>`;
          }).join('')}</tr>`;
      });
    } else if (type === 'scelta_unica') {
      rows += `<tr><td></td><td style="font-size:.75rem">Opzione scelta</td>
        ${swIndices.map(i => {
          const c = (def.input?.items || []).find(it => it.valore === state.criteri[key].scelta[i]);
          return `<td class="pr-center" style="font-size:.73rem">${c ? escH(c.testo) : '—'}</td>`;
        }).join('')}</tr>`;
    } else if (type === 'campi_numerici') {
      (def.input?.fields || []).forEach(f => {
        rows += `<tr><td></td><td style="font-size:.75rem">${escH(f.label)}</td>
          ${swIndices.map(i => `<td class="pr-center">${state.criteri[key][f.id]?.[i] || 0}</td>`).join('')}</tr>`;
      });
    } else if (type === 'vitalita') {
      const fields = def.input?.fields || ValcompConfig.getVitalitaFields();
      fields.forEach(f => {
        rows += `<tr><td></td><td style="font-size:.75rem">${escH(f.label)}</td>
          ${swIndices.map(i => `<td class="pr-center">${state.criteri[key][f.id]?.[i] || 0}</td>`).join('')}</tr>`;
      });
    }
    return rows;
  }

  return { renderCriterionBlock, buildPrintRows, checklistLabel };
})();
