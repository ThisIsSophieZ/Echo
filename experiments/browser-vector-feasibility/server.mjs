import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, "../..")
const host = "127.0.0.1"
const port = Number(process.env.PORT || 4174)

const assetPaths = {
  model: [
    "evals/recall-benchmark/node_modules/@xenova/transformers/.cache/Xenova/multilingual-e5-small/config.json",
    "evals/recall-benchmark/node_modules/@xenova/transformers/.cache/Xenova/multilingual-e5-small/tokenizer.json",
    "evals/recall-benchmark/node_modules/@xenova/transformers/.cache/Xenova/multilingual-e5-small/tokenizer_config.json",
    "evals/recall-benchmark/node_modules/@xenova/transformers/.cache/Xenova/multilingual-e5-small/onnx/model_quantized.onnx"
  ],
  runtime: [
    "evals/recall-benchmark/node_modules/@xenova/transformers/dist/transformers.min.js",
    "evals/recall-benchmark/node_modules/@xenova/transformers/dist/ort-wasm-simd-threaded.wasm"
  ]
}

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".onnx", "application/octet-stream"],
  [".wasm", "application/wasm"]
])

const headers = {
  "Cache-Control": "no-store",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin"
}

const assetManifest = () => {
  const groups = Object.fromEntries(
    Object.entries(assetPaths).map(([group, paths]) => [
      group,
      paths.map((relativePath) => {
        const absolutePath = path.join(repoRoot, relativePath)
        return {
          path: relativePath.replaceAll("\\", "/"),
          bytes: existsSync(absolutePath) ? statSync(absolutePath).size : null
        }
      })
    ])
  )

  return {
    groups,
    missing: Object.values(groups).flat().filter((asset) => asset.bytes == null)
  }
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`)

  if (requestUrl.pathname === "/__asset-manifest") {
    response.writeHead(200, {
      ...headers,
      "Content-Type": "application/json; charset=utf-8"
    })
    response.end(JSON.stringify(assetManifest()))
    return
  }

  const requestedPath = decodeURIComponent(requestUrl.pathname)
  const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1)
  let absolutePath = path.resolve(repoRoot, relativePath)
  const relativeToRoot = path.relative(repoRoot, absolutePath)

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    response.writeHead(403, headers)
    response.end("Forbidden")
    return
  }

  if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
    absolutePath = path.join(absolutePath, "index.html")
  }

  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    response.writeHead(404, headers)
    response.end("Not found")
    return
  }

  response.writeHead(200, {
    ...headers,
    "Content-Length": statSync(absolutePath).size,
    "Content-Type": mimeTypes.get(path.extname(absolutePath)) || "application/octet-stream"
  })
  createReadStream(absolutePath).pipe(response)
})

server.listen(port, host, () => {
  console.log(
    `Vector browser feasibility: http://${host}:${port}/experiments/browser-vector-feasibility/`
  )
})
