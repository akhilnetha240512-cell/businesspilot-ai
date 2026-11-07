const {verify,send}=require('./_firebase');
module.exports=async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 try{
  const user=await verify(req,false);const {getAdmin}=require('./_firebase');const {db}=getAdmin();const sub=await db.doc(`subscriptions/${user.uid}`).get();const expires=sub.exists?(sub.data().expiresAt?.toMillis?.()||new Date(sub.data().expiresAt||0).getTime()):0;if(!sub.exists||sub.data().status!=='active'||expires<=Date.now())return send(res,403,{error:'AI Studio generation requires an active Premium subscription.'});const {prompt,kind='Business content',language='English'}=req.body||{};
  if(typeof prompt!=='string'||prompt.trim().length<5||prompt.length>12000)return send(res,400,{error:'Enter a prompt between 5 and 12,000 characters.'});
  const key=process.env.AI_API_KEY,base=(process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');const model=process.env.AI_MODEL||'gpt-4o-mini';if(!key)return send(res,503,{error:'AI provider is not configured yet. Add AI_API_KEY, AI_BASE_URL (optional), and AI_MODEL in Vercel environment variables.'});
  const dailyLimit=Math.max(1,Math.min(500,Number(process.env.AI_DAILY_LIMIT)||30));const {admin}=getAdmin();const usageRef=db.doc(`ai_usage/${user.uid}`);const today=new Date().toISOString().slice(0,10);let used=0;await db.runTransaction(async tx=>{const snap=await tx.get(usageRef);const d=snap.exists?snap.data():{};used=d.day===today?Number(d.count||0):0;if(used>=dailyLimit)throw new Error(`Daily AI usage limit reached (${dailyLimit}). Try again tomorrow.`);tx.set(usageRef,{uid:user.uid,day:today,count:used+1,updatedAt:admin.firestore.Timestamp.now()},{merge:true});});
  const response=await fetch(`${base}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model,temperature:0.5,messages:[{role:'system',content:`You are BusinessPilot AI, a careful small-business assistant. Create a useful ${kind} in ${language}. Do not invent prices, policies, product facts, customer promises, or legal claims. If information is missing, mark it clearly as [NEEDS CONFIRMATION].`},{role:'user',content:prompt.trim()}]})});
  const data=await response.json().catch(()=>({}));if(!response.ok)return send(res,502,{error:data.error?.message||`AI provider returned ${response.status}.`});
  const output=data.choices?.[0]?.message?.content;if(!output)return send(res,502,{error:'AI provider returned an empty response.'});
  return send(res,200,{ok:true,output,model});
 }catch(e){return send(res,e.status||500,{error:e.message||'AI generation failed'});}
};
