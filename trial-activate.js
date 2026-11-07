const {getAdmin,verify,send}=require('./_firebase');
module.exports=async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 try{
  const user=await verify(req,false);const {db,admin}=getAdmin();const subRef=db.collection('subscriptions').doc(user.uid);const trialRef=db.collection('trial_claims').doc(user.uid);const configSnap=await db.doc('application_settings/platform').get();const trialDays=Number(configSnap.exists?configSnap.data().trialDays??7:7);
  if(trialDays<=0)return send(res,409,{error:'Premium trials are currently disabled.'});
  let result;
  await db.runTransaction(async tx=>{
   const [claim,sub]=await Promise.all([tx.get(trialRef),tx.get(subRef)]);
   if(claim.exists)throw new Error('The Premium trial has already been used on this account.');
   if(sub.exists&&sub.data().status==='active'&&sub.data().expiresAt?.toMillis?.()>Date.now())throw new Error('An active subscription already exists.');
   const now=admin.firestore.Timestamp.now(),expiry=admin.firestore.Timestamp.fromMillis(now.toMillis()+trialDays*86400000);
   tx.create(trialRef,{userUid:user.uid,claimedAt:now,trialDays});
   tx.set(subRef,{userUid:user.uid,packageName:'Premium Trial',plan:'combined',amount:0,status:'active',startedAt:now,expiresAt:expiry,source:'7_day_trial',updatedAt:now},{merge:true});
   tx.set(db.collection('audit_logs').doc(),{actorUid:user.uid,actorEmail:user.email||'',action:'premium_trial_activated',details:{trialDays},createdAt:now});
   result={trialDays,expiresAt:expiry.toDate().toISOString()};
  });
  return send(res,200,{ok:true,...result});
 }catch(e){return send(res,e.status||400,{error:e.message||'Trial activation failed'});}
};
