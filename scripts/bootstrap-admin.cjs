// Run only as a trusted project operator with Application Default Credentials.
const {createRequire}=require('node:module');
const load=createRequire(require('node:path').resolve(__dirname,'../functions/package.json'));
const {initializeApp,applicationDefault}=load('firebase-admin/app');
const {getAuth}=load('firebase-admin/auth');const {getFirestore}=load('firebase-admin/firestore');
async function main(){
 if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Use seed-emulator.cjs for local test users');
 const email=process.env.SALESAPP_ADMIN_EMAIL,name=process.env.SALESAPP_ADMIN_NAME,password=process.env.SALESAPP_ADMIN_PASSWORD;
 if(!email||!name)throw Error('Set SALESAPP_ADMIN_EMAIL and SALESAPP_ADMIN_NAME. For a new Auth user also set SALESAPP_ADMIN_PASSWORD (12+ characters).');
 const app=initializeApp({credential:applicationDefault(),projectId:'salesapp-aaa7b'});
 const auth=getAuth(app);let user;try{user=await auth.getUserByEmail(email);}catch(e){if(e.code!=='auth/user-not-found')throw e;if(!password||password.length<12)throw Error('An initial password of at least 12 characters is required');user=await auth.createUser({email,displayName:name,password});}
 await getFirestore(app).doc(`users/${user.uid}`).set({uid:user.uid,name,email,role:'Admin',active:true,branchId:'',updatedAt:new Date().toISOString()});
 console.log('Salesapp Admin profile provisioned:',user.uid);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
