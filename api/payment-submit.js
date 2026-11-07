const {getAdmin,verify,send}=require('./_firebase');
const crypto=require('crypto');
const {DEFAULT_PRICES,packageFromName,getPrice}=require('./_pricing');
module.exports=async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 try{
  const user=await verify(req,false);const {db,admin}=getAdmin();const {packageName,utr,paymentDate,couponCode=''}=req.body||{};
  const pkg=packageFromName(packageName);if(!pkg)return send(res,400,{error:'Select a valid package.'});
  if(!/^[A-Za-z0-9-]{8,30}$/.test(String(utr||'').trim()))return send(res,400,{error:'Enter an 8–30 character UPI transaction reference (letters and numbers).'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(paymentDate||''))||Number.isNaN(Date.parse(`${paymentDate}T00:00:00`))||Date.parse(`${paymentDate}T00:00:00`)>Date.now()+86400000)return send(res,400,{error:'Enter a valid payment date that is not in the future.'});
  const cfg=await db.doc('application_settings/platform').get();const prices=cfg.exists?cfg.data().prices||DEFAULT_PRICES:DEFAULT_PRICES;const baseAmount=getPrice(prices,pkg);if(!Number.isFinite(baseAmount)||baseAmount<=0)return send(res,400,{error:'This billing period is not configured yet. Ask the Super Admin to set its price.'});
  let couponRef=null,couponSnap=null,discount=0,coupon=null;
  if(String(couponCode).trim()){
   const code=String(couponCode).trim().toUpperCase();if(!/^[A-Z0-9_-]{3,32}$/.test(code))return send(res,400,{error:'Coupon code format is invalid.'});const q=await db.collection('coupons').where('code','==',code).limit(1).get();
   if(q.empty)return send(res,400,{error:'Coupon code not found.'});couponRef=q.docs[0].ref;couponSnap=q.docs[0];coupon=couponSnap.data();if(String(coupon.code||'').toUpperCase()!==code)return send(res,409,{error:'Coupon code changed; refresh and try again.'});const prior=await db.collection('coupon_redemptions').doc(`${couponSnap.id}_${user.uid}`).get();if(prior.exists)return send(res,409,{error:'This account has already redeemed this coupon.'});
   const expiry=coupon.expiry?new Date(`${coupon.expiry}T23:59:59`):null;
   if(!['percent','fixed'].includes(coupon.type))return send(res,400,{error:'Coupon discount type is invalid.'});if(coupon.status!=='active'||(expiry&&!Number.isNaN(expiry.getTime())&&expiry<Date.now()))return send(res,400,{error:'This coupon is inactive or expired.'});
   if(coupon.restrictedEmail&&String(coupon.restrictedEmail).toLowerCase()!==String(user.email||'').toLowerCase())return send(res,403,{error:'This coupon is restricted to another account.'});
   if(coupon.maxRedemptions&&Number(coupon.redemptionCount||0)>=Number(coupon.maxRedemptions))return send(res,409,{error:'This coupon has reached its redemption limit.'});
   if(coupon.type==='percent')discount=Math.round(baseAmount*Math.min(100,Math.max(0,Number(coupon.value)||0))/100*100)/100;
   else discount=Math.min(baseAmount,Math.max(0,Number(coupon.value)||0));
  }
  const amount=Math.max(0,Math.round((baseAmount-discount)*100)/100);
  const memberships=await db.collection('business_members').where('uid','==',user.uid).where('status','==','active').limit(1).get();const businessId=memberships.empty?null:memberships.docs[0].data().businessId;
  const now=admin.firestore.Timestamp.now();const ref=db.collection('payment_requests').doc();const utrKey=crypto.createHash('sha256').update(String(utr).trim().toUpperCase()).digest('hex');const utrRef=db.collection('payment_utr_registry').doc(utrKey);
  await db.runTransaction(async tx=>{const used=await tx.get(utrRef);if(used.exists)throw new Error('This UTR/reference has already been submitted.');tx.create(utrRef,{paymentId:ref.id,userUid:user.uid,createdAt:now});tx.create(ref,{userUid:user.uid,userEmail:user.email||'',businessId,packageName:`${pkg.label} ${pkg.period[0].toUpperCase()+pkg.period.slice(1)}`,planKey:pkg.key,billingPeriod:pkg.period,durationDays:pkg.days,baseAmount,discountAmount:discount,amount,utr:String(utr).trim(),paymentDate,status:'pending',couponId:couponRef?.id||null,couponCode:coupon?.code||null,serverVerified:true,createdAt:now});});
  return send(res,200,{ok:true,paymentId:ref.id,amount,baseAmount,discount});
 }catch(e){return send(res,e.status||500,{error:e.message||'Could not submit payment request'});}
};
