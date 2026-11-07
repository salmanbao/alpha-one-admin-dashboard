/** R2-05 — Surveys & NPS Manager store. */
export type SurveyType = "nps"|"csat"|"custom";
export type SurveyChannel = "email"|"onsite"|"in_app";
export type QType = "rating"|"multiple_choice"|"free_text";
export interface Question { id:string; type:QType; text:string; required:boolean; scale?:{min:number;max:number}; options?:string[]; showIf?:string }
export interface SurveyResponse { id:string; contact:string; score?:number; answers:Record<string,string>; sentiment:"detractor"|"passive"|"promoter"|"neutral"; anonymous:boolean; at:string }
export interface Survey {
  id:string; name:string; type:SurveyType; channel:SurveyChannel; status:"draft"|"active"|"paused"|"closed";
  trigger:{event?:string; milestone?:string}; segment?:string; responses:number; trend:number[];
  anonymousMode:boolean; questions:Question[]; respList:SurveyResponse[];
}
const now=()=>new Date().toISOString();
let SURVEYS: Survey[] = [
  {id:"sv1",name:"Post-Payout NPS",type:"nps",channel:"email",status:"active",trigger:{event:"payout_completed",milestone:"first payout"},segment:"Paid out (30d)",responses:214,trend:[62,65,64,68,71,70,74],anonymousMode:true,
    questions:[{id:"q1",type:"rating",text:"How likely are you to recommend us?",required:true,scale:{min:0,max:10}},{id:"q2",type:"free_text",text:"What could we improve?",required:false,showIf:"q1 < 7"}],
    respList:[{id:"r1",contact:"jo***@x.com",score:9,answers:{q1:"9",q2:"Great payouts"},sentiment:"promoter",anonymous:false,at:now()},{id:"r2",contact:"an***@y.com",score:4,answers:{q1:"4",q2:"Slow KYC"},sentiment:"detractor",anonymous:false,at:now()},{id:"r3",contact:"anon-1",score:6,answers:{q1:"6"},sentiment:"passive",anonymous:true,at:now()}]},
  {id:"sv2",name:"Challenge Experience CSAT",type:"csat",channel:"onsite",status:"draft",trigger:{event:"challenge_completed"},segment:"Funded active",responses:0,trend:[],anonymousMode:false,
    questions:[{id:"q1",type:"rating",text:"Rate your challenge experience",required:true,scale:{min:1,max:5}},{id:"q2",type:"multiple_choice",text:"Most valued feature",required:false,options:["Dashboard","Support","Fast payouts"]}],
    respList:[]},
];
export function listSurveys(){ return SURVEYS; }
export function getSurvey(id:string){ return SURVEYS.find(s=>s.id===id); }
export function saveSurvey(p:Partial<Survey>&{id:string}){ SURVEYS=SURVEYS.map(x=>x.id===p.id?{...x,...p}:x); }
export function createSurvey(name:string,type:SurveyType,channel:SurveyChannel){ const rec:Survey={id:`sv-${Date.now()}`,name,type,channel,status:"draft",trigger:{},responses:0,trend:[],anonymousMode:false,questions:[],respList:[]}; SURVEYS=[rec,...SURVEYS]; return rec; }
/** AC-2: create a usable segment from responses (detractors/passives/promoters). */
export function segmentFromResponses(id:string, bucket:"detractor"|"promoter"): string { const s=getSurvey(id); return `segment:${(bucket==="detractor"?"NPS detractors":"NPS promoters")}-${s?.name.toLowerCase().replace(/\s+/g,"-")}`; }
export function addQuestion(id:string, q:Omit<Question,"id">){ SURVEYS=SURVEYS.map(s=>s.id===id?{...s,questions:[...s.questions,{...q,id:`q${Date.now()}`}]}:s); }
export function removeQuestion(id:string, qid:string){ SURVEYS=SURVEYS.map(s=>s.id===id?{...s,questions:s.questions.filter(q=>q.id!==qid)}:s); }
