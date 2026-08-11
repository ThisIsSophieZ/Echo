import fs from "node:fs"

import { DATA_DIR, INSTANCE_PATH, ZERO_API_KEY, ZERO_ENDPOINT } from "./config"

const main = async () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (ZERO_API_KEY) headers.Authorization = `Bearer ${ZERO_API_KEY}`

  console.log(`[create] POST ${ZERO_ENDPOINT} (${ZERO_API_KEY ? "with key" : "keyless"})`)
  const response = await fetch(ZERO_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ tag: "echo-vector-recall-experiment" })
  })

  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`TiDB Cloud Zero returned ${response.status}: ${raw}`)
  }

  const payload = JSON.parse(raw)
  const instance = payload.instance ?? payload
  if (!instance?.connectionString) {
    throw new Error(`No connectionString in response: ${raw}`)
  }

  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(INSTANCE_PATH, JSON.stringify(payload, null, 2), "utf8")

  console.log(`[create] instance ready -> ${INSTANCE_PATH}`)
  if (instance.expiresAt) console.log(`[create] expires at: ${instance.expiresAt}`)
  const claimUrl = instance.claimInfo?.claimUrl
  if (claimUrl) console.log(`[create] claim (only if you want to keep it): ${claimUrl}`)
}

main().catch((error) => {
  console.error("[create] failed:", error.message)
  if (error.cause) console.error("[create] cause:", error.cause)
  process.exit(1)
})
