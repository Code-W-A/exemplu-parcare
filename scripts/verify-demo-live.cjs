const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');require('@next/env').loadEnvConfig(path.resolve(__dirname,'..'));
const origin=process.env.DEMO_TEST_ORIGIN||'http://localhost:3017';
const project='parcari-admin-demo-20261004';if(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==project)throw new Error('Wrong demo project');
const creds=JSON.parse(fs.readFileSync(path.join(__dirname,'../.demo-credentials.local.json')));
async function main(){
 const auth=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+process.env.NEXT_PUBLIC_FIREBASE_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:creds.email,password:creds.password,returnSecureToken:true})});
 const login=await auth.json();assert.equal(auth.status,200,login.error?.message);assert.equal(JSON.parse(Buffer.from(login.idToken.split('.')[1],'base64url')).role,'admin');
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+login.idToken,Origin:origin};
 const session=await fetch(origin+'/api/admin/session',{method:'POST',headers});assert.equal(session.status,200);
 const cookie=session.headers.get('set-cookie').split(';')[0];headers.Cookie=cookie;
 const unauthorized=await fetch(origin+'/api/admin/occupancy');assert.equal(unauthorized.status,401);
 const occupancy=await fetch(origin+'/api/admin/occupancy',{headers});assert.equal(occupancy.status,200);const occupancyBody=await occupancy.json();assert.ok(occupancyBody);
 const base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
 const unauth=await fetch(base+'/bookings/demo-booking-001');assert.equal(unauth.status,403);
 const bookings=await fetch(base+'/bookings?pageSize=200',{headers});const list=await bookings.json();assert.equal(bookings.status,200);assert.ok(list.documents.length>=100);
 const invoice=await fetch(origin+'/api/admin/bookings/retry-oblio-invoice',{method:'POST',headers,body:JSON.stringify({bookingId:'demo-booking-001'})});assert.equal(invoice.status,200);assert.equal((await invoice.json()).success,true);
 const email=await fetch(origin+'/api/admin/bookings/send-cancel-confirmation',{method:'POST',headers,body:JSON.stringify({bookingId:'demo-booking-001'})});assert.equal(email.status,200);assert.equal((await email.json()).simulated,true);
 const approve=await fetch(origin+'/api/admin/bookings/modification-requests/demo-modification-001/approve',{method:'POST',headers});const approval=await approve.json();assert.equal(approve.status,200,JSON.stringify(approval));assert.equal(approval.success,true,JSON.stringify(approval));
 const edited=await fetch(base+'/bookings/demo-booking-086',{headers});const editedDoc=await edited.json();assert.equal(editedDoc.fields.startTime.stringValue,'10:00');
 for(const endpoint of ['/api/webhook','/api/create-payment-intent','/api/wp-booking','/api/wp-card-booking','/api/send-confirmation-email','/api/test-oblio-auth','/api/cron/process-queue','/api/mobile/bookings','/lpr/cameras/hikvision/results','/NotificationInfo/TollgateInfo']){
  const response=await fetch(origin+endpoint,{method:'POST',headers,body:'{}'});assert.equal(response.status,403,endpoint);
 }
 console.log(JSON.stringify({authRole:'admin',bookings:list.documents.length,unauthorizedApi:401,unauthorizedFirestore:403,invoice:'simulated',email:'simulated',modification:'persisted',blockedExternalEndpoints:10}));
}
main().catch(e=>{console.error(e.message);process.exit(1)});
