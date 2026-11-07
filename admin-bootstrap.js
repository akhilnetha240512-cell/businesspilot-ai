const {getAdmin,verify,send}=require('./_firebase');
module.exports=async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 try{
  const decoded=await verify(req,false);const {auth,db}=getAdmin();
  const marker=db.doc('application_settings/adminBootstrap');const snap=await marker.get();
  if(snap.exists){if(decoded.super_admin===true)return send(res,200,{ok:true,alreadyInitialized:true});return send(res,403,{error:'Admin bootstrap is already locked.'});}
  const expectedUid=process.env.SUPER_ADMIN_UID,expectedEmail=(process.env.SUPER_ADMIN_EMAIL||'').toLowerCase();
  if(!expectedUid||!expectedEmail)return send(res,503,{error:'Super Admin bootstrap environment variables are not configured.'});
  if(decoded.uid!==expectedUid||String(decoded.email||'').toLowerCase()!==expectedEmail)return send(res,403,{error:'This account is not authorized for first-time Super Admin setup.'});
  const userRecord=await auth.getUser(decoded.uid);
  await auth.setCustomUserClaims(decoded.uid,{...(userRecord.customClaims||{}),super_admin:true});
  await marker.create({initialized:true,uid:decoded.uid,email:expectedEmail,initializedAt:require('firebase-admin').firestore.FieldValue.serverTimestamp()});
  return send(res,200,{ok:true,initialized:true,refreshToken:true});
 }catch(e){return send(res,e.status||500,{error:e.message||'Bootstrap failed'});}
};
