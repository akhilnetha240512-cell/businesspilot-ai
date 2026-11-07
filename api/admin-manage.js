const {getAdmin,verify,send}=require('./_firebase');
module.exports=async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 try{
  const actor=await verify(req,true);const {auth,db,admin}=getAdmin();const {action,targetId,packageName='Combined Monthly',durationDays=30}=req.body||{};
  if(!targetId||typeof targetId!=='string'||targetId.length>160)return send(res,400,{error:'A valid target ID is required.'});
  if(['suspend_user','activate_user'].includes(action)&&(targetId===actor.uid||targetId===process.env.SUPER_ADMIN_UID))return send(res,403,{error:'The configured Super Admin account cannot be suspended or modified through this endpoint.'});
  const now=admin.firestore.Timestamp.now();let message='Updated';
  if(['suspend_user','activate_user'].includes(action)){
   const disabled=action==='suspend_user';await auth.updateUser(targetId,{disabled});await db.doc(`users/${targetId}`).set({status:disabled?'suspended':'active',updatedAt:now,updatedBy:actor.uid},{merge:true});message=disabled?'User suspended':'User reactivated';
  }else if(['suspend_business','activate_business'].includes(action)){
   const ref=db.doc(`businesses/${targetId}`);const snap=await ref.get();if(!snap.exists)throw new Error('Business not found.');await ref.update({status:action==='suspend_business'?'suspended':'active',updatedAt:now,updatedBy:actor.uid});message=action==='suspend_business'?'Business suspended':'Business reactivated';
  }else if(action==='grant_premium'){
   const days=Number(durationDays);if(!Number.isInteger(days)||days<1||days>365)return send(res,400,{error:'Premium duration must be between 1 and 365 days.'});
   const user=await auth.getUser(targetId);const memberships=await db.collection('business_members').where('uid','==',targetId).where('status','==','active').limit(1).get();const businessId=memberships.empty?null:memberships.docs[0].data().businessId;
   await db.doc(`subscriptions/${targetId}`).set({userUid:targetId,userEmail:user.email||'',businessId,packageName,amount:0,status:'active',startedAt:now,expiresAt:admin.firestore.Timestamp.fromMillis(now.toMillis()+days*86400000),source:'super_admin_grant',updatedAt:now,updatedBy:actor.uid},{merge:true});message='Premium access granted';
  }else if(action==='revoke_premium'){
   const ref=db.doc(`subscriptions/${targetId}`);const snap=await ref.get();if(!snap.exists)throw new Error('Subscription not found.');await ref.update({status:'cancelled',cancelledAt:now,updatedAt:now,updatedBy:actor.uid});message='Premium access revoked';
  }else return send(res,400,{error:'Unsupported admin action.'});
  await db.collection('audit_logs').add({actorUid:actor.uid,actorEmail:actor.email||'',action:`admin_${action}`,details:{targetId},createdAt:now});
  return send(res,200,{ok:true,message});
 }catch(e){return send(res,e.status||400,{error:e.message||'Admin operation failed'});}
};
