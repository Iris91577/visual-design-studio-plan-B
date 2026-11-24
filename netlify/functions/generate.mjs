import { getStore } from '@netlify/blobs'
import { isAdmin } from '../lib/admin-auth.mjs'
import { fixedPalette, supportedShapes } from '../lib/design-resources.mjs'

const store=()=>getStore('vds-experiments',{region:'ap-southeast-1'})
const usageStore=()=>getStore('vds-ai-usage',{region:'ap-southeast-1'})
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
const getJSON=(bucket,key)=>bucket.get(key,{type:'json',consistency:'strong'})
const HEX=/^#[0-9A-F]{6}$/i

async function resolveConfig(request,code,previewConfig){
  if(typeof code==='string'&&code.startsWith('preview-')&&previewConfig)return await isAdmin(request)?{config:previewConfig,preview:true}:null
  if(!/^[\w-]{1,100}$/.test(code||''))return null
  const bucket=store(),mapping=await getJSON(bucket,`link:${code}`)
  if(!mapping?.id||mapping.condition!=='ai')return null
  const config=await getJSON(bucket,`published:${mapping.id}`)
  return config?{config,preview:false}:null
}
async function usageKey(code,participantId){const bytes=new TextEncoder().encode(`${code}\0${participantId}`),hash=await crypto.subtle.digest('SHA-256',bytes);return`usage:${[...new Uint8Array(hash)].slice(0,16).map(b=>b.toString(16).padStart(2,'0')).join('')}`}
function schema(shapeTypes,colourValues,backgroundValues){return{type:'object',additionalProperties:false,required:['background','elements'],properties:{background:{type:'string',enum:backgroundValues},elements:{type:'array',maxItems:500,items:{type:'object',additionalProperties:false,required:['type','x','y','width','height','rotation','fill'],properties:{type:{type:'string',enum:shapeTypes},x:{type:'number',minimum:0,maximum:1},y:{type:'number',minimum:0,maximum:1},width:{type:'number',exclusiveMinimum:0,maximum:1.5},height:{type:'number',exclusiveMinimum:0,maximum:1.5},rotation:{type:'number',minimum:-360,maximum:360},fill:{type:'string',enum:colourValues}}}}}}}
function instructions(config){
  const palette=config.palette.map(c=>`${c.name} ${c.hex}`).join(', ')
  return `You are the design engine in a controlled creativity study. Return only the requested structured design data.
Canvas: ${config.canvas.width} x ${config.canvas.height}; starting background ${config.canvas.background}.
Available element IDs: ${config.allowedShapes.join(', ')}.
Starter palette: ${palette}.
Use only colours from the fixed palette.
${config.allowBackgroundChange?'Choose the background freely from the same fixed palette and return it in the separate background field.':'Keep the fixed starting background and return it unchanged in the separate background field.'}
The background is a canvas property, not a design element. Do not simulate it with a full-canvas rectangle or any other element.
Every element is fully opaque. Transparency and colour blending are not available to either condition.
The listed resources are options, not a checklist. Use only what your own design decisions require. Do not attempt to include every shape or colour.
Make all decisions about quantity, colour richness, scale, rotation, placement, layering, overlap, density and visual complexity yourself. Do not follow any unstated preference for minimalism, balance, symmetry, variety or a target number of elements.
Use normalized coordinates: x/y are element centres; width/height are fractions of the canvas. Elements may overlap and may extend beyond the canvas. Do not output text, photos or any resource that is not represented by an available element ID.`
}
function parseContent(payload){const text=payload.choices?.[0]?.message?.content;if(typeof text==='string')return text;if(Array.isArray(text))return text.map(x=>x.text||'').join('');return''}
function validate(raw,config){
  const issues=[],allowed=new Set(config.allowedShapes),palette=new Set(config.palette.map(c=>c.hex.toUpperCase())),background=String(raw?.background||'').toUpperCase()
  if(!HEX.test(background))issues.push('The model returned an invalid background colour.')
  if(config.allowBackgroundChange?!palette.has(background):background!==String(config.canvas.background).toUpperCase())issues.push('The model returned a background outside the experiment rules.')
  if(!raw||!Array.isArray(raw.elements)||!raw.elements.length)issues.push('The model returned no elements.')
  if(raw?.elements?.length>500)issues.push('The response exceeded the technical rendering capacity.')
  const elements=(raw?.elements||[]).map((e,i)=>{
    if(!allowed.has(e.type))issues.push(`Element ${i+1}: unknown type.`)
    if(!HEX.test(e.fill||''))issues.push(`Element ${i+1}: invalid colour.`)
    if(!config.allowCustomColors&&!palette.has(String(e.fill).toUpperCase()))issues.push(`Element ${i+1}: colour is outside the palette.`)
    for(const k of ['x','y','width','height','rotation'])if(!Number.isFinite(e[k]))issues.push(`Element ${i+1}: invalid ${k}.`)
    return{id:`ai_${Date.now().toString(36)}_${i}`,type:e.type,x:e.x*config.canvas.width,y:e.y*config.canvas.height,width:e.width*config.canvas.width,height:e.height*config.canvas.height,rotation:e.rotation,fill:String(e.fill).toUpperCase()}
  })
  return{background,elements,issues}
}

export default async(request)=>{
 if(request.method!=='POST')return json({error:'Method not allowed.'},405)
 const apiKey=process.env.OPENAI_API_KEY,baseUrl=process.env.OPENAI_BASE_URL
 if(!apiKey||!baseUrl)return json({error:'Netlify AI Gateway is not active. Publish this project once, then try again.'},503)
 const body=await request.json().catch(()=>null),prompt=typeof body?.prompt==='string'?body.prompt.trim():''
 if(!prompt)return json({error:'Please enter a prompt.'},400);if(prompt.length>4000)return json({error:'The prompt is too long.'},400)
 const resolved=await resolveConfig(request,body.code,body.previewConfig)
 if(!resolved)return json({error:'This AI study link is not valid or the researcher preview is not authenticated.'},404)
 const config={...resolved.config,allowedShapes:supportedShapes(resolved.config.allowedShapes),palette:fixedPalette(),allowCustomColors:false},participantId=typeof body.participantId==='string'?body.participantId:''
 if(!config.allowedShapes.length)return json({error:'This experiment has no supported design elements configured.'},400)
 if(!resolved.preview&&!/^[\w.-]{1,80}$/.test(participantId))return json({error:'A valid participant ID is required.'},400)
 const usageBucket=usageStore(),key=resolved.preview?'':await usageKey(body.code,participantId)
 const prior=resolved.preview?null:await getJSON(usageBucket,key),used=Number(prior?.successful)||0,limit=Math.max(1,Math.min(10,Number(config.aiGenerationLimit)||1))
 if(!resolved.preview&&used>=limit)return json({error:'The generation limit for this participant has already been reached.'},429)
 const model=config.ai?.model||'gpt-6.1-sol',requestedAt=new Date().toISOString(),attempts=Math.max(1,Math.min(4,(config.ai?.technicalRetries||0)+1)),history=[]
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const backgroundValues=config.allowBackgroundChange?config.palette.map(c=>c.hex):[String(config.canvas.background).toUpperCase()]
   const response=await fetch(`${baseUrl.replace(/\/$/,'')}/v1/chat/completions`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,messages:[{role:'system',content:instructions(config)},{role:'user',content:prompt}],response_format:{type:'json_schema',json_schema:{name:'visual_design',strict:true,schema:schema(config.allowedShapes,config.palette.map(c=>c.hex),backgroundValues)}}})})
   const payload=await response.json().catch(()=>({}));if(!response.ok){history.push(payload.error?.message||`Provider error ${response.status}`);continue}
   const rawText=parseContent(payload);let raw;try{raw=JSON.parse(rawText)}catch{history.push('The model did not return valid JSON.');continue}
   const checked=validate(raw,config);if(checked.issues.length){history.push(...checked.issues);continue}
   if(!resolved.preview)await usageBucket.setJSON(key,{successful:used+1,code:body.code,participantId,updatedAt:new Date().toISOString()})
   return json({background:checked.background,elements:checked.elements,model,requestedAt,respondedAt:new Date().toISOString(),rawOutput:rawText,retries:attempt,validation:{passed:true,issues:history}})
  }catch(error){history.push(error instanceof Error?error.message:'Unknown provider error')}
 }
 console.error('Structured generation failed',history)
 return json({error:'The AI could not return a valid design. Please try again.',validation:{passed:false,issues:history}},502)
}
export const config={rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}}
