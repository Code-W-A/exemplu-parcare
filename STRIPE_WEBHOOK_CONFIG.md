# 📋 Configurare Webhook Stripe - Ghid Complet

## 1. Accesează Stripe Dashboard

1. Intră pe https://dashboard.stripe.com
2. Asigură-te că ești pe contul corect (test/live)

## 2. Configurarea Webhook-ului

### Pasul 1: Creează webhook-ul
- Mergi la **Developers** → **Webhooks**
- Click pe **+ Add endpoint**

### Pasul 2: Setează URL-ul
- **Endpoint URL**: `https://your-domain.com/api/webhook`
- Exemplu: `https://site-parcari.vercel.app/api/webhook`

### Pasul 3: Selectează evenimentele
Bifează doar:
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed` (opțional, pentru debugging)

### Pasul 4: Salvează și copiază secretul
- Click **Add endpoint**
- Click pe webhook-ul creat
- În secțiunea **Signing secret**, click **Reveal** și copiază valoarea
- Aceasta va fi `STRIPE_WEBHOOK_SECRET`

## 3. Variabile de mediu necesare

Adaugă în `.env.local`:

```env
# Stripe Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # sau pk_live_... pentru production
STRIPE_SECRET_KEY=sk_test_... # sau sk_live_... pentru production
STRIPE_WEBHOOK_SECRET=whsec_... # Secretul de la webhook-ul creat mai sus

# API Parcare (deja le ai)
PARKING_API_URL=http://127.0.0.1:7001/MultiparkWeb_eServices/booking_submit
PARKING_API_USERNAME=DEMO
PARKING_API_PASSWORD=DEMO-NO-SECRET
PARKING_MULTIPARK_ID=001#002
```

## 4. Testarea Webhook-ului

### Test local cu Stripe CLI:
```bash
# Instalează Stripe CLI
npm install -g @stripe/stripe-cli

# Login în Stripe
stripe login

# Forward events către localhost
stripe listen --forward-to localhost:3000/api/webhook
```

### Test în production:
1. Fă o plată test
2. Verifică în Stripe Dashboard → Webhooks → [webhook-ul tău] → **Recent deliveries**
3. Vezi dacă sunt delivery-uri cu status 200

## 5. Debugging Webhook

### Verifică în logs:
- Stripe Dashboard → Webhooks → Recent deliveries
- Vercel/hosting logs pentru `/api/webhook`

### Status codes:
- **200**: Success ✅
- **400**: Bad request (signature error) ❌
- **500**: Server error ❌

## 6. Fluxul complet verificat:

1. **User completează formular** → `OrderPlacementForm`
2. **Se creează PaymentIntent** → `/api/create-payment-intent`
3. **User plătește** → Stripe procesează
4. **Webhook primește confirmare** → `/api/webhook`
5. **Se salvează rezervarea** → `createBookingWithFirestore`
6. **User este redirecționat** → `/confirmare`

## 🚨 Important pentru Production:

- Schimbă `pk_test_` cu `pk_live_` 
- Schimbă `sk_test_` cu `sk_live_`
- Webhook-ul trebuie setat pentru environment-ul corect (test/live)
- Testează webhook-ul înainte de lansare

## 📞 Support:
- Webhook-ul tău: `https://your-domain.com/api/webhook`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
- Toate datele se salvează automat în Firestore și se trimit la API-ul de parcare 