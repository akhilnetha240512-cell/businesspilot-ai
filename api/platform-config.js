const {getAdmin,verify,send}=require('./_firebase');
const {DEFAULT_PRICES}=require('./_pricing');
module.exports=async function handler(req,res){
 try{
  const {db}=getAdmin();const ref=db.doc('application_settings/platform');
  if(req.method==='GET'){
   const snap=await ref.get();const value=snap.exists?snap.data():{};
   return send(res,200,{aiConfigured:!!process.env.AI_API_KEY,prices:value.prices||DEFAULT_PRICES,trialDays:Number.isInteger(value.trialDays)?value.trialDays:7,freeLimits:value.freeLimits||{customers:50,products:50,orders:100},payment:value.payment||{upiId:'',upiName:'',instructions:''},updatedAt:value.updatedAt||null});
  }
  if(req.method==='POST'){
   const user=await verify(req,true);const body=req.body||{};const prices=body.prices;
   if(!prices||!['whatsapp','instagram','combined'].every(k=>prices[k]&&['monthly','quarterly','yearly'].every(p=>Number.isFinite(Number(prices[k][p]))&&Number(prices[k][p])>=0&&Number(prices[k][p])<=1000000)))return send(res,400,{error:'Provide valid non-negative monthly, quarterly and yearly prices for all three packages.'});
   const trialDays=Number(body.trialDays??7);if(!Number.isInteger(trialDays)||trialDays<0||trialDays>30)return send(res,400,{error:'Trial duration must be between 0 and 30 days.'});
   const payment={upiId:String(body.payment?.upiId||'').trim().slice(0,100),upiName:String(body.payment?.upiName||'').trim().slice(0,120),instructions:String(body.payment?.instructions||'').trim().slice(0,1000)};
   const freeLimits={customers:Number(body.freeLimits?.customers??50),products:Number(body.freeLimits?.products??50),orders:Number(body.freeLimits?.orders??100)};if(Object.values(freeLimits).some(n=>!Number.isInteger(n)||n<0||n>1000000))return send(res,400,{error:'Free plan limits must be whole numbers between 0 and 1,000,000.'});
   await ref.set({prices,trialDays,payment,freeLimits,updatedAt:new Date(),updatedBy:user.uid},{merge:true});
   await db.collection('audit_logs').add({actorUid:user.uid,actorEmail:user.email||'',action:'platform_pricing_updated',details:{prices,trialDays},createdAt:new Date()});
   return send(res,200,{ok:true,prices,trialDays,payment,freeLimits});
  }
  return send(res,405,{error:'Method not allowed'});
 }catch(e){return send(res,e.status||500,{error:e.message||'Platform configuration failed'});}
};
