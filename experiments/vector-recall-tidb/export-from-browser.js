// Export real Echoes from the extension's IndexedDB — no product code changes.
//
// HOW TO USE (only when you want to test with your real data instead of the seed):
//   1. Open the Echo side panel in Chrome.
//   2. Right-click inside the side panel -> Inspect (this opens DevTools for the
//      panel page, which owns the `echo-sidebar` IndexedDB database).
//   3. Paste this whole file into the Console and press Enter.
//   4. A file `echoes.json` downloads. Move it to `data/echoes.json` here,
//      then run `npm run load && npm run compare`.
//
// It reads the raw `sparks` object store, so it works without importing Dexie.

;(async () => {
  const DB_NAME = "echo-sidebar"
  const STORE = "sparks"

  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  const keep = new Set(["raw", "inferred", "confirmed", "pinned"])
  const echoes = records.filter((r) => keep.has(r.status ?? "raw"))

  console.log(`Exporting ${echoes.length} echoes (of ${records.length} total)`) 

  const blob = new Blob([JSON.stringify(echoes, null, 2)], {
    type: "application/json"
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "echoes.json"
  a.click()
  URL.revokeObjectURL(url)
})()
