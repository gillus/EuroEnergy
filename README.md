# EuroEnergy

Dashboard statica, pubblicata su GitHub Pages, sulla produzione e sui consumi di energia nei paesi europei, paese per paese. I dati sono Eurostat.

**Sito:** https://gillus.github.io/EuroEnergy/

## Cosa mostra

- **Quota di energia rinnovabile**: totale (indicatore dei target UE), elettricità, riscaldamento e raffreddamento, trasporti. Dataset `nrg_ind_ren`.
- **Produzione elettrica**: totale (anche pro capite) e quota di ciascuna fonte (nucleare, gas, carbone, petrolio, idroelettrico, eolico, solare, bioenergie, ecc.), con il mix per paese nel tempo. Dataset `nrg_bal_peh`.
- **Consumi energetici**: consumo di energia primaria e finale (anche pro capite). Dataset `nrg_ind_eff`.
- **Dipendenza dalle importazioni**: totale, gas, petrolio, combustibili solidi. Dataset `nrg_ind_id`.

Ogni vista comprende:
- la mappa choropleth per l'anno scelto, con animazione nel tempo;
- l'andamento del paese selezionato confrontato con la media UE27;
- la classifica dei paesi.

Lo stato della vista (indicatore, anno, paese) è salvato nell'URL, quindi un link riapre esattamente quella vista.

## Sviluppo

Richiede Node 22.

```bash
npm install
npm run dev      # http://localhost:5173/EuroEnergy/
npm test
npm run build
```

## Dati

```bash
npm run data     # riscarica i dati Eurostat in public/data/
npm run geo      # riscarica i confini GISCO in public/geo/ (raramente necessario)
```

I file generati sono committati nel repository. La workflow `Aggiorna dati Eurostat` li rigenera il 3 di ogni mese: se ci sono dati nuovi fa il commit e ripubblica il sito. Si può anche lanciare a mano da *Actions → Aggiorna dati Eurostat → Run workflow*.

## Pubblicazione

La workflow `Deploy su GitHub Pages` esegue test e build a ogni push su `main`, poi pubblica il sito. Serve un solo passo manuale, da fare una volta: in *Settings → Pages* impostare **Source: GitHub Actions**.

## Fonti

- Eurostat, [energy database](https://ec.europa.eu/eurostat/web/energy/database) e popolazione al 1° gennaio (`demo_pjan`).
- Confini: © EuroGeographics per i confini amministrativi (GISCO).
