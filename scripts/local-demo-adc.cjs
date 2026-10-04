// Temporary local verification only; writes outside the deliverable, never for Vercel.
const fs=require('node:fs');const path=require('node:path');
const base=process.env.FIREBASE_CLI_LIB||'/opt/homebrew/Cellar/firebase-cli/14.11.0/libexec/lib/node_modules/firebase-tools/lib';
const auth=require(path.join(base,'auth.js'));const api=require(path.join(base,'api.js'));
const account=auth.getAllAccounts().find(x=>x.user.email==='adrian@webdynamicx.ro');if(!account)throw new Error('Wrong CLI account');
const file='/private/tmp/parcari-demo-local-adc.json';
fs.writeFileSync(file,JSON.stringify({type:'authorized_user',client_id:api.clientId(),client_secret:api.clientSecret(),refresh_token:account.tokens.refresh_token,quota_project_id:'parcari-admin-demo-20261004'}),{mode:0o600});fs.chmodSync(file,0o600);
console.log('Temporary local ADC prepared outside project; no token printed.');
