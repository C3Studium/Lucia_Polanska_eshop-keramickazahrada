import { chromium } from 'playwright'
const ROUTES = [['home','/cz'],['store','/cz/store'],['dotazy','/cz/dotazy'],['vyroba','/cz/vyroba'],
  ['o-mne','/cz/o-mne'],['kurzy','/cz/kurzy'],['cart','/cz/cart'],['account','/cz/account'],
  ['legal','/cz/smluvni-podminky'],['doprava','/cz/doprava-a-platba']]
const VPS = [['desktop',1920,1080],['laptop14',1440,900],['laptop12',1280,720],['laptop-sm',1220,660],
  ['tabletL',1024,768],['tabletP',768,1024],['phone430',430,932],['phone390',390,844],
  ['phone320',320,568],['phoneL',932,430]]
const b = await chromium.launch()
const touch = await b.newContext({ hasTouch: true, isMobile: true })
const pad=(s,n)=>String(s).padEnd(n)
console.log(pad('route',11)+VPS.map(v=>pad(v[0],10)).join(''))
console.log('-'.repeat(111))
const problems=[]
for (const [rn,route] of ROUTES) {
  let line=pad(rn,11)
  for (const [vn,w,h] of VPS) {
    // phones/tablets measured as touch devices, so the touch rules are actually exercised
    const isTouch = w <= 1024
    const p = isTouch ? await touch.newPage() : await b.newPage()
    await p.setViewportSize({width:w,height:h})
    let cell='ERR'
    try {
      await p.goto(`http://localhost:8000${route}`,{waitUntil:'domcontentloaded',timeout:60000})
      await p.waitForTimeout(1300)
      const of = await p.evaluate(vw=>Math.max(0,Math.round(document.documentElement.scrollWidth-vw)),w)
      cell = of>2?`+${of}px`:'ok'
      if (of>2) problems.push(`${rn} @ ${vn}: +${of}px`)
    } catch(e){ problems.push(`${rn} @ ${vn}: ${e.message.slice(0,26)}`) }
    line+=pad(cell,10); await p.close()
  }
  console.log(line)
}
console.log('\nproblems: ' + (problems.length?'\n  '+problems.join('\n  '):'none'))
await b.close()
