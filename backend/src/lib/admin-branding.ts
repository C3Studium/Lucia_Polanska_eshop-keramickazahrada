/**
 * Záložka prohlížeče v administraci (19. 11. 2026, Matěj): název
 * „Admin – Keramická zahrada" místo „Medusa" a ikona s logem „Lu" s ptáčkem.
 *
 * Medusa skládá titulek sama přes react-helmet („Stránka - Medusa") a ikonu
 * nemá žádnou (`data:,` zástupce) — medusa-config.js při sestavení adminu
 * vymění zástupce za ADMIN_FAVICON_HREF a vloží ADMIN_TITLE_JS, který
 * „Medusa" v titulku průběžně přepisuje.
 */

export const ADMIN_TITLE = "Admin – Keramická zahrada"

/** Logo na krémovém čtverci značky (#ffe8d6), 64 × 64 PNG. */
export const ADMIN_FAVICON_HREF = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAGkUlEQVR42u1aaVRVVRS+KKICKioO4YBzOCaKOJCzaVmmy0azZWkOZYZTGmK6LFQ0lpqo4TyTkZKSA+EQTkhOQIBmKeaYNqzWap7bve+s9l3nPu573De4dOH5cdZ93HfPPfv79rf32fs8NLp5lu7moSkCFAGKAEWAIkARoAhQBCgCFAGKAEWAIkARcOeMv67li4HPGSmrqV2bFlSmTBnqEN6a0resFPf/+aqw9BLA4BJmvko+Pj6G4evrS5mp671Cwh1FwL83zojrzYLDFBM9igY91FuAhedxBfhy5cqJa517aonn5HmlhoBfLp6mqS+/QBUrVhBgQYC9AnBdt3iueP7Pq5+WrhBgWV/45CMK8PcvFgJMSNNGoXQtN1M8+/f1gttPAIzwRI72BPxcdIpqBFcrRoBMQttWzeni8b1uk6B5W77eVgCHgdkoW7asuFarGkS7Nie5lRS9RgDiNjkpgb44tsdjQhjEuaO7qXx5P4cEyCT4+fnRjg1LXVaC5i3PD3tyoDCkW+cIrykg78AHOkArJPj7V6TCg2kuKUHzNOZxTbMxz8a0bt5Mz8ruqoCNz9m3zRIB8s7Qu2snvYCysr7mqed/KjpJLe9tohuCvdvTAoXf/XXBEQqqUtkSATIJc6ZNsBwKmielKq4LZk3VYxDXlBULPNqW7Eno0SXSIHNng3eGzhFtb20OYOMunz4gKjI2IKJtK5fkZ4XgcSOGGrxrdWS8t8qSIzRPYvTpQf1vifflNY7t3iK8D+/aV4TOEmLfHlGWHKG5m/jQocm1eVRkO91r3q4HpkWP1teymhQxdm5KKtEhmjvS/+1SrmhPOe6ggGybp5wlP0eegHEgzpmn8Ez0yGcNsY6QABlm6mCSeEt29m7NHe8vT5glFuAiZcywp0pkWu7v7T1sVQnp764QSnOmApkU/J26NtGpbZqrcrx0ch+F1K6pL1gzuLq45wgQLzz5peEioclex+etqxbR0McGiD3fkbdwj9+Nz6cyttq2uvE0oG9PahnWhBqF1qPg6lWpQoXyul0cmtgRnBGtuer9EUMGG7yfOGe6Q4YZDAqj6tWC6IHuXfQQwnX7ukTdm6H1QsS+74gEgPjjSp5DMD+cP0FFxzNofWI8hTVtZCCBT5DMbNRcAb9/61rD4cT9Hds7TXxs7GdHdonnBz7YS/8OfQN7jBse7u85J2C+WX64kX+ITqSn0O7k5bR4diylrFxIl0/t179HF/lov166Gvp06+zQTs1q4vv9cp4AzHEGBcAIM+mz4fAY/t64dJ6YN3b4kP9L52X6SY9M6LJ5MwwKkfNHQWYaxY4fTV07tRfdn33sw9vJ7yQYFIG6hL9/O26aob6wTABPQHmJF7HXYIy9rABcJoPnxrwySsyJi4kWMQ9jAZzlzwQgucoJE6Dnz5hMHdu1KZb4UCKDjBa2MpzDETkB85l45ApWV60awfR51h7XFMBgzmenGw4msAWi/WWFgAR+Fobn7k+lpPkzhTxx75nBj4h5lQIDdLAggD3J4BAiaxbNppFDH6dWYU31GGbiu3QIpzemjKMjaZvo+3PZYm2AhRKXzH1drMs2MflvvhatvwPzf/0yxzoBLH/EEHsKRh3avsHANA/c7xnVUQcE0pDYsB/LFSPur1kYR9+eyRLdo9m5H8saWXxRXIw4Z3ClwpSbtWaNG1DD+nVFIn5iQD9rBPBiyPKy8VPGjjDIG7GGhAaQDIKfhedhSO2aNXRQD/fprp/jYcTHTtTBsjqaNAwVYZOfuaMYKKwLtTFAOVma5SJc976/Wijku7PHxHZcIgE88fCOjYbyE7L88cJJPRPHT59E9euGGCo0Bo/PRz/cLJ7t36cbNahXhzYsidcNZ/VANTy/alAV2rZmsUi4Mmg5xNxp3HhY2gXko+n7WoYZ9tNUm3HfFB6lSS8+LwoPR+0oBsjh9yHuGJRZoowMbyPm8JEWvvcEtJlDWTUl7gL8ADcgchvauEF9CgwIKJaNsb2hTEUSwhbHfYEsU7NTY/6M7Jy1M9mrJ8tunQcweEi1pEMIAJ845jm6YjsTMKve3AHhLY97dCoM7yEWZUnLzUXlSoEC+PW8g4YYZcm6I1251r+tBCCxobGQQXMIILmh67ua87FXktMd+fM4Kit5S+IQQAmMI+rSBNyUAK7MWO6I87dsP0/zMXdpAm5KADcp6PGnTxhj+OGxtAFX/yKjCFAEKAIUAYoARYAiQBGgCFAEKAIUAYqAu5iA/wDWgLm6AINr7wAAAABJRU5ErkJggg=="

export const ADMIN_TITLE_JS = `(function () {
  var NAZEV = "Admin – Keramická zahrada";
  function oprav() {
    var t = document.title || "";
    var novy = t === "Medusa" || !t ? NAZEV : t.replace(/\\s+-\\s+Medusa$/, " · " + NAZEV);
    if (novy !== t) document.title = novy;
  }
  oprav();
  new MutationObserver(oprav).observe(document.head, { subtree: true, childList: true, characterData: true });
})();`
