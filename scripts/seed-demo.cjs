const path=require('node:path');
require('@next/env').loadEnvConfig(path.resolve(__dirname,'..'));
const {initializeApp,cert}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {PROJECT_ID,makeFixtures}=require('./demo-fixtures.cjs');
const target=process.argv.find(x=>x.startsWith('--project='))?.slice(10);
if(target!==PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==PROJECT_ID)throw new Error('Pass --project='+PROJECT_ID+' and configure the same demo project');
const {initDemoAdmin}=require('./demo-admin.cjs');
const db=getFirestore(initDemoAdmin());
async function seed(){
 const {today,rows}=makeFixtures();
 if(process.argv.includes('--reset')) {
  for(const collection of ['bookings','bookingModificationRequests','prices','lpr_whitelist','deleted_bookings','lpr_events']) {
   const snap=await db.collection(collection).where('demoSeed','==',true).get();
   for(const doc of snap.docs)await db.recursiveDelete(doc.ref);
  }
 }
 // Refuse to overwrite a document that was not created by this script.
 for(const row of rows){const existing=await db.collection(row.collection).doc(row.id).get();if(existing.exists && existing.data().demoSeed!==true)throw new Error('Refusing non-seeded document '+row.id);}
 const batch=db.batch();
 for(const row of rows)batch.set(db.collection(row.collection).doc(row.id),row.data);
 await batch.commit();
 const bookings=await db.collection('bookings').get();
 const occupied=bookings.docs.filter(d=>d.data().lpr?.isInside===true).length;
 const active=bookings.docs.filter(d=>!['expired','cancelled_by_admin','cancelled_by_api','api_error'].includes(d.data().status)).length;
 const settings={reservationSettings:{maxTotalReservations:150,reservationsEnabled:true},parkingLive:{occupiedCount:occupied,lastUpdated:FieldValue.serverTimestamp()},reservationStats:{activeBookingsCount:active,lastUpdated:FieldValue.serverTimestamp()},pricingSettings:{mobileOnlineDiscountPercent:20},mobileAppSettings:{paymentProvider:'stripe',payOnSiteEnabled:true,testPaymentEnabled:true,loyaltyProgram:{enabled:true,reservationsPerFreeDay:4,freeDayHours:24}}};
 for(const [id,data]of Object.entries(settings))await db.collection('config').doc(id).set({...data,demoSeed:true},{merge:true});
 await db.collection('ops_alerts').doc('oblio').set({status:'ok',demoSeed:true,message:'Facturare simulată'});
 console.log(JSON.stringify({project:PROJECT_ID,date:today,seededBookings:100,totalBookings:bookings.size,occupied,priceTiers:30}));
}
seed().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
