import { useEffect, useRef, useState } from "react"
import { Bug, Check, ChevronDown, Copy } from "lucide-react"

import type { RelatedEchoAnalysis } from "~lib/echo-related"
import { formatProbeReport } from "~lib/probe-report"

type ProbeDebugPanelProps = {
  analysis: RelatedEchoAnalysis
}

export const ProbeDebugPanel = ({ analysis }: ProbeDebugPanelProps) => {
  const hasSelection = Boolean(analysis.selection)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")
  const resetTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (resetTimer.current != null) window.clearTimeout(resetTimer.current)
    },
    []
  )

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(formatProbeReport(analysis))
      setCopyState("copied")
    } catch {
      setCopyState("error")
    }

    if (resetTimer.current != null) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopyState("idle"), 1600)
  }

  return (
    <details className="group mb-stack-md border-b border-outline-variant/50 pb-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-label-sm text-on-surface-variant">
        <Bug size={13} />
        <span className="min-w-0 flex-1">
          {hasSelection
            ? `Probe · 已收到选区 · ${analysis.queryTokens.length} 个语料词 · 扫描 ${analysis.scannedCount} · ${analysis.acceptedCount} 过线`
            : "Probe · 等待页面选区"}
        </span>
        <ChevronDown
          className="transition-transform group-open:rotate-180"
          size={14}
        />
      </summary>

      <div className="mt-2 space-y-2 rounded-md bg-surface-container-low p-2 text-label-sm text-on-surface-variant">
        {hasSelection ? (
          <>
            <div className="flex justify-end">
              <button
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium transition-colors ${
                  copyState === "error"
                    ? "text-error"
                    : copyState === "copied"
                      ? "text-primary"
                      : "text-on-surface-variant hover:bg-secondary-container hover:text-primary"
                }`}
                onClick={() => void copyReport()}
                title="Copy Probe report"
                type="button">
                {copyState === "copied" ? <Check size={13} /> : <Copy size={13} />}
                {copyState === "copied"
                  ? "已复制"
                  : copyState === "error"
                    ? "复制失败"
                    : "复制精简报告"}
              </button>
            </div>
            <p className="line-clamp-2 break-words">
              选区：{analysis.selection}
            </p>
            <p className="break-words">
              参与评分：{analysis.queryTokens.join("、") || "无"}
            </p>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto border-t border-outline-variant/50 pt-2">
              {analysis.candidates.map((candidate) => (
                <div
                  className="border-b border-outline-variant/40 pb-2 last:border-0"
                  key={candidate.echo.id}>
                  <div className="flex items-start gap-2">
                    <span
                      className={
                        candidate.accepted
                          ? "font-semibold text-primary"
                          : "text-on-surface-variant"
                      }>
                      {candidate.score}
                    </span>
                    <p className="min-w-0 flex-1 break-words">
                      <span className="font-medium text-on-surface">
                        {candidate.echo.userThought ||
                          candidate.echo.capture?.title?.value ||
                          candidate.echo.title ||
                          candidate.echo.triggerText.slice(0, 36)}
                      </span>
                      {" · "}
                      {candidate.reason}
                    </p>
                  </div>
                  {candidate.details.length ? (
                    <div className="mt-1 space-y-0.5 pl-6 font-mono text-[9px] leading-3 text-on-surface-variant">
                      {candidate.details.map((detail) => (
                        <p className="break-words" key={detail}>
                          {detail}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {!analysis.candidates.length ? <p>当前没有 Echo 可扫描。</p> : null}
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <p>保持 Sidebar 打开，在支持的 LLM 页面划选文字。</p>
            <p className="text-on-surface-variant/80">
              若划词无响应，先刷新 LLM 标签页（扩展 reload 后 content script
              可能过期）。
            </p>
          </div>
        )}
      </div>
    </details>
  )
}
