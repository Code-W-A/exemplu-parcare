# White label — panou demo local

Demo Next.js fără Firebase, autentificare reală, API-uri sau servicii externe. `/` deschide direct `/admin/dashboard`, cu drepturi de administrator fictiv. Datele sunt locale pentru fiecare browser și origine; nu se sincronizează între persoane sau dispozitive.

## Rulare

```sh
npm ci
npm run dev
```

Deschide http://localhost:3000. La prima vizită se generează 100 de rezervări cu nume și mașini fictive, istoric, intrări/ieșiri, întârzieri, cereri de modificare, tarife, ocupare, whitelist și angajați demo. Datele se raportează la ziua inițializării în Europe/Bucharest.

Toate paginile folosesc același depozit local. Modificările se salvează în cheia `white-label-parking-demo-v1` din localStorage și se notifică și taburile deschise ale aceleiași origini. Dacă browserul refuză stocarea, aplicația funcționează în memorie și afișează avertizarea privind pierderea modificărilor la reîncărcare. Datele invalide sau cu versiune incompatibilă se regenerează la inițializare.

Butonul „Resetează demo” cere confirmare, înlocuiește numai starea acestui demo și regenerează datele pentru ziua curentă. Celelalte chei din browser rămân intacte.

Parcarea, barierele, emailurile, Stripe, Netopia și facturile Oblio sunt simulate. Administrarea angajaților și resetările parolelor sunt fictive, fără conturi reale; parolele introduse nu sunt salvate. Endpointurile `/api/*`, `/lpr/*` și `/NotificationInfo/*` sunt respinse de middleware cu 403.

## Verificare

```sh
npm run test:demo
npm run check:types
npm run build
```

## Vercel

1. Selectează Next.js și directorul acestui proiect (`next-js` dacă încarci directorul părinte).
2. Nu adăuga variabile de mediu sau credențiale. Elimină variabilele Firebase și de servicii reale din configurația Vercel existentă.
3. Build Command: `npm run build`; Install Command: `npm ci`.
4. Publică și deschide `/`. Verifică o modificare de rezervare și reîncărcarea paginii.

Publicarea pe Vercel este făcută de proprietar. Nu sunt necesare conturi Firebase, chei server sau configurări de domenii în servicii externe.
