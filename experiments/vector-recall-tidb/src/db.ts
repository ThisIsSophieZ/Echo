import fs from "node:fs"

import mysql from "mysql2/promise"

import { INSTANCE_PATH } from "./config"

export const readConnectionString = (): string => {
  if (!fs.existsSync(INSTANCE_PATH)) {
    throw new Error(`Missing ${INSTANCE_PATH}. Run \`npm run create\` first.`)
  }
  const payload = JSON.parse(fs.readFileSync(INSTANCE_PATH, "utf8"))
  const connectionString = (payload.instance ?? payload)?.connectionString
  if (!connectionString) throw new Error("instance.json has no connectionString")
  return connectionString
}

// TiDB Cloud serverless requires TLS. Parse the mysql:// URL ourselves so we can
// attach ssl options that the bare connection string doesn't carry.
export const connect = async () => {
  const url = new URL(readConnectionString())
  return mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 4000),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || "test",
    ssl: { minVersion: "TLSv1.2" }
  })
}
