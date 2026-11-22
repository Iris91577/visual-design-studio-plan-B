import type { DesignElement, ShapeCategory, ShapeType } from './types'

export interface ShapeDef { type: ShapeType; name: string; category: ShapeCategory; lockAspect: boolean; isLine: boolean; defaultW: number; defaultH: number }
const s = (type: ShapeType, name: string, category: ShapeCategory, extra: Partial<ShapeDef> = {}): ShapeDef => ({ type, name, category, lockAspect: false, isLine: false, defaultW: .25, defaultH: .25, ...extra })

/** 67 editable assets. A placed asset always remains one measurable element. */
export const SHAPES: ShapeDef[] = [
  s('circle','Circle','basic',{lockAspect:true}),s('ellipse','Ellipse','basic',{defaultW:.32,defaultH:.2}),s('square','Square','basic',{lockAspect:true}),s('rectangle','Rectangle','basic',{defaultW:.34,defaultH:.2}),s('roundedRectangle','Rounded Rectangle','basic',{defaultW:.34,defaultH:.2}),s('capsule','Capsule','basic',{defaultW:.34,defaultH:.14}),s('triangle','Triangle','basic'),s('rightTriangle','Right Triangle','basic'),s('diamond','Diamond','basic'),s('trapezoid','Trapezoid','basic'),s('parallelogram','Parallelogram','basic'),
  s('pentagon','Pentagon','polygons'),s('hexagon','Hexagon','polygons'),s('heptagon','Heptagon','polygons'),s('octagon','Octagon','polygons'),s('nonagon','Nonagon','polygons'),s('decagon','Decagon','polygons'),s('dodecagon','Dodecagon','polygons'),
  s('star','Five-point Star','decorative'),s('fourPointStar','Four-point Star','decorative'),s('sixPointStar','Six-point Star','decorative'),s('sparkle','Sparkle','decorative'),s('heart','Heart','decorative'),s('crescent','Crescent','decorative'),s('sun','Sun','decorative'),s('burst','Burst','decorative'),
  s('blobOne','Organic Blob 1','organic'),s('blobTwo','Organic Blob 2','organic'),s('teardrop','Teardrop','organic'),s('leaf','Leaf','organic'),s('cloud','Cloud','organic',{defaultW:.34,defaultH:.2}),s('petal','Petal','organic'),s('pebble','Pebble','organic'),s('waveBlock','Wave Block','organic'),
  s('flowerFive','Five-petal Flower','nature'),s('flowerSix','Six-petal Flower','nature'),s('clover','Clover','nature'),s('snowflake','Snowflake','nature'),s('tree','Tree','nature'),s('mountain','Mountain','nature',{defaultW:.34,defaultH:.22}),
  s('semicircle','Semicircle','abstract'),s('quarterCircle','Quarter Circle','abstract'),s('sector','Sector','abstract'),s('ring','Ring','abstract'),s('arch','Arch','abstract'),s('chevron','Chevron','abstract'),s('shield','Shield','abstract'),s('ribbon','Ribbon','abstract'),
  s('line','Straight Line','lines',{isLine:true,defaultW:.4,defaultH:.04}),s('dashedLine','Dashed Line','lines',{isLine:true,defaultW:.4,defaultH:.04}),s('curve','Curve','lines',{defaultW:.36,defaultH:.14}),s('arc','Arc','lines'),s('waveLine','Wave Line','lines',{defaultW:.4,defaultH:.14}),s('zigzagLine','Zigzag Line','lines',{defaultW:.4,defaultH:.14}),s('arrow','Arrow','lines',{isLine:true,defaultW:.36,defaultH:.06}),s('doubleArrow','Double Arrow','lines',{isLine:true,defaultW:.36,defaultH:.06}),
  s('cross','Cross','symbols'),s('plus','Plus','symbols'),s('lightning','Lightning','symbols'),s('check','Check','symbols'),s('xMark','X Mark','symbols'),s('speechBubble','Speech Bubble','symbols'),s('locationPin','Location Pin','symbols'),s('musicNote','Music Note','symbols'),
  s('rectangleFrame','Rectangle Frame','frames',{defaultW:.34,defaultH:.24}),s('circleFrame','Circle Frame','frames',{lockAspect:true}),s('roundedFrame','Rounded Frame','frames',{defaultW:.34,defaultH:.24}),
]
export const SHAPE_MAP=Object.fromEntries(SHAPES.map(x=>[x.type,x])) as Record<ShapeType,ShapeDef>
export const ALL_SHAPE_TYPES=SHAPES.map(x=>x.type)
export const CATEGORY_LABELS:Record<ShapeCategory,string>={basic:'Basic Shapes',polygons:'Polygons',decorative:'Decorative',organic:'Organic Shapes',nature:'Floral & Nature',abstract:'Abstract',lines:'Lines & Curves',symbols:'Symbols & Icons',frames:'Frames & Borders'}

export interface Primitive { d:string; fill?:string; stroke?:string; strokeWidth?:number; dash?:string }
const f=(n:number)=>Math.round(n*100)/100
function poly(points:[number,number][],w:number,h:number){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),a=Math.min(...xs),b=Math.max(...xs),c=Math.min(...ys),d=Math.max(...ys);return'M'+points.map(([x,y])=>`${f(((x-a)/(b-a)-.5)*w)},${f(((y-c)/(d-c)-.5)*h)}`).join('L')+'Z'}
function regular(n:number,o=-90):[number,number][]{return Array.from({length:n},(_,i)=>{const a=(o+i*360/n)*Math.PI/180;return[Math.cos(a),Math.sin(a)]})}
function star(n:number,inner=.42):[number,number][]{return Array.from({length:n*2},(_,i)=>{const a=(-90+i*180/n)*Math.PI/180,r=i%2?inner:1;return[Math.cos(a)*r,Math.sin(a)*r]})}
function flower(n:number):[number,number][]{return Array.from({length:n*12},(_,i)=>{const a=i*Math.PI*2/(n*12),r=.58+.42*Math.cos(n*a);return[Math.cos(a)*r,Math.sin(a)*r]})}
export function lineWeight(w:number,h:number){return Math.max(4,Math.round(Math.min(w,h)*.012))}
const box=(w:number,h:number)=>`M${-w/2},${-h/2}H${w/2}V${h/2}H${-w/2}Z`

export function shapePrimitives(el:DesignElement,weight:number):Primitive[]{
 const {width:w,height:h,fill}=el,hw=w/2,hh=h/2,F=(d:string):Primitive[]=>[{d,fill}],S=(d:string,dash?:string):Primitive[]=>[{d,stroke:fill,strokeWidth:weight,dash}]
 if(el.type==='circle'||el.type==='ellipse')return F(`M${-hw},0A${hw},${hh} 0 1 0 ${hw},0A${hw},${hh} 0 1 0 ${-hw},0Z`)
 if(el.type==='square'||el.type==='rectangle')return F(box(w,h))
 if(['pentagon','heptagon','nonagon','decagon','dodecagon'].includes(el.type)){const n=({pentagon:5,heptagon:7,nonagon:9,decagon:10,dodecagon:12} as Record<string,number>)[el.type]||5;return F(poly(regular(n),w,h))}
 if(el.type==='hexagon')return F(poly(regular(6,0),w,h));if(el.type==='octagon')return F(poly(regular(8,22.5),w,h))
 switch(el.type){
 case'roundedRectangle':case'roundedFrame':{const d=`M${-hw+h*.18},${-hh}H${hw-h*.18}Q${hw},${-hh} ${hw},${-hh+h*.18}V${hh-h*.18}Q${hw},${hh} ${hw-h*.18},${hh}H${-hw+h*.18}Q${-hw},${hh} ${-hw},${hh-h*.18}V${-hh+h*.18}Q${-hw},${-hh} ${-hw+h*.18},${-hh}Z`;return el.type==='roundedFrame'?S(d):F(d)}
 case'capsule':return F(`M${-hw+hh},${-hh}H${hw-hh}A${hh},${hh} 0 0 1 ${hw-hh},${hh}H${-hw+hh}A${hh},${hh} 0 0 1 ${-hw+hh},${-hh}Z`)
 case'triangle':return F(`M0,${-hh}L${hw},${hh}L${-hw},${hh}Z`);case'rightTriangle':return F(`M${-hw},${-hh}V${hh}H${hw}Z`);case'diamond':return F(`M0,${-hh}L${hw},0L0,${hh}L${-hw},0Z`);case'trapezoid':return F(`M${-hw*.65},${-hh}H${hw*.65}L${hw},${hh}H${-hw}Z`);case'parallelogram':return F(`M${-hw*.65},${-hh}H${hw}L${hw*.65},${hh}H${-hw}Z`)
 case'star':return F(poly(star(5),w,h));case'fourPointStar':return F(poly(star(4,.2),w,h));case'sixPointStar':return F(poly(star(6,.48),w,h));case'sparkle':return F(poly(star(4,.1),w,h));case'burst':return F(poly(star(12,.7),w,h));case'sun':return F(poly(star(16,.72),w,h))
 case'heart':return F(`M0,${hh}C${-hw},${hh*.25} ${-hw},${-hh*.45} ${-hw*.45},${-hh*.65}C${-hw*.15},${-hh*.83} 0,${-hh*.55} 0,${-hh*.34}C0,${-hh*.55} ${hw*.15},${-hh*.83} ${hw*.45},${-hh*.65}C${hw},${-hh*.45} ${hw},${hh*.25} 0,${hh}Z`)
 case'crescent':return F(`M0,${-hh}A${hw},${hh} 0 1 0 0,${hh}A${hw*.72},${hh*.72} 0 0 1 0,${-hh}Z`)
 case'blobOne':return F(`M${-hw*.8},${-hh*.4}C${-hw*.4},${-hh} ${hw*.35},${-hh*.95} ${hw*.75},${-hh*.35}C${hw},${hh*.1} ${hw*.65},${hh*.9} 0,${hh}C${-hw*.75},${hh*.85} ${-hw},${hh*.15} ${-hw*.8},${-hh*.4}Z`);case'blobTwo':case'pebble':return F(`M${-hw},0C${-hw*.85},${-hh*.8} ${-hw*.1},${-hh} ${hw*.45},${-hh*.72}C${hw},${-hh*.45} ${hw},${hh*.5} ${hw*.35},${hh*.85}C${-hw*.35},${hh} ${-hw*.85},${hh*.55} ${-hw},0Z`)
 case'teardrop':return F(`M0,${-hh}C${hw*.8},${-hh*.25} ${hw},${hh*.35} 0,${hh}C${-hw},${hh*.35} ${-hw*.8},${-hh*.25} 0,${-hh}Z`);case'leaf':case'petal':return F(`M${-hw},0C${-hw*.45},${-hh} ${hw*.45},${-hh} ${hw},0C${hw*.45},${hh} ${-hw*.45},${hh} ${-hw},0Z`)
 case'cloud':return F(`M${-hw},${hh*.35}C${-hw},${-hh*.1} ${-hw*.68},${-hh*.35} ${-hw*.35},${-hh*.3}C${-hw*.2},${-hh} ${hw*.3},${-hh} ${hw*.42},${-hh*.42}C${hw*.8},${-hh*.45} ${hw},${-hh*.15} ${hw},${hh*.2}V${hh}H${-hw}Z`);case'waveBlock':return F(`M${-hw},${-hh}H${hw}V0C${hw*.5},${hh} 0,${hh} ${-hw},0Z`)
 case'flowerFive':return F(poly(flower(5),w,h));case'flowerSix':return F(poly(flower(6),w,h));case'clover':return F(poly(flower(4),w,h));case'snowflake':return F(poly(star(6,.16),w,h));case'tree':return F(`M0,${-hh}L${hw},${hh*.45}H${w*.12}V${hh}H${-w*.12}V${hh*.45}H${-hw}Z`);case'mountain':return F(`M${-hw},${hh}L${-w*.12},${-hh}L${w*.1},${-h*.25}L${w*.28},${-hh*.55}L${hw},${hh}Z`)
 case'semicircle':return F(`M${-hw},${hh}A${hw},${h} 0 0 1 ${hw},${hh}Z`);case'quarterCircle':return F(`M${-hw},${hh}V${-hh}A${w},${h} 0 0 1 ${hw},${hh}Z`);case'sector':return F(`M0,0L0,${-hh}A${hw},${hh} 0 0 1 ${hw},0Z`)
 case'ring':return F(`M${-hw},0A${hw},${hh} 0 1 0 ${hw},0A${hw},${hh} 0 1 0 ${-hw},0M${-hw*.62},0A${hw*.62},${hh*.62} 0 1 1 ${hw*.62},0A${hw*.62},${hh*.62} 0 1 1 ${-hw*.62},0Z`);case'arch':return F(`M${-hw},${hh}V0A${hw},${hh} 0 0 1 ${hw},0V${hh}H${hw*.62}V0A${hw*.62},${hh*.62} 0 0 0 ${-hw*.62},0V${hh}Z`);case'chevron':return F(`M${-hw},${-hh}L0,0L${hw},${-hh}V0L0,${hh}L${-hw},0Z`);case'shield':return F(`M${-hw},${-hh}H${hw}V0C${hw},${hh*.55} 0,${hh} 0,${hh}C0,${hh} ${-hw},${hh*.55} ${-hw},0Z`);case'ribbon':return F(`M${-hw},${-hh}H${hw}L${w*.35},0L${hw},${hh}H${-hw}L${-w*.35},0Z`)
 case'line':return S(`M${-hw},0H${hw}`);case'dashedLine':return S(`M${-hw},0H${hw}`,`${weight*2} ${weight*1.4}`);case'curve':return S(`M${-hw},${hh}C${-hw/3},${-hh*1.6} ${hw/3},${hh*1.6} ${hw},${-hh}`);case'arc':return S(`M${-hw},${hh}A${hw},${h} 0 0 1 ${hw},${hh}`);case'waveLine':return S(`M${-hw},0C${-w*.3},${-hh} ${-w*.2},${-hh} 0,0C${w*.2},${hh} ${w*.3},${hh} ${hw},0`);case'zigzagLine':return S(`M${-hw},${hh}L${-w*.25},${-hh}L0,${hh}L${w*.25},${-hh}L${hw},${hh}`)
 case'arrow':return[...S(`M${-hw},0H${hw*.55}`),...F(`M${hw},0L${hw*.5},${-hh}V${hh}Z`)];case'doubleArrow':return[...S(`M${-hw*.55},0H${hw*.55}`),...F(`M${hw},0L${hw*.5},${-hh}V${hh}ZM${-hw},0L${-hw*.5},${-hh}V${hh}Z`)]
 case'cross':case'plus':return F(`M${-w*.14},${-hh}H${w*.14}V${-h*.14}H${hw}V${h*.14}H${w*.14}V${hh}H${-w*.14}V${h*.14}H${-hw}V${-h*.14}H${-w*.14}Z`);case'lightning':return F(`M${w*.08},${-hh}L${-hw},${h*.08}H${-w*.06}L${-w*.18},${hh}L${hw},${-h*.08}H${w*.08}Z`);case'check':return S(`M${-hw},0L${-w*.12},${hh}L${hw},${-hh}`);case'xMark':return S(`M${-hw},${-hh}L${hw},${hh}M${hw},${-hh}L${-hw},${hh}`)
 case'speechBubble':return F(`${box(w,h*.72)}M${-w*.22},${h*.22}L${-w*.36},${hh}L${w*.02},${h*.22}Z`);case'locationPin':return F(`M0,${hh}C${-hw*.7},${h*.15} ${-hw},${-hh*.25} 0,${-hh}C${hw},${-hh*.25} ${hw*.7},${h*.15} 0,${hh}ZM0,${-h*.25}A${w*.15},${h*.15} 0 1 0 .1,${-h*.25}Z`);case'musicNote':return F(`M${w*.08},${-hh}H${hw}V${-h*.25}H${w*.2}V${h*.3}A${w*.22},${h*.22} 0 1 1 ${-w*.22},${h*.3}A${w*.22},${h*.22} 0 0 1 ${w*.08},${h*.3}Z`)
 case'rectangleFrame':return S(box(w-weight,h-weight));case'circleFrame':return S(`M${-hw+weight},0A${hw-weight},${hh-weight} 0 1 0 ${hw-weight},0A${hw-weight},${hh-weight} 0 1 0 ${-hw+weight},0`)
 }
 return F(box(w,h))
}
export function defaultSize(type:ShapeType,W:number,H:number){const d=SHAPE_MAP[type],b=Math.min(W,H),weight=lineWeight(W,H);let width=Math.round(b*d.defaultW),height=Math.round(b*d.defaultH);if(d.isLine)height=weight*4;if(d.lockAspect)height=width;return{width,height}}
