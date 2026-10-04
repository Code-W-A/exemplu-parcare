# Panou admin demo

Acest director `next-js` este copia de test. Folosește exclusiv Firebase `parcari-admin-demo-20261004` și nu poate fi conectat accidental la alt proiect. Modificările în panou sunt salvate în Firestore. Datele sunt fictive; parcarea, barierele, emailurile, plățile și facturile sunt simulate. Handler-ele API externe, mobile și LPR au fost scoase; middleware-ul demo le respinge cu 403. Paginile publice de rezervare nu sunt disponibile în această livrare.

Rutele `/api/admin/*` sunt endpointuri Next.js interne folosite de panou pentru sesiune, utilizatori, ocupare și administrarea rezervărilor în Firebase. Le păstrăm; ele nu apelează servicii externe. Firebase Admin se inițializează la prima cerere, nu la importul rutelor în timpul build-ului. Build-ul poate trece fără credențiale server, dar operațiile admin server-side cer o credențială privată validă pentru același proiect demo. O cheie din alt proiect este respinsă la execuție.

## Rulare locală

```sh
npm ci
node scripts/local-demo-adc.cjs
DEMO_LOCAL_ADC=true GOOGLE_APPLICATION_CREDENTIALS=/private/tmp/parcari-demo-local-adc.json npm run dev
```

Autentificarea locală temporară folosește contul Firebase CLI `adrian@webdynamicx.ro`. Fișierul ADC se scrie privat în `/private/tmp`, în afara sursei, și nu se transmite testerului sau Vercel. Scriptul presupune Firebase CLI 14.11.0 instalat prin Homebrew; pentru altă instalare setează `FIREBASE_CLI_LIB`.

Deschide http://localhost:3000/admin/login. Configurația demo este în `.env.local`. Emailul și parola administratorului sunt în `.demo-credentials.local.json`. Ambele fișiere sunt private și ignorate de Git. Nu le trimite testerului; acesta primește numai contul admin.

## Vercel — publici tu

**Blocaj actual:** cheia serverului NU a putut fi generată. Politica organizației interzice crearea cheilor, iar contul curent nu are `orgpolicy.policies.create`. Excepția aprobată de utilizator nu a fost aplicată; politicile organizației sunt neschimbate. Un administrator Google Cloud trebuie să permită crearea cheilor numai în proiectul `parcari-admin-demo-20261004`, după care se generează cheia pentru `demo-admin@parcari-admin-demo-20261004.iam.gserviceaccount.com`. Alternativa este acces prin Vercel OIDC, care necesită configurarea explicită a identității echipei/proiectului Vercel. Codul actual folosește cheia, nu OIDC.

Fără cheia serverului, deploymentul Vercel nu este gata. Nu configura `DEMO_LOCAL_ADC` pe Vercel; această cale este refuzată acolo. Pașii de mai jos se aplică după rezolvarea accesului.

1. Încarcă sursa acestui director și selectează framework-ul Next.js. Dacă încarci întregul repository, setează Root Directory `next-js`.
2. Adaugă variabilele din `.env.local` în Environment Variables pentru mediul în care vei publica. `.env.example` arată numele lor. Pentru `FIREBASE_SERVICE_ACCOUNT_KEY`, introdu JSON-ul propriu-zis pe un singur rând, fără ghilimelele exterioare din fișierul dotenv. Nu prefixa această variabilă cu `NEXT_PUBLIC_`.
3. Setează `NEXT_PUBLIC_APP_URL` la adresa HTTPS a panoului. Nu adăuga credențiale Stripe, Netopia, email sau Oblio.
4. În Firebase → Authentication → Settings → Authorized domains, adaugă numai hostname-ul Vercel (fără `https://`).
5. Publică și verifică `/admin/login`, apoi o modificare de rezervare și reîncărcarea paginii. Configurația Firebase din browser se fixează la build: după schimbarea variabilelor este necesar un nou deployment.

Nu am publicat pe Vercel. Domeniul final nu este încă disponibil pentru verificare.

## Date de test

```sh
GOOGLE_APPLICATION_CREDENTIALS=/private/tmp/parcari-demo-local-adc.json npm run seed:demo -- --local-cli
GOOGLE_APPLICATION_CREDENTIALS=/private/tmp/parcari-demo-local-adc.json npm run seed:demo -- --local-cli --reset
```

100 de rezervări, 30 de tarife, whitelist, ocupare și o cerere de modificare în așteptare. Datele se raportează la ziua rulării în `Europe/Bucharest`. Seed-ul actualizează documentele proprii cu ID stabil. `--reset` șterge numai documentele marcate `demoSeed: true` din colecțiile demonstrative și păstrează conturile de autentificare. Contoarele sunt recalculate din toate rezervările rămase. Aceste comenzi scriu doar în proiectul demo indicat explicit în script; credențialele altui proiect sunt refuzate.

## Verificări

```sh
npm run test:demo
npm run check:types
DEMO_LOCAL_ADC=true GOOGLE_APPLICATION_CREDENTIALS=/private/tmp/parcari-demo-local-adc.json npm run build
```

Regulile și indexurile sunt în `firestore.rules` și `firestore.indexes.json`. Configurația `firebase.json` nu include Functions sau Hosting. `scripts/provision-demo.cjs` este un script local de inițializare pentru contul autorizat, nu se rulează în Vercel; reluarea lui resetează parola demo. Fișierele private și `node_modules`/`.next` nu trebuie incluse într-o arhivă pentru tester.
