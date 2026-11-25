import { getStore } from '@netlify/blobs'
import { isAdmin } from '../lib/admin-auth.mjs'
import { fixedPalette, supportedShapes } from '../lib/design-resources.mjs'

const store=()=>getStore('vds-experiments',{region:'ap-southeast-1'})
const usageStore=()=>getStore('vds-ai-usage',{region:'ap-southeast-1'})
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
const getJSON=(bucket,key)=>bucket.get(key,{type:'json',consistency:'strong'})
const HEX=/^#[0-9A-F]{6}$/i
const JOB_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const PARTICIPANT_ID = /^[\w.-]{1,80}$/
const JOB_LIFETIME_MS = 8 * 60_000

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

async function requestDesign({ config, prompt, requestedAt }) {
 const apiKey=process.env.OPENAI_API_KEY,baseUrl=process.env.OPENAI_BASE_URL
 if(!apiKey||!baseUrl)throw new Error('Netlify AI Gateway is unavailable.')
 const model=config.ai?.model||'gpt-6.1-sol',attempts=Math.max(1,Math.min(4,(Number(config.ai?.technicalRetries)||0)+1)),history=[]
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const backgroundValues=config.allowBackgroundChange?config.palette.map(c=>c.hex):[String(config.canvas.background).toUpperCase()]
   const response=await fetch(`${baseUrl.replace(/\/$/,'')}/v1/chat/completions`,{method:'POST',signal:AbortSignal.timeout(75_000),headers:{'content-type':'application/json',authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,messages:[{role:'system',content:instructions(config)},{role:'user',content:prompt}],response_format:{type:'json_schema',json_schema:{name:'visual_design',strict:true,schema:schema(config.allowedShapes,config.palette.map(c=>c.hex),backgroundValues)}}})})
   const payload=await response.json().catch(()=>({}));if(!response.ok){history.push(payload.error?.message||`Provider error ${response.status}`);continue}
   const rawText=parseContent(payload);let raw;try{raw=JSON.parse(rawText)}catch{history.push('The model did not return valid JSON.');continue}
   const checked=validate(raw,config);if(checked.issues.length){history.push(...checked.issues);continue}
   return {background:checked.background,elements:checked.elements,model,requestedAt,respondedAt:new Date().toISOString(),rawOutput:rawText,retries:attempt,validation:{passed:true,issues:history}}
  }catch(error){history.push(error instanceof Error?error.message:'Unknown provider error')}
 }
 console.error('Structured generation failed',history)
 throw new Error('The AI could not return a valid design. Please try again.')
}

function loadUsage(bucket, key) {
  return bucket.getWithMetadata(key, { type: 'json', consistency: 'strong' })
}

function jobResponse(record) {
  const { job } = record
  if (job.status === 'done') {
    return json({ status: 'done', result: job.result, successful: record.successful })
  }
  if (job.status === 'failed' || Date.now() >= job.expiresAt) {
    return json({ status: 'failed', error: job.error ?? 'Generation took too long. Please try again.' })
  }
  return json({ status: 'pending' }, 202)
}

async function startWorker(dispatch, request, context, key, record) {
  try {
    await dispatch(request, context, key, record.job.token)
    return jobResponse(record)
  } catch (error) {
    console.error('Could not dispatch generation worker', error?.message)
    return json({ error: 'Could not start generation. Try again to resume this request.', recoverable: true }, 503)
  }
}

async function dispatchWorker(request, context, key, token) {
  const origin = context?.deploy?.published ? context.site.url : process.env.DEPLOY_URL ?? new URL(request.url).origin
  const url = new URL('/.netlify/functions/generate-background', origin)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, token }),
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
  })
  if (response.status !== 202) throw new Error(`Worker dispatch returned ${response.status}.`)
}

export function createGenerationEndpoint({
  getUsageStore = usageStore,
  resolve = resolveConfig,
  authorizePreview = isAdmin,
  dispatch = dispatchWorker,
} = {}) {
  return async (request, context) => {
    const { method } = request
    if (method !== 'GET' && method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
    const body = method === 'POST'
      ? await request.json().catch(() => ({}))
      : Object.fromEntries(new URL(request.url).searchParams)
    const { code, participantId, jobId } = body ?? {}
    if (typeof code !== 'string' || code.length > 180
      || typeof jobId !== 'string' || !JOB_ID.test(jobId)
      || typeof participantId !== 'string' || !PARTICIPANT_ID.test(participantId)) {
      return json({ error: 'Invalid generation request. Reload the design page and try again.' }, 400)
    }
    const preview = code.startsWith('preview-')
    if (preview && !(await authorizePreview(request))) {
      return json({ error: 'Researcher preview is not authenticated.' }, 401)
    }
    const key = preview ? `preview:${jobId}` : await usageKey(code, participantId)
    const bucket = getUsageStore()
    const current = await loadUsage(bucket, key)
    const activeJob = current?.data?.job

    if (activeJob?.id === jobId && current.data.code === code) {
      if (method === 'POST' && activeJob.status === 'queued' && Date.now() < activeJob.expiresAt) {
        return startWorker(dispatch, request, context, key, current.data)
      }
      return jobResponse(current.data)
    }
    if (method === 'GET') return json({ error: 'Generation request not found.' }, 404)
    if (activeJob && ['queued', 'running'].includes(activeJob.status) && Date.now() < activeJob.expiresAt) {
      return json({ error: 'A generation is already in progress. Return to the tab where it started.' }, 409)
    }
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_BASE_URL) {
      return json({ error: 'The AI Gateway is unavailable.' }, 503)
    }
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt || prompt.length > 4000) return json({ error: 'Enter a prompt between 1 and 4000 characters.' }, 400)
    const resolved = await resolve(request, code, body.previewConfig)
    if (!resolved) return json({ error: 'This AI study link is not valid.' }, 404)
    const successful = Number(current?.data?.successful) || 0
    const limit = Math.max(1, Math.min(10, Number(resolved.config.aiGenerationLimit) || 1))
    if (!preview && successful >= limit) {
      return json({ error: 'The generation limit for this participant has already been reached.' }, 429)
    }
    const config = {
      ...resolved.config,
      allowedShapes: supportedShapes(resolved.config.allowedShapes),
      palette: fixedPalette(),
      allowCustomColors: false,
    }
    if (!config.allowedShapes.length) return json({ error: 'This experiment has no supported design elements configured.' }, 400)
    const now = Date.now()
    const job = {
      id: jobId,
      token: crypto.randomUUID(),
      status: 'queued',
      requestedAt: new Date(now).toISOString(),
      expiresAt: now + JOB_LIFETIME_MS,
      config,
      prompt,
    }
    const record = { code, participantId, successful, job }
    const condition = current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
    const created = await bucket.setJSON(key, record, condition)
    if (!created.modified) {
      const latest = (await loadUsage(bucket, key))?.data
      if (latest?.job?.id === jobId && latest.code === code) {
        return latest.job.status === 'queued'
          ? startWorker(dispatch, request, context, key, latest)
          : jobResponse(latest)
      }
      return json({ error: 'Another generation request just started. Return to the tab where it started.' }, 409)
    }
    return startWorker(dispatch, request, context, key, record)
  }
}

export function createGenerationWorker({ getUsageStore = usageStore, generate = requestDesign } = {}) {
  return async (request) => {
    if (request.method !== 'POST') return
    const { key, token } = await request.json().catch(() => ({})) ?? {}
    if (typeof key !== 'string' || !/^(usage:[a-f0-9]{32}|preview:[a-f0-9-]{36})$/i.test(key)
      || typeof token !== 'string' || !JOB_ID.test(token)) return
    const bucket = getUsageStore()
    const current = await loadUsage(bucket, key)
    const job = current?.data?.job
    if (job?.token !== token || job.status !== 'queued' || Date.now() >= job.expiresAt) return
    const record = current.data
    const running = await bucket.setJSON(key, { ...record, job: { ...job, status: 'running' } }, { onlyIfMatch: current.etag })
    if (!running.modified) return
    const claimedEtag = running.etag ?? (await loadUsage(bucket, key))?.etag
    if (!claimedEtag) throw new Error('Generation claim is missing its storage version.')
    const condition = { onlyIfMatch: claimedEtag }
    const savedJob = { id: job.id, expiresAt: job.expiresAt }
    let result
    try {
      result = await generate(job)
    } catch (error) {
      console.error('Background generation failed', error?.message)
      await bucket.setJSON(key, { ...record, job: { ...savedJob, status: 'failed', error: 'The AI could not finish this design. Please try again.' } }, condition)
      return
    }
    const saved = await bucket.setJSON(key, {
      ...record,
      successful: record.successful + 1,
      updatedAt: new Date().toISOString(),
      job: { ...savedJob, status: 'done', result },
    }, condition)
    if (!saved.modified) console.error('Generation finished after its job was replaced.')
  }
}

export default createGenerationEndpoint()
export const config = { rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'] } }
