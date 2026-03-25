# Strumento

Questa cartella contiene i fogli di calcolo che possono essere usati a supporto della ["Valutazione Comparativa"](https://docs.italia.it/italia/developers-italia/lg-acquisizione-e-riuso-software-per-pa-docs/it/stabile/acquisizione-software/valutazione-comparativa.html) prevista dalle norme in caso
di acquisizione di un software da parte di una Pubblica Amministrazione.

Per le istruzioni d'uso, fare riferimento ai documenti presenti nella cartella [/documentation](/documentation).

## Versioni disponibili

| File | Versione | Note |
|---|---|---|
| `SPCL4-AgID-CCROS-Valutazione comparativa tecnico-economica-vers V2.0.ods` | **V2.0** ⭐ Raccomandata | Bug fix formule, tab Istruzioni, messaggi di validazione |
| `SPCL4-AgID-CCROS-Pesi criteri di valutazione V2.0.ods` | **V2.0** ⭐ Raccomandata | Tab Istruzioni con guida alle macro-categorie |
| `SPCL4-AgID-CCROS-Valutazione comparativa tecnico-economica-vers V1.0.ods` | V1.0 (legacy) | Versione originale |
| `SPCL4-AgID-CCROS-Pesi criteri di valutazione V1.0.ods` | V1.0 (legacy) | Versione originale |

## Novità in V2.0

**File Valutazione comparativa:**
- 🐛 **Fix critico**: corretta formula COUNTIF che conteggiava le celle vuote come "si" (produceva punteggi errati)
- 🐛 **Fix critico**: corretta formula Supporto che restituiva una stringa invece di un numero (distorceva TOPSIS)
- ✅ Aggiunti messaggi di aiuto e di errore ai dropdown di validazione (si/no/nonec)
- 📋 Aggiunto foglio **Istruzioni** come primo tab: guida passo-passo alla compilazione, campi per i metadati della valutazione (PA, data, categoria), nota metodologica su TOPSIS

**File Pesi criteri:**
- 📋 Aggiunto foglio **Istruzioni** come primo tab: guida all'uso, descrizione delle macro-categorie disponibili
