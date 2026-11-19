/** Rychlý přehled sandboxu pro psaní scénářů: kolekce › kategorie › výrobky. */
import { api } from './lib/api.mjs';

if (process.argv[2] === 'smazat') {
  for (const id of process.argv.slice(3)) { await api(`/admin/products/${id}`, null, 'DELETE'); console.log('smazáno', id); }
  process.exit(0);
}
const { collections } = await api('/admin/collections?limit=100&fields=id,title,handle');
const { product_categories } = await api('/admin/product-categories?limit=200&fields=id,name,handle,metadata');
const { products } = await api('/admin/products?limit=200&fields=id,title,status,collection_id,categories.id,variants.id');
for (const c of collections) {
  console.log(`■ ${c.title} (${c.id})`);
  for (const k of product_categories.filter((k) => k.metadata?.collection_id === c.id)) console.log(`   › ${k.name} (${k.id})`);
  for (const p of products.filter((p) => p.collection_id === c.id)) console.log(`     · ${p.title} [${p.status}] ${p.id} kat:${p.categories.map((x) => product_categories.find((k) => k.id === x.id)?.name).join(',')}`);
}
for (const p of products.filter((p) => !p.collection_id)) console.log(`  (bez kolekce) ${p.title} ${p.id}`);
