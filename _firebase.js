const admin = require('firebase-admin');
function getAdmin(){
  if(!admin.apps.length){
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if(!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured in Vercel.');
    let serviceAccount;try{serviceAccount=JSON.parse(raw)}catch{throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.');}
    admin.initializeApp({credential:admin.credential.cert(serviceAccount),projectId:process.env.FIREBASE_PROJECT_ID||serviceAccount.project_id});
  }
  return {auth:admin.auth(),db:admin.firestore(),admin};
}
async function verify(req,requireAdmin=false){
  const header=req.headers.authorization||'';if(!header.startsWith('Bearer ')){const e=new Error('Missing Firebase ID token.');e.status=401;throw e;}
  const {auth}=getAdmin();const decoded=await auth.verifyIdToken(header.slice(7),true);
  if(requireAdmin&&decoded.super_admin!==true){const e=new Error('Super Admin permission required.');e.status=403;throw e;}
  return decoded;
}
function send(res,status,body){res.status(status).setHeader('Content-Type','application/json').end(JSON.stringify(body));}
module.exports={getAdmin,verify,send};
