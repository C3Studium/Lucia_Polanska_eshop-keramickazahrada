import fs from "node:fs"; import path from "node:path"
const loadEnv=(f)=>{if(!fs.existsSync(f))return;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=/^([A-Z0-9_]+)=(.*)$/.exec(l.trim());if(!m)continue;if(process.env[m[1]])continue;process.env[m[1]]=m[2].replace(/^["']|["']$/g,"")}}
loadEnv(path.join(process.cwd(),".env.local"))
const { getAdminClient, createDocumentRepository } = await import("@c3studium/valecms/server")
const docs = createDocumentRepository({ client: getAdminClient() })
let rows=[]; for(let p=1;p<=20;p++){const r=await docs.list({page:p,perPage:100});const l=r?.rows??[];if(!l.length)break;rows=rows.concat(l);if(rows.length>=(r.total??0))break}
const want = ["index.ecom-cta","index.ecom-desc","index.ecom-entry","kurzy.about","kurzy.cta","kurzy.sections","global.kontakt","global.mapa","global.news-popup"]
for (const key of want) {
  const d = rows.find(r=>r.data?.key===key)
  if (!d) { console.log(key, "→ NENÍ"); continue }
  const x = d.data
  console.log(`\n── ${key}`)
  if (x.title) console.log(`   title:    ${x.title}`)
  if (x.headline) console.log(`   headline: ${String(x.headline).replace(/\n/g," / ")}`)
  if (x.body) console.log(`   body:     ${String(x.body).replace(/<[^>]*>/g,"").slice(0,90)}…`)
  if (x.gallery?.length) console.log(`   gallery:  ${x.gallery.length} fotek`)
  if (x.items?.length) for (const i of x.items.slice(0,6)) console.log(`   · ${String(i.label??"").padEnd(28)} = ${String(i.value??"").slice(0,45)}`)
}
