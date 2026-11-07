const DEFAULT_PRICES={
  whatsapp:{label:'WhatsApp AI',monthly:199,quarterly:499,yearly:0},
  instagram:{label:'Instagram AI',monthly:199,quarterly:499,yearly:0},
  combined:{label:'WhatsApp + Instagram',monthly:359,quarterly:899,yearly:0}
};
const PERIOD_DAYS={monthly:30,quarterly:90,yearly:365};
function packageFromName(name){
 const s=String(name||'').toLowerCase();
 const key=s.includes('combo')||s.includes('combined')?'combined':s.includes('instagram')?'instagram':s.includes('whatsapp')?'whatsapp':null;
 const period=s.includes('year')?'yearly':s.includes('quarter')?'quarterly':'monthly';
 return key?{key,period,days:PERIOD_DAYS[period],label:DEFAULT_PRICES[key].label}:null;
}
function getPrice(prices,pkg){return Number((prices[pkg.key]||DEFAULT_PRICES[pkg.key])[pkg.period]);}
module.exports={DEFAULT_PRICES,PERIOD_DAYS,packageFromName,getPrice};
