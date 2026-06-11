# Istruzioni per la compilazione APK (Android Studio)

Questa applicazione è stata preparata per essere utilizzata offline e compilata come App nativa per Android tramite **Capacitor**.

## Pre-requisiti
1. **Node.js** installato sul tuo computer.
2. **Android Studio** installato e configurato (con SDK e Virtual Device).
3. Scarica i file del progetto sul tuo computer.

## Passaggi per la compilazione

1. **Installa le dipendenze**:
   Apri il terminale nella cartella del progetto e scrivi:
   ```bash
   npm install
   ```

2. **Aggiungi la piattaforma Android**:
   (Da fare solo la prima volta)
   ```bash
   npm run cap:add:android
   ```

3. **Sincronizza e Build**:
   Ogni volta che fai modifiche al codice web, esegui:
   ```bash
   npm run cap:sync
   ```
   Questo comando builda l'app web e copia i file nella cartella di Android.

4. **Apri in Android Studio**:
   ```bash
   npm run cap:open:android
   ```
   Android Studio si aprirà con il progetto caricato.

5. **Genera APK**:
   In Android Studio, vai su:
   `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`.
   Una volta finito, troverai l'APK pronto per l'installazione.

## Ottimizzazioni per Mobile incluse
- **PWA e Offline**: L'app usa un Service Worker per caricare istantaneamente e funzionare senza internet.
- **Performance**: I componenti principali sono stati ottimizzati con `React.memo` per evitare ricaricamenti inutili.
- **Feedback Aptico**: L'app utilizza le vibrazioni di sistema per confermare le azioni (stile Taptic).
- **LocalStorage**: I tuoi dati sono salvati localmente sul dispositivo e non vengono mai persi alla chiusura dell'app.
- **Google Fonts Cache**: Anche i font sono salvati in cache per l'uso offline.
