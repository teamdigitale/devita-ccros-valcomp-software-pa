# Strumento per la Valutazione Comparativa nell'Acquisizione e Riuso di Software

Le ["Linee Guida su acquisizione e riuso di software per le pubbliche amministrazioni"](https://docs.italia.it/italia/developers-italia/lg-acquisizione-e-riuso-software-per-pa-docs/it/stabile/index.html) entrate in vigore il 9 maggio 2019 hanno cambiato i paradigmi per l'acquisizione del software da parte delle pubbliche amministrazioni. Da questa data l'acquisizione di software attraverso il riuso di soluzioni di proprietà delle amministrazioni deve essere preceduta dall'**obbligo di apporre una licenza aperta** sul codice e la relativa documentazione, rendendo la **scelta open source strategica**.

Per rendere più efficiente, econonomica e neutrale questa scelta è stato previsto che le amministrazioni predisponessero [**un documento di valutazione comparativa che analizzasse le soluzioni open source**](https://docs.italia.it/italia/developers-italia/lg-acquisizione-e-riuso-software-per-pa-docs/it/stabile/acquisizione-software/valutazione-comparativa.html) rese disponibili dalle altre amministrazioni.

Per rendere la stesura di questo documento più agevole si è realizzato uno **strumento per supportare le amministrazioni** in questa attività, disponibile in due formati:

- **[Web App](https://teamdigitale.github.io/devita-ccros-valcomp-software-pa/)** — applicazione interattiva client-side, utilizzabile direttamente dal browser senza installazioni, con supporto per 2–8 soluzioni, import/export JSON e calcolo TOPSIS integrato
- **Fogli di calcolo** — file ODS scaricabili per l'utilizzo offline

Questo strumento è stato reso possibile dalla collaborazione tra il [Centro di Competenza Riuso e Open Source di AgID](https://www.agid.gov.it/it/design-servizi/riuso-open-source/centro-competenza-riuso-open-source) e il [Nexa Center for Internet & Society del Politecnico di Torino](https://nexa.polito.it/), con il prezioso supporto di alcune amministrazioni, tra le quali vanno ricordate la [Regione Piemonte](https://www.regione.piemonte.it), la [Regione Veneto](https://www.regione.veneto.it), la [Regione Emilia-Romagna](https://www.regione.emilia-romagna.it), la [Regione Marche](https://www.regione.marche.it), la [Regione Molise](http://www.regione.molise.it), il [Comune di Firenze](https://www.comune.fi.it).

Lo strumento è scaricabile e fruibile dalle amministrazioni interessate e accettiamo volentieri **suggerimenti e proposte di modifica** per migliorare il suo utilizzo.

# Organizzazione del repository

## Web App

La **[Web App](https://teamdigitale.github.io/devita-ccros-valcomp-software-pa/)** è disponibile online e utilizzabile direttamente dal browser. Non richiede installazioni, non invia dati a server remoti e funziona completamente client-side. Permette di:
- Valutare da 2 a 8 soluzioni software contemporaneamente
- Compilare tutti i criteri previsti dalla normativa (interoperabilità, privacy, sicurezza, accessibilità, TCO, ...)
- Ottenere la classifica finale tramite algoritmo TOPSIS
- Salvare e riprendere il lavoro tramite export/import JSON
- Importare metadati delle soluzioni da `publiccode.yml`, dalla scheda nel [catalogo Developers Italia](https://developers.italia.it/it/software) o dal repository GitHub

### Configurazione criteri (per maintainer)

I criteri, i pesi TOPSIS, le voci TCO e i testi di aiuto sono definiti in un file JSON esterno v2 (`input` + `score` dichiarativi per ogni criterio TOPSIS), modificabile senza toccare la logica del wizard.

**Editor web (GitHub Pages):** [config-editor.html](https://teamdigitale.github.io/devita-ccros-valcomp-software-pa/config-editor.html) — stesso deploy del wizard, utilizzabile dal browser senza installazioni. Le modifiche si scaricano in JSON e vanno committate nel repository per diventare attive nel wizard.

| Risorsa | Online | Sorgente nel repo |
|---------|--------|-------------------|
| Editor configurazione | [GitHub Pages](https://teamdigitale.github.io/devita-ccros-valcomp-software-pa/config-editor.html) | [`docs/config-editor.html`](docs/config-editor.html) |
| File di configurazione attivo | [JSON](https://teamdigitale.github.io/devita-ccros-valcomp-software-pa/config/criteri-config-v2.0.json) | [`docs/config/criteri-config-v2.0.json`](docs/config/criteri-config-v2.0.json) |
| Schema config v2 | — | [`docs/schema/criteri-config-v2.0.json`](docs/schema/criteri-config-v2.0.json) |
| Motore scoring | — | [`docs/js/valcomp-scoring.js`](docs/js/valcomp-scoring.js) |
| Logica caricamento / migrazione | — | [`docs/js/valcomp-config.js`](docs/js/valcomp-config.js) |
| Piano migrazione (breaking v2) | — | [`documentation/config-migration.md`](documentation/config-migration.md) |

**Modello v2 (maintainer):** ogni criterio in `criteri[]` ha `input.type` (`si_no`, `si_no_na`, `scelta_unica`, `campi_numerici`, `vitalita`, …) e `score.method` (`count_value`, `count_value_with_override`, `selected_value`, …). I requisiti restano in percentuale 0–100 nello step dedicato.

**Avvio locale** (solo per sviluppo, stesso comportamento di GitHub Pages):

```bash
cd docs && python3 -m http.server 8765
```

Poi aprire `http://localhost:8765/config-editor.html` o `http://localhost:8765/` per il wizard.

#### Rendere attiva una nuova configurazione

1. **Modifica** il JSON con l'editor web o edit diretto; incrementa `versione` e, se serve, cambia `id` (es. `criteri-config-v2.1`).
2. **Salva** il file in `docs/config/` (nuovo file o sostituzione del file esistente).
3. **Punta il wizard al file attivo** aggiornando la costante `DEFAULT_URL` in [`docs/js/valcomp-config.js`](docs/js/valcomp-config.js):

   ```javascript
   const DEFAULT_URL = 'config/criteri-config-v2.1.json';
   ```

4. **Aggiungi regole di migrazione** in `migrations` nel JSON se hai rinominato o rimosso criteri/voci TCO (vedi [`documentation/config-migration.md`](documentation/config-migration.md)).
5. **Verifica**: ricarica il wizard, controlla criteri e pesi; importa una valutazione JSON v2 e leggi eventuali avvisi.
6. **Nota v2:** export con `config_versione: "1.0"` non sono più importabili — migrazione manuale richiesta.
6. **Pubblica** il branch (es. GitHub Pages su `docs/`): al prossimo deploy tutti gli utenti useranno la nuova config; le valutazioni già esportate restano importabili grazie allo snapshot `config_criteri` nell'export e alla migrazione automatica.

## Fogli di calcolo

Dalla cartella [/tool](/tool) sono scaricabili i due fogli di calcolo necessari per completare la valutazione comparativa.

Nella cartella [/documentation](/documentation) è presente la Guida alla compilazione dei due fogli di calcolo sia in [formato MD](documentation/manual.md) sia, per praticità, in [formato PDF](documentation/SPCL4-AgID-CCROS-Guida%20alla%20compilazione%20della%20Valutazione%20Comparativa%20V1.pdf)

# Licenze d'uso

La documentazione presente in questo repository è coperta dalla licenza **Creative Commons Attribuzione 4.0 Internazionale (CC BY 4.0)**
con l'eccezione dei fogli di calcolo e del codice che sono coperti dalla licenza **GNU Affero General Public License, versione 3**

# [English version]

# Comparative assessment tool for the acquisition and reuse of software for public administrations

The ["Guidelines on the acquisition and reuse of software for public administrations"](https://docs.italia.it/italia/developers-italia/lg-acquisizione-e-riuso-software-per-pa-docs/it/stabile/index.html) entered into force on May 9th, 2019, have changed the paradigms for the acquisition of software by Italian public administrations. From this date, the acquisition of software through the reuse of solutions owned by the administrations must be preceded by the **obligation to affix an open license** to the code and related documentation, making the **open source choice strategic**.

To make this choice more efficient, economical and neutral, the administrations were required to prepare a [comparative assessment document](https://docs.italia.it/italia/developers-italia/lg-acquisizione-e-riuso-software-per-pa-docs/it/stabile/acquisizione-software/valutazione-comparativa.html) that analyzes the open source solutions made available by the other administrations.

To make the drafting of this document easier, a tool has been created to support administrations in this activity, available in two formats:

- **[Web App](https://teamdigitale.github.io/devita-ccros-valcomp-software-pa/)** — interactive client-side application, usable directly in the browser without installation, supporting 2–8 solutions, JSON import/export, and integrated TOPSIS calculation
- **Spreadsheets** — downloadable ODS files for offline use

This tool was made possible by the collaboration between [AgID's Reuse and Open Source Competence Center](https://www.agid.gov.it/it/design-servizi/riuso-open-source/centro-competenza-riuso-open-source) and the [Nexa Research Center for Internet and Society at the Politecnico of Turin](https://nexa.polito.it/) and the precious support of some administrations, including the [Piemonte Region](https://www.regione.piemonte.it), the [Veneto Region](https://www.regione.veneto.it), the [Emilia-Romagna Region](https://www.regione.emilia-romagna.it), the [Marche Region](https://www.regione.marche.it), the [Molise Region](http://www.regione.molise.it), and the [Municipality of Florence](https://www.comune.fi.it).

The tool can be downloaded and used by the administrations concerned, from which we **gladly accept suggestions and proposals for changes to improve its use**.

# Repository structure

## Web App

The **[Web App](https://teamdigitale.github.io/devita-ccros-valcomp-software-pa/)** is available online and can be used directly in the browser. It requires no installation, sends no data to remote servers, and works entirely client-side. It allows you to:
- Evaluate 2 to 8 software solutions simultaneously
- Fill in all criteria required by regulations (interoperability, privacy, security, accessibility, TCO, ...)
- Obtain the final ranking via the TOPSIS algorithm
- Save and resume work via JSON export/import
- Import solution metadata from `publiccode.yml`, a [Developers Italia catalog](https://developers.italia.it/en/software) page, or a GitHub repository

### Criteria configuration (for maintainers)

Criteria, TOPSIS weights, TCO line items, and field help texts are defined in an external **v2 JSON** file (each TOPSIS criterion declares `input` + `score`).

**Web editor (GitHub Pages):** [config-editor.html](https://teamdigitale.github.io/devita-ccros-valcomp-software-pa/config-editor.html) — same deployment as the wizard; download the JSON and commit it to the repo to activate changes.

| Resource | Online | Source in repo |
|----------|--------|----------------|
| Config editor | [GitHub Pages](https://teamdigitale.github.io/devita-ccros-valcomp-software-pa/config-editor.html) | [`docs/config-editor.html`](docs/config-editor.html) |
| Active config file | [JSON](https://teamdigitale.github.io/devita-ccros-valcomp-software-pa/config/criteri-config-v2.0.json) | [`docs/config/criteri-config-v2.0.json`](docs/config/criteri-config-v2.0.json) |
| Config schema v2 | — | [`docs/schema/criteri-config-v2.0.json`](docs/schema/criteri-config-v2.0.json) |
| Scoring engine | — | [`docs/js/valcomp-scoring.js`](docs/js/valcomp-scoring.js) |
| Load / migration logic | — | [`docs/js/valcomp-config.js`](docs/js/valcomp-config.js) |
| Migration plan (v2 breaking) | — | [`documentation/config-migration.md`](documentation/config-migration.md) |

**v2 model:** each entry in `criteri[]` has `input.type` (`si_no`, `si_no_na`, `scelta_unica`, …) and `score.method`. Requirements stay as 0–100% in their dedicated step.

For local development: `cd docs && python3 -m http.server 8765`, then open `http://localhost:8765/config-editor.html` or the wizard.

To **activate a new config**: save the JSON under `docs/config/`, bump `versione`/`id`, update `DEFAULT_URL` in `docs/js/valcomp-config.js`, add `migrations` rules if needed, test import of an existing evaluation, and deploy.

## Spreadsheets

The two spreadsheets needed to complete the comparative evaluation can be downloaded from the [/tool](/tool) folder.
The [/documentation](/documentation) folder contains the Guide to compiling the two spreadsheets both in [MD format](documentation/manual.md) and, for convenience, in [PDF format](documentation/SPCL4-AgID-CCROS-Guida%20alla%20compilazione%20della%20Valutazione%20Comparativa%20V1.pdf).

# Licenses

The documentation in this repository is covered by the **Creative Commons Attribution 4.0 International license (CC BY 4.0)**
with the exception of spreadsheets and code which are covered by the **GNU Affero General Public License, version 3**

