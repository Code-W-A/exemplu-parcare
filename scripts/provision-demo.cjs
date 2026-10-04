// One-time local setup using the already authenticated Firebase CLI account.
// Never prints access tokens, private keys or passwords.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cliRoot = process.env.FIREBASE_CLI_LIB || '/opt/homebrew/Cellar/firebase-cli/14.11.0/libexec/lib/node_modules/firebase-tools/lib';
const cliAuth = require(path.join(cliRoot, 'auth.js'));
const api = require(path.join(cliRoot, 'apiv2.js'));
const project = 'parcari-admin-demo-20261004';
const root = path.resolve(__dirname, '..');
const account = cliAuth.getAllAccounts().find(x => x.user.email === 'adrian@webdynamicx.ro');
if (!account) throw new Error('Expected Firebase CLI account not authenticated');
cliAuth.setActiveAccount({}, account);
async function req(host, method, endpoint, body) {
  const result = await new api.Client({urlPrefix:host}).request({method, path:endpoint, body});
  return result.body;
}
async function main() {
  // Enable only the services used by Auth and server credentials; no billing.
  for (const service of ['identitytoolkit.googleapis.com','iam.googleapis.com','firestore.googleapis.com']) {
    const op = await req('https://serviceusage.googleapis.com','POST',`/v1/projects/${project}/services/${service}:enable`,{});
    if (op.name && !op.done) for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,1000));const status=await req('https://serviceusage.googleapis.com','GET','/v1/'+op.name);if(status.error)throw new Error(status.error.message);if(status.done)break;}
    console.log('Enabled', service);
  }
  try { await req('https://firestore.googleapis.com','POST',`/v1/projects/${project}/databases?databaseId=(default)`,{locationId:'eur3',type:'FIRESTORE_NATIVE'}); } catch(e) { if (!String(e.message).includes('already exists')) throw e; }
  let config;
  for (let attempt=0;attempt<8;attempt++) {
    try {
      config = await req('https://identitytoolkit.googleapis.com','PATCH',`/admin/v2/projects/${project}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains`,{signIn:{email:{enabled:true,passwordRequired:true}},authorizedDomains:['localhost',`${project}.firebaseapp.com`,`${project}.web.app`]});break;
    } catch(e) { if (attempt===7) throw e; await new Promise(r=>setTimeout(r,3000)); }
  }
  console.log('Configured Email/Password auth');
  const app = await req('https://firebase.googleapis.com','GET',`/v1beta1/projects/${project}/webApps/1:364601679721:web:a9e50b302d806ced1c27f8/config`);
  const email = `demo-admin@${project}.iam.gserviceaccount.com`;
  try { await req('https://iam.googleapis.com','POST',`/v1/projects/${project}/serviceAccounts`,{accountId:'demo-admin',serviceAccount:{displayName:'Demo Next.js Admin'}}); }
  catch(e) { if (!String(e.message).includes('already exists')) throw e; }
  const policy = await req('https://cloudresourcemanager.googleapis.com','POST',`/v1/projects/${project}:getIamPolicy`,{});
  for (const role of ['roles/datastore.user','roles/firebaseauth.admin']) {
    let binding = policy.bindings.find(x=>x.role===role);
    if (!binding) { binding={role,members:[]};policy.bindings.push(binding); }
    if (!binding.members.includes('serviceAccount:'+email)) binding.members.push('serviceAccount:'+email);
  }
  await req('https://cloudresourcemanager.googleapis.com','POST',`/v1/projects/${project}:setIamPolicy`,{policy});
  const envFile = path.join(root,'.env.local');
  let serviceAccount;
  if (!process.argv.includes('--local-cli')) {
    if (fs.existsSync(envFile)) {
      const line=fs.readFileSync(envFile,'utf8').split('\n').find(x=>x.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
      if(line)serviceAccount=JSON.parse(line.split('=').slice(1).join('=').replace(/^'|'$/g,''));
    }
    if (!serviceAccount) {
      let key;
      for(let attempt=0;attempt<30;attempt++) {
        try { key=await req('https://iam.googleapis.com','POST',`/v1/projects/${project}/serviceAccounts/${email}/keys`,{privateKeyType:'TYPE_GOOGLE_CREDENTIALS_FILE'});break; }
        catch(e){if(attempt===29||!String(e.message).includes('org policy'))throw e;await new Promise(r=>setTimeout(r,3000));}
      }
      serviceAccount=JSON.parse(Buffer.from(key.privateKeyData,'base64').toString());
    }
    if(serviceAccount.project_id!==project)throw new Error('Wrong project in credentials');
  }
  const vars={NEXT_PUBLIC_DEMO_MODE:'true',DEMO_MODE:'true',NEXT_PUBLIC_FIREBASE_API_KEY:app.apiKey,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:app.authDomain,NEXT_PUBLIC_FIREBASE_PROJECT_ID:app.projectId,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:app.storageBucket||'',NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:app.messagingSenderId,NEXT_PUBLIC_FIREBASE_APP_ID:app.appId,NEXT_PUBLIC_APP_URL:'http://localhost:3000',LPR_ENABLED:'false'};
  if(serviceAccount)vars.FIREBASE_SERVICE_ACCOUNT_KEY=JSON.stringify(serviceAccount);
  fs.writeFileSync(envFile,Object.entries(vars).map(([k,v])=>k+"='"+String(v)+"'").join('\n')+'\n',{mode:0o600});fs.chmodSync(envFile,0o600);
  const {initializeApp,cert}=require('firebase-admin/app');
  const {getAuth}=require('firebase-admin/auth');
  const {getFirestore}=require('firebase-admin/firestore');
  const adminApp=initializeApp({projectId:project,credential:serviceAccount?cert(serviceAccount):require('firebase-admin/app').applicationDefault()});
  const auth=getAuth(adminApp);
  const loginEmail='admin@parcari-demo.example.com';
  const password=crypto.randomBytes(20).toString('base64url')+'aA9!';
  let user;
  for(let attempt=0;attempt<10;attempt++) {
    try {
      try {user=await auth.getUserByEmail(loginEmail);}
      catch(e) {if(e.code!=='auth/user-not-found')throw e;user=await auth.createUser({email:loginEmail,password,displayName:'Administrator Demo',emailVerified:true});}
      await auth.updateUser(user.uid,{password});
      await auth.setCustomUserClaims(user.uid,{role:'admin'});break;
    }catch(e){if(attempt===9)throw e;await new Promise(r=>setTimeout(r,3000));}
  }
  await getFirestore(adminApp).collection('users').doc(user.uid).set({name:'Administrator Demo',email:loginEmail,role:'admin',demoSeed:true});
  fs.writeFileSync(path.join(root,'.demo-credentials.local.json'),JSON.stringify({projectId:project,email:loginEmail,password,uid:user.uid},null,2)+'\n',{mode:0o600});
  console.log('Demo configured. Credentials stored privately in .demo-credentials.local.json; environment in .env.local.');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
