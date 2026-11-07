const {getAdmin,verify,send}=require('./_firebase');
const ALLOWED={
 customers:['name','phone','email','notes'],
 products:['name','category','price','stock','imageUrl','description'],
 orders:['customerId','customerName','total','paymentStatus','status'],
 automations:['name','trigger','action','template','enabled']
};
module.exports=async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 try{
  const user=await verify(req,false);const {db,admin}=getAdmin();const {collection:kind,recordId=null,operation='save',data={}}=req.body||{};
  if(!Object.prototype.hasOwnProperty.call(ALLOWED,kind))return send(res,400,{error:'Unsupported business record collection.'});
  if(!['save','archive'].includes(operation))return send(res,400,{error:'Unsupported record operation.'});
  const memberships=await db.collection('business_members').where('uid','==',user.uid).where('status','==','active').limit(1).get();if(memberships.empty)return send(res,403,{error:'An active business membership is required.'});
  const businessId=memberships.docs[0].data().businessId;const business=await db.doc(`businesses/${businessId}`).get();if(!business.exists||business.data().status!=='active')return send(res,403,{error:'This business workspace is suspended.'});
  const sub=await db.doc(`subscriptions/${user.uid}`).get();const expiry=sub.exists?(sub.data().expiresAt?.toMillis?.()||0):0;const premium=!!(sub.exists&&sub.data().status==='active'&&expiry>Date.now());
  if(kind==='automations'&&!premium)return send(res,403,{error:'Automation Builder requires an active Premium subscription.'});
  const config=await db.doc('application_settings/platform').get();const limits=config.exists?config.data().freeLimits||{customers:50,products:50,orders:100}:{customers:50,products:50,orders:100};
  const clean={};for(const field of ALLOWED[kind])if(Object.prototype.hasOwnProperty.call(data,field))clean[field]=data[field];
  if(recordId!==null&&(typeof recordId!=='string'||recordId.length>160))return send(res,400,{error:'Invalid record ID.'});
  if(operation==='save'){
   for(const [field,value] of Object.entries(clean)){if(typeof value==='string'&&value.length>5000)return send(res,400,{error:`${field} is too long (maximum 5,000 characters).`});}
   if(kind==='orders'&&clean.status&&!['pending','processing','completed','cancelled'].includes(clean.status))return send(res,400,{error:'Invalid order status.'});
   if(kind==='orders'&&clean.paymentStatus&&!['pending','paid','failed'].includes(clean.paymentStatus))return send(res,400,{error:'Invalid payment status.'});
   if(kind==='products'&&clean.imageUrl&&!/^https?:\/\//i.test(clean.imageUrl))return send(res,400,{error:'Product image URL must use HTTP or HTTPS.'});
   if(kind==='customers'&&(!String(clean.name||'').trim()||String(clean.name).length>160))return send(res,400,{error:'Customer name is required (maximum 160 characters).'});
   if(kind==='products'&&(!String(clean.name||'').trim()||String(clean.name).length>160))return send(res,400,{error:'Product name is required (maximum 160 characters).'});
   for(const k of ['price','stock','total'])if(clean[k]!==undefined){if(!Number.isFinite(Number(clean[k]))||Number(clean[k])<0)return send(res,400,{error:`${k} must be a non-negative number.`});clean[k]=Number(clean[k]);}
   if(clean.enabled!==undefined)clean.enabled=clean.enabled===true||clean.enabled==='true';
  }
  const now=admin.firestore.Timestamp.now();let result;
  if(recordId){
   const ref=db.collection(kind).doc(recordId);const snap=await ref.get();if(!snap.exists||snap.data().businessId!==businessId)return send(res,404,{error:'Record not found in this workspace.'});
   if(operation==='archive')await ref.update({archived:true,deletedAt:now,updatedAt:now});else await ref.update({...clean,businessId,updatedAt:now});result={id:recordId,operation};
  }else{
   if(operation==='archive')return send(res,400,{error:'recordId is required to archive a record.'});
   const limit=Number(limits[kind]);
   const ref=db.collection(kind).doc();
   await db.runTransaction(async tx=>{
    if(!premium&&Number.isFinite(limit)&&limit>=0){const existing=await tx.get(db.collection(kind).where('businessId','==',businessId));const active=existing.docs.filter(d=>!d.data().archived&&!d.data().deletedAt).length;if(active>=limit)throw new Error(`Free plan limit reached for ${kind} (${limit}). Upgrade to Premium for expanded limits.`);}
    tx.create(ref,{...clean,businessId,createdAt:now,updatedAt:now,archived:false,deletedAt:null});
   });result={id:ref.id,operation:'created'};
  }
  await db.collection('audit_logs').add({actorUid:user.uid,actorEmail:user.email||'',businessId,action:`${operation}_${kind}`,details:{recordId:result.id},createdAt:now});
  return send(res,200,{ok:true,...result});
 }catch(e){return send(res,e.status||400,{error:e.message||'Business record operation failed'});}
};
