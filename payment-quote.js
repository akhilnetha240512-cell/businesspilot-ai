const {getAdmin,verify,send}=require('./_firebase');
const {DEFAULT_PRICES,packageFromName,getPrice}=require('./_pricing');
module.exports=async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 try{
  const user=await verify(req,false);const {db}=getAdmin();const {packageName,couponCode=''}=req.body||{};const pkg=packageFromName(packageName);if(!pkg)return send(res,400,{error:'Select a valid package.'});
  const config=await db.doc('application_settings/platform').get();const prices=config.exists?config.data().prices||DEFAULT_PRICES:DEFAULT_PRICES;const baseAmount=getPrice(prices,pkg);if(!Number.isFinite(baseAmount)||baseAmount<=0)return send(res,400,{error:'This billing period is not configured yet.'});
  let discount=0,code='';if(String(couponCode).trim()){
   code=String(couponCode).trim().toUpperCase();if(!/^[A-Z0-9_-]{3,32}$/.test(code))return send(res,400,{error:'Coupon code format is invalid.'});const q=await db.collection('coupons').where('code','==',code).limit(1).get();if(q.empty)return send(res,404,{error:'Coupon not found.'});const ref=q.docs[0],c=ref.data();if(String(c.code||'').toUpperCase()!==code)return send(res,409,{error:'Coupon code changed; refresh and try again.'});
   if(!['percent','fixed'].includes(c.type))return send(res,400,{error:'Coupon discount type is invalid.'});if(c.status!=='active')return send(res,400,{error:'Coupon is paused or inactive.'});const exp=c.expiry?new Date(`${c.expiry}T23:59:59`):null;if(exp&&!Number.isNaN(exp.getTime())&&exp.getTime()<Date.now())return send(res,400,{error:'Coupon has expired.'});
   if(c.restrictedEmail&&String(c.restrictedEmail).toLowerCase()!==String(user.email||'').toLowerCase())return send(res,403,{error:'Coupon is restricted to another account.'});if(c.maxRedemptions&&Number(c.redemptionCount||0)>=Number(c.maxRedemptions))return send(res,409,{error:'Coupon redemption limit reached.'});
   const prior=await db.collection('coupon_redemptions').doc(`${ref.id}_${user.uid}`).get();if(prior.exists)return send(res,409,{error:'This account has already redeemed this coupon.'});
   discount=c.type==='percent'?baseAmount*Math.min(100,Math.max(0,Number(c.value)||0))/100:Math.min(baseAmount,Math.max(0,Number(c.value)||0));
  }
  const amount=Math.max(0,Math.round((baseAmount-discount)*100)/100);return send(res,200,{ok:true,packageName:`${pkg.label} ${pkg.period}`,baseAmount,discount:Math.round(discount*100)/100,amount,fullFree:amount===0,couponCode:code});
 }catch(e){return send(res,e.status||500,{error:e.message||'Could not calculate payment amount'});}
};
