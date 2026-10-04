// Explicitly approved, project-scoped, temporary exception for generating one demo key.
const path=require('node:path');const base=process.env.FIREBASE_CLI_LIB||'/opt/homebrew/Cellar/firebase-cli/14.11.0/libexec/lib/node_modules/firebase-tools/lib';
const auth=require(path.join(base,'auth.js'));const {Client}=require(path.join(base,'apiv2.js'));
const project='parcari-admin-demo-20261004', number='364601679721';
const account=auth.getAllAccounts().find(x=>x.user.email==='adrian@webdynamicx.ro');if(!account)throw new Error('Wrong account');auth.setActiveAccount({},account);
async function req(host,method,endpoint,body){return (await new Client({urlPrefix:host}).request({method,path:endpoint,body,headers:{"x-goog-user-project":project}})).body}
async function main(){
 const member='user:adrian@webdynamicx.ro';
 const policy=await req('https://cloudresourcemanager.googleapis.com','POST',`/v1/projects/${project}:getIamPolicy`,{});
 let binding=policy.bindings.find(b=>b.role==='roles/orgpolicy.policyAdmin');
 if(process.argv.includes('--restore')){
  await req('https://orgpolicy.googleapis.com','DELETE',`/v2/projects/${number}/policies/iam.managed.disableServiceAccountKeyCreation`);
  const fs=require('node:fs'), state=path.join(__dirname,'../.demo-policy.local.json');
  if(fs.existsSync(state)&&JSON.parse(fs.readFileSync(state)).addedMember){
   if(binding)binding.members=binding.members.filter(m=>m!==member);policy.bindings=policy.bindings.filter(b=>b.members.length);
   await req('https://cloudresourcemanager.googleapis.com','POST',`/v1/projects/${project}:setIamPolicy`,{policy});fs.unlinkSync(state);
  }
  console.log('Restored inherited key policy; temporary project permission removed.');return;
 }
 const fs=require('node:fs'), state=path.join(__dirname,'../.demo-policy.local.json');
 let addedMember=false;
 fs.writeFileSync(state,JSON.stringify({project,addedMember}),{mode:0o600});
 const op=await req('https://serviceusage.googleapis.com','POST',`/v1/projects/${project}/services/orgpolicy.googleapis.com:enable`,{});
 if(op.name&&!op.done)for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,1000));if((await req('https://serviceusage.googleapis.com','GET','/v1/'+op.name)).done)break;}
 const name=`projects/${number}/policies/iam.managed.disableServiceAccountKeyCreation`;
 for(let i=0;i<10;i++)try {await req('https://orgpolicy.googleapis.com','POST',`/v2/projects/${number}/policies`,{name,spec:{rules:[{enforce:false}]}});break;}catch(e){if(String(e.message).includes('already exists')){console.log('Project exception already exists');break;}if(i===9)throw e;await new Promise(r=>setTimeout(r,3000));}
 console.log('Temporary key-generation exception enabled only for '+project);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
