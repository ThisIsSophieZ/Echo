import { useEffect, useMemo, useState } from "react"
import { History, Home, Lightbulb, Plus, Search, Settings, Zap } from "lucide-react"

import { EchoCard } from "~components/EchoCard"
import { createEcho, deleteEcho, listRecentEchoes, togglePin, type Echo } from "~db/echoes"
import { ECHO_LIST_CHANGED_KEY, notifyEchoListChanged } from "~lib/echo-events"
import { detectSourceApp } from "~lib/source-app"

import "./style.css"

type PageContext = {
  title?: string
  url?: string
  selection?: string
}

const getCurrentTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

const getPageContext = async (): Promise<PageContext> => {
  const tab = await getCurrentTab()

  if (!tab?.id) {
    return {
      title: tab?.title,
      url: tab?.url
    }
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "echo:get-page-context"
    })

    return {
      title: response?.title ?? tab.title,
      url: response?.url ?? tab.url,
      selection: response?.selection ?? ""
    }
  } catch {
    return {
      title: tab.title,
      url: tab.url
    }
  }
}

const SidePanel = () => {
  const [context, setContext] = useState<PageContext>({})
  const [thought, setThought] = useState("")
  const [echoes, setEchoes] = useState<Echo[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [filter, setFilter] = useState<"all" | "insights" | "pinned">("all")

  const sourceApp = useMemo(() => detectSourceApp(context.url), [context.url])
  const visibleEchoes = useMemo(() => {
    if (filter === "pinned") return echoes.filter((echo) => echo.status === "pinned")
    return echoes
  }, [filter, echoes])

  const refreshEchoes = async () => {
    setEchoes(await listRecentEchoes())
  }

  useEffect(() => {
    getPageContext().then(setContext)
    refreshEchoes()
  }, [])

  useEffect(() => {
    const handleEchoListChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return
      if (!changes[ECHO_LIST_CHANGED_KEY]) return
      refreshEchoes()
    }

    chrome.storage.onChanged.addListener(handleEchoListChanged)
    return () => chrome.storage.onChanged.removeListener(handleEchoListChanged)
  }, [])

  const saveEcho = async () => {
    const cleanThought = thought.trim()
    if (!cleanThought) return

    setIsSaving(true)
    await createEcho({
      triggerText: cleanThought,
      userThought: cleanThought,
      sourceApp,
      title: context.title,
      url: context.url,
      status: "confirmed"
    })

    setThought("")
    await refreshEchoes()
    await notifyEchoListChanged()
    setIsSaving(false)
  }

  const handleDeleteEcho = async (id: string) => {
    await deleteEcho(id)
    await refreshEchoes()
    await notifyEchoListChanged()
  }

  const handleTogglePin = async (id: string) => {
    await togglePin(id)
    await refreshEchoes()
    await notifyEchoListChanged()
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-on-surface">
      <header className="sticky top-0 z-50 flex h-[48px] w-full items-center justify-between border-b border-outline-variant bg-surface px-margin-side">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-primary" />
          <h1 className="text-headline-sm font-semibold text-on-surface">Echo</h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="rounded-full p-2 text-secondary transition-colors hover:bg-secondary-container active:scale-95"
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>(".chrome-input")
              input?.focus()
            }}
            type="button">
            <Plus size={20} />
          </button>
          <button
            className="rounded-full p-2 text-secondary transition-colors hover:bg-secondary-container active:scale-95"
            type="button">
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-margin-side pb-24 pt-stack-lg">
        <section className="mb-stack-lg space-y-stack-md">
          <div className="rounded-lg border border-outline-variant bg-white p-3 shadow-sm">
            <label className="mb-2 flex items-center gap-2 text-label-md text-on-surface-variant">
              <Lightbulb size={16} className="text-tertiary" />
              New echo
            </label>
            <textarea
              className="min-h-24 w-full resize-none rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface outline-none transition focus:border-primary-container focus:bg-white focus:ring-2 focus:ring-primary-container/30"
              placeholder="Add something to Echo..."
              value={thought}
              onChange={(event) => setThought(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault()
                  saveEcho()
                }
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-label-sm text-on-surface-variant/70">Ctrl/⌘ + Enter to save</p>
              <button
                className="rounded-full bg-primary-container px-3 py-1.5 text-label-md font-medium text-on-primary transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
                disabled={!thought.trim() || isSaving}
                onClick={saveEcho}
                type="button">
                {isSaving ? "Saving..." : "Keep"}
              </button>
            </div>
          </div>

        </section>

        <div className="mb-stack-md flex items-center gap-2 overflow-x-auto pb-1">
          {[
            ["all", "All Echoes"],
            ["insights", "Insights"],
            ["pinned", "Pinned"]
          ].map(([key, label]) => (
            <button
              className={`whitespace-nowrap rounded-full px-3 py-1 text-label-md ${
                filter === key
                  ? "bg-secondary-container text-on-secondary-container"
                  : "border border-outline-variant text-secondary hover:bg-surface-container-low"
              }`}
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              type="button">
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-stack-sm">
          {visibleEchoes.length ? (
            visibleEchoes.map((echo) => (
              <EchoCard
                key={echo.id}
                echo={echo}
                onDelete={handleDeleteEcho}
                onTogglePin={handleTogglePin}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant bg-white px-4 py-8 text-center text-body-md text-on-surface-variant">
              No echoes yet.
            </div>
          )}
        </div>

        <div className="mt-stack-lg border-t border-outline-variant/30 pt-stack-lg text-center">
          <p className="text-label-sm uppercase italic tracking-wider text-on-surface-variant/50">
            End of Echo Stream
          </p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 z-50 flex h-[56px] w-full items-center justify-around border-t border-outline-variant bg-surface px-gutter">
        <button
          className="flex items-center justify-center rounded-full bg-secondary-container px-4 py-1 text-on-secondary-container transition-all duration-150 active:scale-90"
          type="button">
          <Home size={20} fill="currentColor" />
        </button>
        <button
          className="flex items-center justify-center rounded-full p-2 text-on-surface-variant transition-all hover:bg-surface-container-high active:scale-90"
          type="button">
          <Search size={20} />
        </button>
        <button
          className="flex items-center justify-center rounded-full p-2 text-on-surface-variant transition-all hover:bg-surface-container-high active:scale-90"
          type="button">
          <History size={20} />
        </button>
      </nav>
    </div>
  )
}

export default SidePanel
