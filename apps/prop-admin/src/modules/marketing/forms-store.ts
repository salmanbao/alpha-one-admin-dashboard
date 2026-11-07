/** R2-02 — Form & Lead-Capture Builder store. */
export interface FormDef {
  id:string; name:string; status:"draft"|"published"; embedTarget:string;
  submissions:number; lastSubmission?:string; conversion:number;
  fields:Array<{id:string;type:string;label:string;required:boolean;condition?:string}>;
  routing:{createCrm:boolean;segment?:string;webhook?:string;flow?:string;consentCapture:boolean};
}
const now=()=>new Date().toISOString();
let FORMS: FormDef[] = [
  {id:"f1",name:"Challenge Interest",status:"published",embedTarget:"Landing: 100K Promo (R2-01)",submissions:842,lastSubmission:now(),conversion:6.7,fields:[{id:"f1",type:"email",label:"Email",required:true},{id:"f2",type:"name",label:"Full name",required:true},{id:"f3",type:"select",label:"Experience level",required:false},{id:"f4",type:"consent",label:"Marketing consent",required:true}],routing:{createCrm:true,segment:"KYC-verified, not deposited",flow:"Welcome & KYC nudge",consentCapture:true}},
  {id:"f2",name:"Deposit Boost Lead",status:"draft",embedTarget:"Popup (R2-03)",submissions:0,conversion:0,fields:[{id:"f1",type:"email",label:"Email",required:true},{id:"f2",type:"consent",label:"Consent",required:true}],routing:{createCrm:true,consentCapture:true}},
];
export function listForms(){ return FORMS; }
export function getForm(id:string){ return FORMS.find(f=>f.id===id); }
export function saveForm(f:Partial<FormDef>&{id:string}){ FORMS = FORMS.map(x=>x.id===f.id?{...x,...f}:x); }
export function createForm(name:string){ const rec:FormDef={id:`f-${Date.now()}`,name,status:"draft",embedTarget:"Direct link",submissions:0,conversion:0,fields:[{id:"f1",type:"email",label:"Email",required:true},{id:"f2",type:"consent",label:"Marketing consent",required:true}],routing:{createCrm:true,consentCapture:true}}; FORMS=[rec,...FORMS]; return rec; }
