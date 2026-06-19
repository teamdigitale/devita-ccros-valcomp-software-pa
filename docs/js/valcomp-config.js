'use strict';
/**
 * Caricamento configurazione criteri v2, stato wizard e migrazione valutazioni.
 */
const ValcompConfig = (function () {
  const DEFAULT_URL = 'config/criteri-config-v2.0.json';
  const INPUT_TYPES_WITH_UI = new Set(['si_no', 'si_no_na', 'scelta_unica', 'campi_numerici', 'vitalita']);
  let _config = null;

  function inputType(criterion) {
    return criterion?.input?.type || '';
  }

  function validate(cfg) {
    if (!cfg || cfg.tipo !== 'criteri-config-valcomp') {
      throw new Error('File di configurazione non valido: tipo atteso "criteri-config-valcomp".');
    }
    if (!cfg.versione || !String(cfg.versione).startsWith('2')) {
      throw new Error('Configurazione v2 richiesta (versione 2.x). Usare criteri-config-v2.0.json.');
    }
    if (!Array.isArray(cfg.criteri) || !cfg.criteri.length) {
      throw new Error('Configurazione priva di array "criteri".');
    }
    if (!Array.isArray(cfg.tco_voci)) throw new Error('Configurazione priva di "tco_voci".');
    const ids = new Set();
    cfg.criteri.forEach((c, i) => {
      if (!c.id) throw new Error(`Criterio #${i} privo di "id".`);
      if (ids.has(c.id)) throw new Error(`ID criterio duplicato: ${c.id}`);
      ids.add(c.id);
      if (!c.input?.type) throw new Error(`Criterio "${c.id}" privo di input.type.`);
      if (!c.score?.method) throw new Error(`Criterio "${c.id}" privo di score.method.`);
      if (!c.direction) throw new Error(`Criterio "${c.id}" privo di direction.`);
    });
    return cfg;
  }

  function resolveFieldHelp(raw, refLinks) {
    const out = {};
    Object.entries(raw || {}).forEach(([key, entry]) => {
      out[key] = { help: entry.help || '' };
      if (entry.link && refLinks[entry.link]) {
        out[key].link = refLinks[entry.link];
        out[key].linkLabel = entry.linkLabel || 'Approfondisci →';
      }
    });
    return out;
  }

  function buildPesiDef(criteri) {
    return criteri.map(c => ({
      id: c.id,
      label: c.label,
      def: c.peso_default ?? 0,
      note: c.note || '',
      fixed: !!c.fixed,
    }));
  }

  function buildCriteriById(criteri) {
    const out = {};
    criteri.forEach(c => { out[c.id] = c; });
    return out;
  }

  function applyToGlobals() {
    if (!_config) throw new Error('Config non caricata. Chiamare load() prima.');
    const refLinks = _config.ref_links || {};
    const criteri = _config.criteri;
    window.REF_LINKS = refLinks;
    window.FIELD_HELP = resolveFieldHelp(_config.field_help, refLinks);
    window.CRITERI_LIST = criteri;
    window.CRITERI_BY_ID = buildCriteriById(criteri);
    window.CRITERI_DEF = window.CRITERI_BY_ID;
    window.PESI_DEF = buildPesiDef(criteri);
    window.PESI_PRESET = _config.pesi_preset || {};
    window.TCO_VOCI = _config.tco_voci;
    window.COST_CRITERIA = new Set(criteri.filter(c => c.direction === 'cost').map(c => c.id));
    window.CONFIG_VERSION = _config.versione;
    window.CONFIG_ID = _config.id || `criteri-config-v${_config.versione}`;
    window.CATEGORIE_PRESET = _config.categorie_preset || Object.keys(window.PESI_PRESET).map(id => ({ id, label: id }));
  }

  async function load(url) {
    const res = await fetch(url || DEFAULT_URL);
    if (!res.ok) throw new Error(`Impossibile caricare la configurazione (${res.status}).`);
    _config = validate(await res.json());
    return _config;
  }

  function getConfig() { return _config; }
  function getVersion() { return _config?.versione || '2.0'; }
  function getConfigId() { return _config?.id || `criteri-config-v${getVersion()}`; }

  function getCriteriWithUI() {
    return (_config?.criteri || []).filter(c => INPUT_TYPES_WITH_UI.has(inputType(c)));
  }

  function getVitalitaFields() {
    const vit = (_config?.criteri || []).find(c => c.id === 'vitalita');
    return vit?.input?.fields || [
      { id: 'giorni', label: "Giorni dall'ultimo commit" },
      { id: 'commit', label: 'Commit (3 anni)' },
      { id: 'contributi', label: 'Contributori (3 anni)' },
      { id: 'release', label: 'Release (3 anni)' },
    ];
  }

  function initCriterionState(criterion, n) {
    const zeros = () => Array(n).fill(0);
    const empty = () => Array(n).fill('');
    const type = inputType(criterion);
    const out = {};

    if (type === 'si_no' || type === 'si_no_na') {
      out.items = {};
      (criterion.input.items || []).forEach(item => { out.items[item.id] = empty(); });
    } else if (type === 'scelta_unica') {
      out.scelta = zeros();
    } else if (type === 'campi_numerici' || type === 'vitalita') {
      (criterion.input.fields || []).forEach(f => { out[f.id] = zeros(); });
    }
    return out;
  }

  function buildEmptyCriteriState(n) {
    const out = {};
    (_config?.criteri || []).forEach(c => {
      const type = inputType(c);
      if (type === 'tco' || type === 'requisiti_percent') return;
      out[c.id] = initCriterionState(c, n);
    });
    return out;
  }

  function extendStateForNewSolution(state) {
    const c = state.criteri;
    (_config?.criteri || []).forEach(criterion => {
      const key = criterion.id;
      if (!c[key]) return;
      const type = inputType(criterion);
      if (type === 'si_no' || type === 'si_no_na') {
        Object.values(c[key].items || {}).forEach(a => a.push(''));
      } else if (type === 'scelta_unica') {
        c[key].scelta.push(0);
      } else if (type === 'campi_numerici' || type === 'vitalita') {
        (criterion.input.fields || []).forEach(f => {
          if (!c[key][f.id]) c[key][f.id] = [];
          c[key][f.id].push(0);
        });
      }
    });
    TCO_VOCI.forEach(v => {
      if (!state.tco.voci[v.id]) state.tco.voci[v.id] = [];
      state.tco.voci[v.id].push(0);
    });
    state.requisiti.forEach(r => {
      r.copertura.push(0);
      if (r.note_copertura) r.note_copertura.push('');
    });
  }

  function shrinkStateForRemovedSolution(state, idx) {
    const c = state.criteri;
    (_config?.criteri || []).forEach(criterion => {
      const key = criterion.id;
      if (!c[key]) return;
      const type = inputType(criterion);
      if (type === 'si_no' || type === 'si_no_na') {
        Object.values(c[key].items || {}).forEach(a => a.splice(idx, 1));
      } else if (type === 'scelta_unica') {
        c[key].scelta.splice(idx, 1);
      } else if (type === 'campi_numerici' || type === 'vitalita') {
        (criterion.input.fields || []).forEach(f => c[key][f.id]?.splice(idx, 1));
      }
    });
    Object.values(state.tco.voci).forEach(a => a.splice(idx, 1));
    state.requisiti.forEach(r => {
      r.copertura.splice(idx, 1);
      if (r.note_copertura) r.note_copertura.splice(idx, 1);
    });
  }

  function getConfigSnapshot() {
    if (!_config) return null;
    return JSON.parse(JSON.stringify(_config));
  }

  function compareConfigSnapshots(exported, current) {
    const out = { match: true, summary: [] };
    if (!exported) {
      out.match = null;
      out.summary.push('Export senza config_criteri: confronto limitato a config_id/versione.');
      return out;
    }
    if (!current) {
      out.match = null;
      out.summary.push('Config corrente non caricata.');
      return out;
    }

    const push = msg => { out.match = false; out.summary.push(msg); };

    if (exported.id !== current.id || exported.versione !== current.versione) {
      push(`Identificativo config: ${exported.id || '?'} v${exported.versione || '?'} (export) → ${current.id} v${current.versione} (attuale).`);
    }

    const expIds = (exported.criteri || []).map(c => c.id);
    const curIds = (current.criteri || []).map(c => c.id);
    const added = curIds.filter(k => !expIds.includes(k));
    const removed = expIds.filter(k => !curIds.includes(k));
    if (added.length) push(`Criteri aggiunti in config attuale: ${added.join(', ')}.`);
    if (removed.length) push(`Criteri rimossi dalla config attuale: ${removed.join(', ')}.`);

    (exported.criteri || []).forEach(expC => {
      const curC = (current.criteri || []).find(c => c.id === expC.id);
      if (!curC) return;
      const expItems = expC.input?.items || [];
      const curItems = curC.input?.items || [];
      if (expItems.length && curItems.length) {
        const expItemIds = expItems.map(i => i.id);
        const curItemIds = curItems.map(i => i.id);
        const a = curItemIds.filter(id => !expItemIds.includes(id));
        const r = expItemIds.filter(id => !curItemIds.includes(id));
        if (a.length) push(`Voci "${expC.id}" aggiunte: ${a.join(', ')}.`);
        if (r.length) push(`Voci "${expC.id}" rimosse: ${r.join(', ')}.`);
      }
      if (inputType(expC) === 'vitalita' && inputType(curC) === 'vitalita') {
        const expF = (expC.input?.fields || []).map(f => f.id);
        const curF = (curC.input?.fields || []).map(f => f.id);
        const a = curF.filter(id => !expF.includes(id));
        const r = expF.filter(id => !curF.includes(id));
        if (a.length) push(`Campi vitalità aggiunti: ${a.join(', ')}.`);
        if (r.length) push(`Campi vitalità rimossi: ${r.join(', ')}.`);
      }
      if (JSON.stringify(expC.score || {}) !== JSON.stringify(curC.score || {})) {
        push(`Formula score "${expC.id}" diversa rispetto all'export.`);
      }
    });

    const expTco = (exported.tco_voci || []).map(v => v.id);
    const curTco = (current.tco_voci || []).map(v => v.id);
    const tcoAdded = curTco.filter(k => !expTco.includes(k));
    const tcoRemoved = expTco.filter(k => !curTco.includes(k));
    if (tcoAdded.length) push(`Voci TCO aggiunte: ${tcoAdded.join(', ')}.`);
    if (tcoRemoved.length) push(`Voci TCO rimosse: ${tcoRemoved.join(', ')}.`);

    if (out.match && out.summary.length === 0 && JSON.stringify(stripConfigForCompare(exported)) !== JSON.stringify(stripConfigForCompare(current))) {
      push('Testi o pesi default modificati rispetto all\'export (stesso id/versione).');
    }

    return out;
  }

  function stripConfigForCompare(cfg) {
    const c = JSON.parse(JSON.stringify(cfg));
    delete c.migrations;
    delete c.descrizione;
    return c;
  }

  function rejectV1Import(envelope, warnings) {
    const ver = envelope?.config_versione || envelope?.valutazione?.config_versione;
    if (ver && !String(ver).startsWith('2')) {
      warnings.push(`Export con config v${ver} non supportato. Richiesta config v2.0. Vedi documentation/config-migration.md.`);
      return true;
    }
    return false;
  }

  function prepareImportedValutazione(envelope, warnings) {
    const w = warnings || [];
    const isEnvelope = envelope?.tipo === 'valutazione-comparativa-software' && envelope.valutazione;

    if (isEnvelope && rejectV1Import(envelope, w)) {
      throw new Error('Import non supportato: export con configurazione v1. Aggiornare la valutazione manualmente o riesportare con config v2.');
    }

    const imported = JSON.parse(JSON.stringify(isEnvelope ? envelope.valutazione : envelope));

    if (!isEnvelope && imported.config_versione && !String(imported.config_versione).startsWith('2')) {
      throw new Error('Import non supportato: valutazione con configurazione v1.');
    }

    if (isEnvelope) {
      if (envelope.config_versione && !imported.config_versione) {
        imported.config_versione = envelope.config_versione;
        imported.config_id = envelope.config_id;
      }
      const snapshot = envelope.config_criteri;
      if (snapshot) {
        const cmp = compareConfigSnapshots(snapshot, _config);
        if (cmp.summary.length) w.push(...cmp.summary);
        else if (cmp.match) w.push('Config criteri export: identica a quella attuale.');
      } else {
        w.push('Export senza config_criteri: impossibile verificare i criteri usati in origine.');
      }
    }

    migrateValutazione(imported, w);
    return imported;
  }

  function migrateValutazione(valutazione, warnings) {
    const w = warnings || [];
    if (!valutazione || typeof valutazione !== 'object') return valutazione;

    const fromVersion = valutazione.config_versione || '2.0';
    const fromId = valutazione.config_id || 'criteri-config-v2.0';
    const toVersion = getVersion();
    const toId = getConfigId();

    if (fromVersion === toVersion && fromId === toId) return valutazione;

    w.push(`Migrazione valutazione da config ${fromId} v${fromVersion} → ${toId} v${toVersion}.`);

    valutazione._legacy = valutazione._legacy || {};
    valutazione.criteri = valutazione.criteri || {};
    valutazione.tco = valutazione.tco || { voci: {} };
    valutazione.tco.voci = valutazione.tco.voci || {};
    valutazione.pesi = valutazione.pesi || {};

    const validIds = new Set((_config?.criteri || []).map(c => c.id));

    Object.keys(valutazione.criteri).forEach(key => {
      if (!validIds.has(key)) {
        valutazione._legacy.criteri = valutazione._legacy.criteri || {};
        valutazione._legacy.criteri[key] = valutazione.criteri[key];
        delete valutazione.criteri[key];
        w.push(`Criterio "${key}" archiviato in _legacy (non più presente in config).`);
      }
    });

    (_config?.criteri || []).forEach(criterion => {
      const key = criterion.id;
      const cur = valutazione.criteri[key];
      if (!cur) return;
      const type = inputType(criterion);

      if (type === 'si_no' || type === 'si_no_na') {
        const validItemIds = new Set((criterion.input.items || []).map(i => i.id));
        Object.keys(cur.items || {}).forEach(itemId => {
          if (!validItemIds.has(itemId)) {
            valutazione._legacy.criteri = valutazione._legacy.criteri || {};
            valutazione._legacy.criteri[key] = valutazione._legacy.criteri[key] || {};
            valutazione._legacy.criteri[key].items = valutazione._legacy.criteri[key].items || {};
            valutazione._legacy.criteri[key].items[itemId] = cur.items[itemId];
            delete cur.items[itemId];
            w.push(`Voce criterio "${key}.${itemId}" archiviata in _legacy.`);
          }
        });
      }

      if (type === 'campi_numerici' || type === 'vitalita') {
        const validFields = new Set((criterion.input.fields || []).map(f => f.id));
        Object.keys(cur).forEach(fieldId => {
          if (fieldId === 'items' || fieldId === 'scelta') return;
          if (!validFields.has(fieldId)) {
            valutazione._legacy.criteri = valutazione._legacy.criteri || {};
            valutazione._legacy.criteri[key] = valutazione._legacy.criteri[key] || {};
            valutazione._legacy.criteri[key][fieldId] = cur[fieldId];
            delete cur[fieldId];
          }
        });
      }
    });

    const validTco = new Set(TCO_VOCI.map(v => v.id));
    Object.keys(valutazione.tco.voci).forEach(vid => {
      if (!validTco.has(vid)) {
        valutazione._legacy.tco_voci = valutazione._legacy.tco_voci || {};
        valutazione._legacy.tco_voci[vid] = valutazione.tco.voci[vid];
        delete valutazione.tco.voci[vid];
        w.push(`Voce TCO "${vid}" archiviata in _legacy.`);
      }
    });

    Object.keys(valutazione.pesi).forEach(pid => {
      if (!PESI_DEF.find(p => p.id === pid)) {
        valutazione._legacy.pesi = valutazione._legacy.pesi || {};
        valutazione._legacy.pesi[pid] = valutazione.pesi[pid];
        delete valutazione.pesi[pid];
        w.push(`Peso TOPSIS "${pid}" archiviato in _legacy.`);
      }
    });

    (_config.migrations || []).forEach(m => {
      if (m.from_version !== fromVersion || m.to_version !== toVersion) return;
      (m.rename_criteri || []).forEach(({ from, to }) => {
        if (valutazione.criteri[from] && !valutazione.criteri[to]) {
          valutazione.criteri[to] = valutazione.criteri[from];
          delete valutazione.criteri[from];
          w.push(`Criterio rinominato: ${from} → ${to}.`);
        }
      });
      (m.rename_pesi || []).forEach(({ from, to }) => {
        if (valutazione.pesi[from] !== undefined && valutazione.pesi[to] === undefined) {
          valutazione.pesi[to] = valutazione.pesi[from];
          delete valutazione.pesi[from];
        }
      });
    });

    valutazione.config_versione = toVersion;
    valutazione.config_id = toId;
    valutazione._migrated_from = { id: fromId, versione: fromVersion, il: new Date().toISOString() };

    return valutazione;
  }

  function exportMetaPatch() {
    return { config_id: getConfigId(), config_versione: getVersion() };
  }

  function exportEnvelopeConfigFields() {
    return {
      config_id: getConfigId(),
      config_versione: getVersion(),
      config_criteri: getConfigSnapshot(),
    };
  }

  /** Opzioni select per input.type checklist */
  function getChecklistOptions(inputTypeName) {
    if (inputTypeName === 'si_no_na') {
      return [['', '—'], ['si', 'sì'], ['no', 'no'], ['na', 'N/A']];
    }
    return [['', '—'], ['si', 'sì'], ['no', 'no']];
  }

  function getChecklistLabels() {
    return { si: 'sì', no: 'no', na: 'N/A', '': '—' };
  }

  function getChecklistColors() {
    return { si: '#008055', no: '#cc334d', na: '#995c00', '': '#aaa' };
  }

  return {
    load,
    applyToGlobals,
    validate,
    getConfig,
    getVersion,
    getConfigId,
    getConfigSnapshot,
    compareConfigSnapshots,
    prepareImportedValutazione,
    getVitalitaFields,
    getCriteriWithUI,
    buildEmptyCriteriState,
    extendStateForNewSolution,
    shrinkStateForRemovedSolution,
    migrateValutazione,
    exportMetaPatch,
    exportEnvelopeConfigFields,
    getChecklistOptions,
    getChecklistLabels,
    getChecklistColors,
    inputType,
    DEFAULT_URL,
  };
})();
