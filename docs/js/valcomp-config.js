'use strict';
/**
 * Caricamento configurazione criteri, applicazione ai global del wizard
 * e migrazione delle valutazioni salvate quando la config cambia.
 */
const ValcompConfig = (function () {
  const DEFAULT_URL = 'config/criteri-config-v1.0.json';
  let _config = null;

  function validate(cfg) {
    if (!cfg || cfg.tipo !== 'criteri-config-valcomp') {
      throw new Error('File di configurazione non valido: tipo atteso "criteri-config-valcomp".');
    }
    if (!cfg.versione) throw new Error('Configurazione priva di "versione".');
    if (!cfg.criteri || typeof cfg.criteri !== 'object') {
      throw new Error('Configurazione priva di "criteri".');
    }
    if (!Array.isArray(cfg.pesi_def) || !cfg.pesi_def.length) {
      throw new Error('Configurazione priva di "pesi_def".');
    }
    if (!Array.isArray(cfg.tco_voci)) throw new Error('Configurazione priva di "tco_voci".');
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

  function applyToGlobals() {
    if (!_config) throw new Error('Config non caricata. Chiamare load() prima.');
    const refLinks = _config.ref_links || {};
    window.REF_LINKS = refLinks;
    window.FIELD_HELP = resolveFieldHelp(_config.field_help, refLinks);
    window.PESI_DEF = _config.pesi_def;
    window.PESI_PRESET = _config.pesi_preset || {};
    window.CRITERI_DEF = _config.criteri;
    window.TCO_VOCI = _config.tco_voci;
    window.COST_CRITERIA = new Set(_config.cost_criteria || ['tco', 'dipendenze']);
    window.SCORING = _config.scoring || {};
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
  function getVersion() { return _config?.versione || '1.0'; }
  function getConfigId() { return _config?.id || `criteri-config-v${getVersion()}`; }

  function getVitalitaFields() {
    return _config?.criteri?.vitalita?.fields || [
      { id: 'giorni', label: "Giorni dall'ultimo commit", weight: '0.30' },
      { id: 'commit', label: 'Commit (3 anni)', weight: '0.40' },
      { id: 'contributi', label: 'Contributori (3 anni)', weight: '0.15' },
      { id: 'release', label: 'Release (3 anni)', weight: '0.15' },
    ];
  }

  function buildEmptyCriteriState(n) {
    const zeros = () => Array(n).fill(0);
    const empty = () => Array(n).fill('');
    const out = {};
    Object.entries(CRITERI_DEF).forEach(([key, def]) => {
      if (def.tipo === 'sinon' || def.tipo === 'sinon_nonec') {
        out[key] = { items: {} };
        (def.items || []).forEach(item => { out[key].items[item.id] = empty(); });
      } else if (def.tipo === 'radio') {
        out[key] = { scelta: zeros() };
      } else if (def.tipo === 'numero_dipendenze') {
        out[key] = { proprietario: zeros(), opensource: zeros() };
      } else if (def.tipo === 'numero_pa') {
        out[key] = { utilizzano: zeros(), interessate: zeros() };
      } else if (def.tipo === 'vitalita') {
        out[key] = {};
        getVitalitaFields().forEach(f => { out[key][f.id] = zeros(); });
      }
    });
    return out;
  }

  function extendStateForNewSolution(state) {
    const c = state.criteri;
    Object.entries(CRITERI_DEF).forEach(([key, def]) => {
      if (!c[key]) return;
      if (def.tipo === 'sinon' || def.tipo === 'sinon_nonec') {
        Object.values(c[key].items || {}).forEach(a => a.push(''));
      } else if (def.tipo === 'radio') {
        c[key].scelta.push(0);
      } else if (def.tipo === 'numero_dipendenze') {
        c[key].proprietario.push(0);
        c[key].opensource.push(0);
      } else if (def.tipo === 'numero_pa') {
        c[key].utilizzano.push(0);
        c[key].interessate.push(0);
      } else if (def.tipo === 'vitalita') {
        getVitalitaFields().forEach(f => {
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
    Object.entries(CRITERI_DEF).forEach(([key, def]) => {
      if (!c[key]) return;
      if (def.tipo === 'sinon' || def.tipo === 'sinon_nonec') {
        Object.values(c[key].items || {}).forEach(a => a.splice(idx, 1));
      } else if (def.tipo === 'radio') {
        c[key].scelta.splice(idx, 1);
      } else if (def.tipo === 'numero_dipendenze') {
        c[key].proprietario.splice(idx, 1);
        c[key].opensource.splice(idx, 1);
      } else if (def.tipo === 'numero_pa') {
        c[key].utilizzano.splice(idx, 1);
        c[key].interessate.splice(idx, 1);
      } else if (def.tipo === 'vitalita') {
        getVitalitaFields().forEach(f => c[key][f.id]?.splice(idx, 1));
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

  /** Confronta snapshot config nell'export con config attualmente caricata */
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

    const diffKeys = (label, expKeys, curKeys) => {
      const added = curKeys.filter(k => !expKeys.includes(k));
      const removed = expKeys.filter(k => !curKeys.includes(k));
      if (added.length) push(`${label} aggiunti in config attuale: ${added.join(', ')}.`);
      if (removed.length) push(`${label} rimossi dalla config attuale: ${removed.join(', ')}.`);
    };

    diffKeys('Criteri TOPSIS', (exported.pesi_def || []).map(p => p.id), (current.pesi_def || []).map(p => p.id));
    diffKeys('Gruppi criteri', Object.keys(exported.criteri || {}), Object.keys(current.criteri || {}));
    diffKeys('Voci TCO', (exported.tco_voci || []).map(v => v.id), (current.tco_voci || []).map(v => v.id));

    Object.entries(exported.criteri || {}).forEach(([key, def]) => {
      const cur = current.criteri?.[key];
      if (!cur) return;
      if ((def.items || []).length && (cur.items || []).length) {
        const expIds = def.items.map(i => i.id);
        const curIds = cur.items.map(i => i.id);
        const added = curIds.filter(id => !expIds.includes(id));
        const removed = expIds.filter(id => !curIds.includes(id));
        if (added.length) push(`Voci "${key}" aggiunte: ${added.join(', ')}.`);
        if (removed.length) push(`Voci "${key}" rimosse: ${removed.join(', ')}.`);
      }
      if (def.tipo === 'vitalita' && cur.tipo === 'vitalita') {
        const expF = (def.fields || []).map(f => f.id);
        const curF = (cur.fields || []).map(f => f.id);
        const added = curF.filter(id => !expF.includes(id));
        const removed = expF.filter(id => !curF.includes(id));
        if (added.length) push(`Campi vitalità aggiunti: ${added.join(', ')}.`);
        if (removed.length) push(`Campi vitalità rimossi: ${removed.join(', ')}.`);
      }
    });

    if (JSON.stringify(exported.scoring || {}) !== JSON.stringify(current.scoring || {})) {
      push('Formule di scoring (vitalità, dipendenze, …) diverse rispetto all\'export.');
    }

    if (JSON.stringify(exported.cost_criteria || []) !== JSON.stringify(current.cost_criteria || [])) {
      push('Criteri costo TOPSIS modificati.');
    }

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

  /**
   * Prepara valutazione importata: meta config, confronto snapshot, migrazione dati.
   * @param {object} envelope - file JSON completo o valutazione grezza
   * @param {string[]} warnings - messaggi per l'utente
   */
  function prepareImportedValutazione(envelope, warnings) {
    const w = warnings || [];
    const isEnvelope = envelope?.tipo === 'valutazione-comparativa-software' && envelope.valutazione;
    const imported = JSON.parse(JSON.stringify(isEnvelope ? envelope.valutazione : envelope));

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

  /** Applica regole di migrazione config → valutazione importata */
  function migrateValutazione(valutazione, warnings) {
    const w = warnings || [];
    if (!valutazione || typeof valutazione !== 'object') return valutazione;

    const fromVersion = valutazione.config_versione || '1.0';
    const fromId = valutazione.config_id || 'criteri-config-v1.0';
    const toVersion = getVersion();
    const toId = getConfigId();

    if (fromVersion === toVersion && fromId === toId) return valutazione;

    w.push(`Migrazione valutazione da config ${fromId} v${fromVersion} → ${toId} v${toVersion}.`);

    valutazione._legacy = valutazione._legacy || {};
    valutazione.criteri = valutazione.criteri || {};
    valutazione.tco = valutazione.tco || { voci: {} };
    valutazione.tco.voci = valutazione.tco.voci || {};
    valutazione.pesi = valutazione.pesi || {};

    // Criteri rimossi dalla config → archivio _legacy.criteri
    Object.keys(valutazione.criteri).forEach(key => {
      if (!CRITERI_DEF[key]) {
        valutazione._legacy.criteri = valutazione._legacy.criteri || {};
        valutazione._legacy.criteri[key] = valutazione.criteri[key];
        delete valutazione.criteri[key];
        w.push(`Criterio "${key}" archiviato in _legacy (non più presente in config).`);
      }
    });

    // Sotto-chiavi rimosse (items si/no, campi vitalità, voci TCO)
    Object.entries(CRITERI_DEF).forEach(([key, def]) => {
      const cur = valutazione.criteri[key];
      if (!cur) return;
      if (def.tipo === 'sinon' || def.tipo === 'sinon_nonec') {
        const validIds = new Set((def.items || []).map(i => i.id));
        Object.keys(cur.items || {}).forEach(itemId => {
          if (!validIds.has(itemId)) {
            valutazione._legacy.criteri = valutazione._legacy.criteri || {};
            valutazione._legacy.criteri[key] = valutazione._legacy.criteri[key] || {};
            valutazione._legacy.criteri[key].items = valutazione._legacy.criteri[key].items || {};
            valutazione._legacy.criteri[key].items[itemId] = cur.items[itemId];
            delete cur.items[itemId];
            w.push(`Voce criterio "${key}.${itemId}" archiviata in _legacy.`);
          }
        });
      }
      if (def.tipo === 'vitalita') {
        const validFields = new Set(getVitalitaFields().map(f => f.id));
        Object.keys(cur).forEach(fieldId => {
          if (!validFields.has(fieldId)) {
            valutazione._legacy.criteri = valutazione._legacy.criteri || {};
            valutazione._legacy.criteri[key] = valutazione._legacy.criteri[key] || {};
            valutazione._legacy.criteri[key][fieldId] = cur[fieldId];
            delete cur[fieldId];
          }
        });
      }
    });

    // Voci TCO rimosse
    const validTco = new Set(TCO_VOCI.map(v => v.id));
    Object.keys(valutazione.tco.voci).forEach(vid => {
      if (!validTco.has(vid)) {
        valutazione._legacy.tco_voci = valutazione._legacy.tco_voci || {};
        valutazione._legacy.tco_voci[vid] = valutazione.tco.voci[vid];
        delete valutazione.tco.voci[vid];
        w.push(`Voce TCO "${vid}" archiviata in _legacy.`);
      }
    });

    // Pesi TOPSIS per criteri rimossi
    Object.keys(valutazione.pesi).forEach(pid => {
      if (!PESI_DEF.find(p => p.id === pid)) {
        valutazione._legacy.pesi = valutazione._legacy.pesi || {};
        valutazione._legacy.pesi[pid] = valutazione.pesi[pid];
        delete valutazione.pesi[pid];
        w.push(`Peso TOPSIS "${pid}" archiviato in _legacy.`);
      }
    });

    // Migrazioni esplicite definite nel file config (rename, map)
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
    buildEmptyCriteriState,
    extendStateForNewSolution,
    shrinkStateForRemovedSolution,
    migrateValutazione,
    exportMetaPatch,
    exportEnvelopeConfigFields,
    DEFAULT_URL,
  };
})();
