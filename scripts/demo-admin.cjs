const path=require('node:path');
const {PROJECT_ID}=require('./demo-fixtures.cjs');
function localCliCredential(){
 const base=process.env.FIREBASE_CLI_LIB||'/opt/homebrew/Cellar/firebase-cli/14.11.0/libexec/lib/node_modules/firebase-tools/lib';
 const auth=require(path.join(base,'auth.js'));const api=require(path.join(base,'apiv2.js'));
 const account=auth.getAllAccounts().find(a=>a.user.email==='adrian@webdynamicx.ro');
 if(!account)throw new Error('Expected Firebase CLI account');auth.setActiveAccount({},account);
 return {getAccessToken:async()=>({access_token:await api.getAccessToken(),expires_in:3000})};
}
function initDemoAdmin(){
 const {initializeApp,cert}=require('firebase-admin/app');
 if(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==PROJECT_ID)throw new Error('Wrong demo project');
 let credential;
 if(process.argv.includes('--local-cli'))credential=require('firebase-admin/app').applicationDefault();
 else{const key=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}');if(key.project_id!==PROJECT_ID)throw new Error('Wrong service account project');credential=cert(key);}
 return initializeApp({projectId:PROJECT_ID,credential});
}
module.exports={localCliCredential,initDemoAdmin};
