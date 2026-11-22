import type { AiGenerationRecord, DesignElement, ExperimentConfig } from '../lib/types'

export interface GenerationResult { source:'model'; elements:DesignElement[]; model:string; requestedAt:string; respondedAt:string; record:AiGenerationRecord }
export async function generateDesign(prompt:string,config:ExperimentConfig,linkCode:string,participantId:string):Promise<GenerationResult>{
 if(!prompt.trim())throw new Error('Please describe your design before generating.')
 const response=await fetch('/api/generate',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:prompt.trim(),code:linkCode,participantId,previewConfig:linkCode.startsWith('preview-')?config:undefined})})
 const payload=await response.json().catch(()=>({})) as {elements?:DesignElement[];model?:string;requestedAt?:string;respondedAt?:string;rawOutput?:string;retries?:number;validation?:{passed:boolean;issues:string[]};error?:string}
 if(!response.ok||!payload.elements?.length)throw new Error(payload.error||'The model did not return a valid design.')
 const requestedAt=payload.requestedAt||new Date().toISOString(),respondedAt=payload.respondedAt||new Date().toISOString(),model=payload.model||config.ai.model
 return{source:'model',elements:payload.elements,model,requestedAt,respondedAt,record:{id:`gen_${Date.now().toString(36)}`,prompt:prompt.trim(),method:'structured',model,modelVersion:model,parameters:{responseFormat:'json_schema'},requestedAt,respondedAt,success:true,failureReason:null,retries:payload.retries||0,rawOutput:payload.rawOutput||'',validation:payload.validation||{passed:true,issues:[]}}}
}
