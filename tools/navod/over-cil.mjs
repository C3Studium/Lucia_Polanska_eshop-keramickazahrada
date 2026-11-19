/** Je na cíli (CIL) nasazený Návod? Vypíše počet klipů, nebo 404.  CIL=… EMAIL=… HESLO=… */
import { api, CIL } from './lib/api.mjs';
try {
  const { klipy } = await api('/admin/navod/klipy');
  console.log(`${CIL}: Návod nasazen, klipů ${Object.keys(klipy).length}`);
} catch (e) {
  console.log(`${CIL}: ${e.message.slice(0, 160)}`);
  process.exit(2);
}
