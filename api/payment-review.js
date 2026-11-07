const {getAdmin,verify,send}=require('./_firebase');
const {DEFAULT_PRICES,packageFromName,getPrice}=require('./_pricing');
module.exports=async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 try{
  const actor=await verify(req,true);const {db,admin}=getAdmin();const {paymentId,decision,note='',bankCreditVerified=false}=req.body||{};
  if(!paymentId||!['approve','reject'].includes(decision))return send(res,400,{error:'paymentId and a valid decision are required.'});
  if(String(note).trim().length<3)return send(res,400,{error:'Enter an internal review note.'});
  const ref=db.collection('payment_requests').doc(paymentId);let result;
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);if(!snap.exists)throw new Error('Payment request not found.');const p=snap.data();if(p.status!=='pending')throw new Error('This payment request has already been reviewed.');
   if(decision==='approve'&&!bankCreditVerified)throw new Error('Confirm that the account holder independently verified actual bank credit.');
   if(decision==='approve'){if(p.serverVerified===true){const base=Number(p.baseAmount),discount=Number(p.discountAmount||0),amount=Number(p.amount);if(!Number.isFinite(base)||!Number.isFinite(discount)||!Number.isFinite(amount)||base<=0||discount<0||discount>base||Math.round((base-discount)*100)!==Math.round(amount*100)||amount<=0)throw new Error('The server-calculated payment amount is invalid.');}else{const pkg=packageFromName(p.packageName);const cfg=await db.doc('application_settings/platform').get();const prices=cfg.exists?cfg.data().prices||DEFAULT_PRICES:DEFAULT_PRICES;if(!pkg||Number(p.amount)!==getPrice(prices,pkg))throw new Error('Legacy payment amount does not match the current server-side price schedule.');}}
   let couponRef=null,couponSnap=null,subSnap=null;
   if(decision==='approve'){subSnap=await tx.get(db.collection('subscriptions').doc(p.userUid));}
   if(decision==='approve'&&p.couponId){couponRef=db.collection('coupons').doc(p.couponId);couponSnap=await tx.get(couponRef);if(!couponSnap.exists)throw new Error('The coupon attached to this payment no longer exists.');const c=couponSnap.data();if(c.status!=='active')throw new Error('The coupon was paused before this payment was approved.');if(c.expiry){const exp=new Date(`${c.expiry}T23:59:59`);if(!Number.isNaN(exp.getTime())&&exp.getTime()<Date.now())throw new Error('The coupon expired before this payment was approved.');}if(c.restrictedEmail&&String(c.restrictedEmail).toLowerCase()!==String(p.userEmail||'').toLowerCase())throw new Error('Coupon account restriction does not match the payment owner.');if(c.maxRedemptions&&Number(c.redemptionCount||0)>=Number(c.maxRedemptions))throw new Error('Coupon redemption limit reached before approval.');}
   const now=admin.firestore.Timestamp.now();const status=decision==='approve'?'approved':'rejected';
   tx.update(ref,{status,reviewNote:String(note).slice(0,1000),reviewedAt:now,reviewedBy:actor.uid,bankCreditVerified:decision==='approve'});
   tx.set(db.collection('payment_history').doc(paymentId),{...p,status,reviewNote:String(note).slice(0,1000),reviewedAt:now,reviewedBy:actor.uid,bankCreditVerified:decision==='approve'});
   if(decision==='approve'){
    if(couponRef){tx.update(couponRef,{redemptionCount:admin.firestore.FieldValue.increment(1),updatedAt:now});tx.create(db.collection('coupon_redemptions').doc(`${p.couponId}_${p.userUid}`),{couponId:p.couponId,code:p.couponCode||'',userUid:p.userUid,userEmail:p.userEmail||'',paymentId,redeemedAt:now,discountAmount:p.discountAmount||0});}
    const days=Math.max(1,Math.min(365,Number(p.durationDays)||30));const subRef=db.collection('subscriptions').doc(p.userUid);const oldExpiry=subSnap?.exists?(subSnap.data().expiresAt?.toMillis?.()||0):0;const expiry=admin.firestore.Timestamp.fromMillis(Math.max(now.toMillis(),oldExpiry)+days*86400000);
    tx.set(subRef,{userUid:p.userUid,businessId:p.businessId||null,packageName:p.packageName,plan:p.planKey||'combined',billingPeriod:p.billingPeriod||'monthly',amount:Number(p.amount),status:'active',startedAt:now,expiresAt:expiry,source:'manual_upi_admin_approval',updatedAt:now},{merge:true});
   }
   tx.set(db.collection('audit_logs').doc(),{actorUid:actor.uid,actorEmail:actor.email||'',action:`payment_${decision}`,details:{paymentId,userUid:p.userUid,amount:p.amount,verifiedBankCredit:decision==='approve'},createdAt:now});result={status};
  });
  return send(res,200,{ok:true,...result});
 }catch(e){return send(res,e.status||400,{error:e.message||'Payment review failed'});}
};
