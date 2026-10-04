# Verificare demo — 4 octombrie 2026

Firebase: parcari-admin-demo-20261004; Firestore eur3, fără facturare și fără Functions. 100 rezervări fictive, 30 tarife, 4 numere whitelist, configurații de ocupare și cerere de modificare. Admin cu custom claim role=admin; datele de acces sunt numai în .demo-credentials.local.json.

## Verificat

- TypeScript separat: npm run check:types, succes.
- Build Next.js, succes, cu credential ADC temporar local.
- 2 teste ale generatorului de date, succes.
- Verificare live API: autentificare admin, acces fără autentificare respins (API 401, Firestore 403), email/factură simulate, editare prin cerere de modificare și citire ulterioară din Firestore; 10 endpointuri externe directe respinse 403.
- Acțiuni server: acces anonim respins, creare manuală, recuperare api_error, anulare simulată, ștergere cu arhivare. Persistența verificată prin citiri noi din Firebase.
- Editare și intrare/ieșire prin Firestore autentificat: reguli și persistență verificate. Acest test nu execută toate controalele UI de intrare/ieșire.
- Browser: autentificare, dashboard cu grafice, rezervări, creare manuală și reîncărcare, prețuri, intrări/ieșiri, ocupare, whitelist, conturi angajați, recovery și Test API. Test API folosește simulatorul.
- Datele generate au fost repopulate după testele care modifică rezervările, astfel încât scenariile de eroare și cererea de modificare să rămână disponibile.

## Rămâne

- Cheia serverului: politica Google Cloud blochează generarea. Excepția aprobată pentru proiectul demo nu a fost aplicată, din lipsa drepturilor orgpolicy.policies.create. Nicio politică organizațională nu a fost modificată.
- Alternativa Vercel OIDC necesită alegerea utilizatorului și identificatorii exacți ai echipei/proiectului; nu este configurată.
- Publicarea Vercel și verificarea domeniului final aparțin utilizatorului. Nu s-a publicat și nu s-au transmis secrete în Vercel.
- Verificările locale nu reprezintă dovada funcționării pe domeniul final.

Arhiva de predare exclude Git, .env.local, credențialele admin, credential ADC, node_modules, build și Functions. Variabilele reale demo se configurează privat de proprietar, conform README_DEMO.md.
