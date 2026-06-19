'use strict';
/**
 * Motore di scoring dichiarativo — legge score.method da ogni criterio in config v2.
 */
const ValcompScoring = (function () {

  function computeCriterionScore(criterion, state, swIndex, tcoVoci) {
    const scoreDef = criterion.score || {};
    const method = scoreDef.method;
    const id = criterion.id;
    const c = state.criteri?.[id];

    switch (method) {
      case 'sum_tco': {
        return (tcoVoci || []).reduce((t, v) => t + (+state.tco?.voci?.[v.id]?.[swIndex] || 0), 0);
      }
      case 'count_value': {
        const target = scoreDef.value || 'si';
        const items = Object.values(c?.items || {});
        return items.filter(a => a[swIndex] === target).length;
      }
      case 'count_value_with_override': {
        const items = Object.values(c?.items || {});
        const override = scoreDef.if_any;
        if (override && items.some(a => a[swIndex] === override.value)) {
          return override.then;
        }
        const target = scoreDef.value || 'si';
        return items.filter(a => a[swIndex] === target).length;
      }
      case 'selected_value': {
        return c?.scelta?.[swIndex] || 0;
      }
      case 'linear_combination': {
        return (scoreDef.terms || []).reduce((sum, term) => {
          return sum + (term.factor || 1) * (+c?.[term.field]?.[swIndex] || 0);
        }, 0);
      }
      case 'sum_fields': {
        const fields = criterion.input?.fields || [];
        return fields.reduce((sum, f) => sum + (+c?.[f.id]?.[swIndex] || 0), 0);
      }
      case 'vitalita': {
        const g = +c?.giorni?.[swIndex] || 0;
        const commit = +c?.commit?.[swIndex] || 0;
        const contributi = +c?.contributi?.[swIndex] || 0;
        const release = +c?.release?.[swIndex] || 0;
        const reqField = scoreDef.requires_nonzero || 'commit';
        if (reqField && !(+c?.[reqField]?.[swIndex] || 0)) return 0;
        const w = scoreDef.weights || {};
        const soglia = scoreDef.giorni_soglia ?? 365;
        const base = commit * (w.commit || 0.4)
          + contributi * (w.contributi || 0.15)
          + release * (w.release || 0.15);
        return g <= soglia
          ? base + (soglia - g) * (w.giorni_bonus || 0.3)
          : base;
      }
      case 'weighted_average_percent': {
        const reqs = state.requisiti || [];
        if (!reqs.length) return 0;
        const wf = scoreDef.weight_field || 'peso';
        const totPeso = reqs.reduce((t, r) => t + (+r[wf] || 0), 0);
        if (totPeso <= 0) return 0;
        return reqs.reduce((t, r) => t + (+r[wf] || 0) * (+r.copertura?.[swIndex] || 0) / 100, 0) / totPeso;
      }
      default:
        return 0;
    }
  }

  function computeAllScores(criteriList, state, nSw, tcoVoci) {
    const out = {};
    (criteriList || []).forEach(criterion => {
      out[criterion.id] = Array.from({ length: nSw }, (_, i) =>
        computeCriterionScore(criterion, state, i, tcoVoci)
      );
    });
    return out;
  }

  return { computeCriterionScore, computeAllScores };
})();
