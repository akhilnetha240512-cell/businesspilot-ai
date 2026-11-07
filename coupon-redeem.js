const {getAdmin,verify,send}=require('./_firebase');
const {DEFAULT_PRICES,packageFromName,getPrice}=require('./_pricing');
module.exports=async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 try{
  const user=await verify(req,false);const {db,admin}=getAdmin();const code=String(req.body?.code||'').trim().toUpperCase();const pkg=packageFromName(req.body?.packageName||'Combined Monthly');
  if(!code||!pkg)return send(res,400,{error:'Enter a coupon and select a valid Premium package.'});
  const q=await db.collection('coupons').where('code','==',code).limit(1).get();if(q.empty)return send(res,404,{error:'Coupon not found.'});
  const couponRef=q.docs[0].ref,redemptionRef=db.collection('coupon_redemptions').doc(`${q.docs[0].id}_${user.uid}`),subRef=db.collection('subscriptions').doc(user.uid);
  const cfg=await db.doc('application_settings/platform').get();const prices=cfg.exists?cfg.data().prices||DEFAULT_PRICES:DEFAULT_PRICES;const baseAmount=getPrice(prices,pkg);if(!Number.isFinite(baseAmount)||baseAmount<=0)return send(res,400,{error:'This billing period is not configured yet. Ask the Super Admin to set its price before redeeming a percentage coupon.'});let result;
  await db.runTransaction(async tx=>{
   const [c,r,s]=await Promise.all([tx.get(couponRef),tx.get(redemptionRef),tx.get(subRef)]);if(!c.exists)throw new Error('Coupon no longer exists.');const d=c.data();if(String(d.code||'').toUpperCase()!==code)throw new Error('Coupon code changed; refresh and try again.');
   if(!['percent','fixed'].includes(d.type))throw new Error('Coupon discount type is invalid.');if(d.status!=='active')throw new Error('Coupon is paused or inactive.');
   if(r.exists)throw new Error('This account has already redeemed this coupon.');
   if(d.expiry){const exp=new Date(`${d.expiry}T23:59:59`);if(!Number.isNaN(exp.getTime())&&exp.getTime()<Date.now())throw new Error('Coupon has expired.');}
   if(d.restrictedEmail&&String(d.restrictedEmail).toLowerCase()!==String(user.email||'').toLowerCase())throw new Error('Coupon is restricted to another account.');
   if(d.maxRedemptions&&Number(d.redemptionCount||0)>=Number(d.maxRedemptions))throw new Error('Coupon redemption limit has been reached.');
   const discount=d.type==='percent'?baseAmount*Math.min(100,Math.max(0,Number(d.value)||0))/100:Math.min(baseAmount,Math.max(0,Number(d.value)||0));
   if(discount+0.0001<baseAmount)throw new Error('This coupon does not make the selected plan completely free. Use it in the payment form instead.');
   const benefitDays=Math.max(1,Math.min(365,Number(d.benefitDays)||pkg.days));const now=admin.firestore.Timestamp.now();const currentExpiry=s.exists?(s.data().expiresAt?.toMillis?.()||0):0;const startMillis=Math.max(now.toMillis(),currentExpiry);const expiry=admin.firestore.Timestamp.fromMillis(startMillis+benefitDays*86400000);
   tx.update(couponRef,{redemptionCount:admin.firestore.FieldValue.increment(1),updatedAt:now});
   tx.create(redemptionRef,{couponId:couponRef.id,code,userUid:user.uid,userEmail:user.email||'',packageName:`${pkg.label} ${pkg.period}`,benefitDays,redeemedAt:now});
   tx.set(subRef,{userUid:user.uid,packageName:`${pkg.label} ${pkg.period}`,plan:pkg.key,amount:0,status:'active',startedAt:now,expiresAt:expiry,source:'100_percent_coupon',couponCode:code,updatedAt:now},{merge:true});
   tx.set(db.collection('audit_logs').doc(),{actorUid:user.uid,actorEmail:user.email||'',action:'coupon_redeemed_full_free',details:{code,packageName:pkg.label,benefitDays},createdAt:now});result={benefitDays,expiresAt:expiry.toDate().toISOString()};
  });
  return send(res,200,{ok:true,...result});
 }catch(e){return send(res,e.status||400,{error:e.message||'Coupon redemption failed'});}
};
