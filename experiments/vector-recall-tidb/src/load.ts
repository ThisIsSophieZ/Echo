import fs from "node:fs"

import { ECHOES_PATH, EMBED_DIM, TABLE } from "./config"
import { connect } from "./db"
import { buildDocText, type Echo } from "./echo-shape"
import { embedPassages, toVectorLiteral } from "./embed"

const main = async () => {
  if (!fs.existsSync(ECHOES_PATH)) {
    throw new Error(`Missing ${ECHOES_PATH}. Run \`npm run seed\` first.`)
  }
  const echoes: Echo[] = JSON.parse(fs.readFileSync(ECHOES_PATH, "utf8"))
  console.log(`[load] ${echoes.length} echoes to embed + load`)

  const docs = echoes.map(buildDocText)
  const vectors = await embedPassages(docs)
  console.log(`[load] embedded ${vectors.length} docs (dim=${vectors[0]?.length})`)

  const connection = await connect()
  console.log("[load] connected to TiDB Cloud Zero")

  await connection.query(`DROP TABLE IF EXISTS ${TABLE}`)
  await connection.query(`
    CREATE TABLE ${TABLE} (
      id VARCHAR(64) PRIMARY KEY,
      user_thought TEXT,
      title TEXT,
      trigger_text TEXT,
      inferred_thought TEXT,
      source_app VARCHAR(64),
      url TEXT,
      created_at VARCHAR(40),
      doc_text TEXT,
      embedding VECTOR(${EMBED_DIM})
    )
  `)
  console.log(`[load] created table ${TABLE} with VECTOR(${EMBED_DIM})`)

  for (let index = 0; index < echoes.length; index += 1) {
    const echo = echoes[index]
    await connection.execute(
      `INSERT INTO ${TABLE}
        (id, user_thought, title, trigger_text, inferred_thought, source_app, url, created_at, doc_text, embedding)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        echo.id,
        echo.userThought ?? "",
        echo.title ?? "",
        echo.triggerText ?? "",
        echo.inferredThought ?? "",
        echo.sourceApp ?? "",
        echo.url ?? "",
        echo.createdAt ?? "",
        docs[index],
        toVectorLiteral(vectors[index])
      ]
    )
  }

  const [rows] = await connection.query(`SELECT COUNT(*) AS n FROM ${TABLE}`)
  console.log(`[load] inserted rows: ${(rows as any)[0].n}`)
  await connection.end()
}

main().catch((error) => {
  console.error("[load] failed:", error.message)
  process.exit(1)
})
