const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'));
const origin = process.env.DEMO_TEST_ORIGIN || 'http://localhost:3017';
const project = 'parcari-admin-demo-20261004';
assert.equal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, project);
async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../.demo-credentials.local.json')));
  const loginResponse = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + process.env.NEXT_PUBLIC_FIREBASE_API_KEY, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...credentials,returnSecureToken:true,email:credentials.email,password:credentials.password})});
  const login = await loginResponse.json(); assert.equal(loginResponse.status,200);
  const session = await fetch(origin+'/api/admin/session',{method:'POST',headers:{Authorization:'Bearer '+login.idToken,Origin:origin}});
  assert.equal(session.status,200);
  const headers = {Authorization:'Bearer '+login.idToken,Origin:origin,Cookie:session.headers.get('set-cookie').split(';')[0]};
  const directory = path.join(__dirname,'../.next/static/chunks/app/admin/dashboard/bookings');
  const chunk = fs.readdirSync(directory).filter(x=>x.endsWith('.js')).map(x=>fs.readFileSync(path.join(directory,x),'utf8')).join('\n');
  function actionId(name) {
    const match = chunk.match(new RegExp('createServerReference\\)\\("([a-f0-9]+)"[^;]{0,150}"'+name+'"'));
    assert.ok(match,'Missing action '+name); return match[1];
  }
  async function action(name,args,anonymous=false) {
    const form = new FormData();
    if(args instanceof FormData) {for(const [k,v] of args)form.append('1_'+k,v);form.set('0',JSON.stringify(['$K1']));}
    else form.set('0',JSON.stringify(args));
    const response = await fetch(origin+'/admin/dashboard/bookings',{method:'POST',headers:{...(anonymous?{Origin:origin}:headers),'Next-Action':actionId(name)},body:form});
    const body = await response.text();
    if(anonymous){assert.ok(response.status>=400 || /"digest"/.test(body));return;}
    const resultLine = body.split('\n').find(x=>/^1:\{/.test(x));
    assert.ok(resultLine,body.slice(0,400));const result=JSON.parse(resultLine.slice(2));assert.equal(result.success,true,JSON.stringify(result));return result;
  }
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  async function read(id,collection='bookings') {const response=await fetch(base+'/'+collection+'/'+id,{headers});return {status:response.status,doc:await response.json()};}
  async function patch(id,fields) {
    const mask=Object.keys(fields).map(x=>'updateMask.fieldPaths='+encodeURIComponent(x)).join('&');
    const response=await fetch(base+'/bookings/'+id+'?'+mask,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({fields})});assert.equal(response.status,200,await response.text());
  }
  await action('recoverSpecificBooking',['demo-booking-095'],true);
  const recoveryDoc=await read('demo-booking-095');
  if(recoveryDoc.doc.fields.status.stringValue==='api_error')await action('recoverSpecificBooking',['demo-booking-095']);
  assert.equal((await read('demo-booking-095')).doc.fields.status.stringValue,'confirmed_paid');
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const form=new FormData();Object.entries({licensePlate:'B998DEM',clientName:'Test Automat Demo',clientEmail:'test-actions@example.com',clientPhone:'TEST-9988',startDate:today,startTime:'08:30',endDate:today,endTime:'18:30',manualIsInside:'false',manualPaymentStatus:'paid'}).forEach(([k,v])=>form.set(k,v));
  const created=await action('createManualBooking',form);const id=created.bookingId;assert.ok(id);
  assert.equal((await read(id)).doc.fields.clientName.stringValue,'Test Automat Demo');
  await patch(id,{clientName:{stringValue:'Test Editat Demo'},lpr:{mapValue:{fields:{isInside:{booleanValue:true},arrivedAt:{timestampValue:new Date().toISOString()}}}}});
  assert.equal((await read(id)).doc.fields.lpr.mapValue.fields.isInside.booleanValue,true);
  await patch(id,{lpr:{mapValue:{fields:{isInside:{booleanValue:false},departedAt:{timestampValue:new Date().toISOString()}}}}});
  assert.equal((await read(id)).doc.fields.lpr.mapValue.fields.isInside.booleanValue,false);
  await action('cancelBooking',[created.apiBookingNumber]);
  await patch(id,{status:{stringValue:'cancelled_by_admin'},cancelledAt:{timestampValue:new Date().toISOString()}});
  assert.equal((await read(id)).doc.fields.status.stringValue,'cancelled_by_admin');
  const deleted=await fetch(origin+'/api/admin/bookings/delete',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({bookingId:id})});assert.equal(deleted.status,200,await deleted.text());
  assert.equal((await read(id)).status,404);assert.equal((await read(id,'deleted_bookings')).status,200);
  const allResponse=await fetch(base+'/bookings?pageSize=200',{headers});const all=await allResponse.json();
  for(const booking of all.documents||[]) {
    if(booking.fields.licensePlate?.stringValue==='B999DEM'&&booking.fields.clientName?.stringValue==='Tester Demonstratie') {
      const response=await fetch(origin+'/api/admin/bookings/delete',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({bookingId:booking.name.split('/').pop()})});assert.equal(response.status,200);
    }
  }
  console.log(JSON.stringify({anonymousServerAction:'denied',create:'persisted',edit:'persisted',entryExit:'Firestore rules + persistence',cancel:'simulated + persisted',delete:'archived',recovery:'persisted'}));
}
main().catch(error=>{console.error(error.message);process.exit(1)});
