import { useEffect, useMemo, useRef, useState } from "react"
import { History, Home, Lightbulb, Plus, Search, Settings, X, Zap } from "lucide-react"

import { EchoCard } from "~components/EchoCard"
import {
  createEcho,
  deleteEcho,
  listRecentEchoes,
  restoreEcho,
  togglePin,
  type Echo
} from "~db/echoes"
import { ECHO_LIST_CHANGED_KEY, notifyEchoListChanged } from "~lib/echo-events"
import { searchEchoes } from "~lib/echo-search"
import { detectSourceApp } from "~lib/source-app"

import "./style.css"

type PageContext = {
  title?: string
  url?: string
  selection?: string
}

type SidebarView = "home" | "search"
const KEEP_DRAFT_KEY = "echo_keep_draft"
const UNDO_DELETE_MS = 5000

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
  const [view, setView] = useState<SidebarView>("home")
  const [searchQuery, setSearchQuery] = useState("")
  const [deletedEcho, setDeletedEcho] = useState<Echo | null>(null)
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)
  const undoTimer = useRef<number | null>(null)

  const sourceApp = useMemo(() => detectSourceApp(context.url), [context.url])
  const searchResults = useMemo(
    () => searchEchoes(echoes, searchQuery),
    [echoes, searchQuery]
  )
  const visibleEchoes = useMemo(() => {
    if (view === "search") {
      return searchResults.map((result) => result.echo)
    }

    if (filter === "pinned") return echoes.filter((echo) => echo.status === "pinned")
    return echoes
  }, [echoes, filter, searchResults, view])
  const searchMatches = useMemo(
    () => new Map(searchResults.map((result) => [result.echo.id, result.match])),
    [searchResults]
  )

  const showHome = () => {
    setView("home")
    setSearchQuery("")
  }

  const focusComposer = () => {
    showHome()
    setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>("[data-echo-composer]")?.focus()
    })
  }

  const refreshEchoes = async () => {
    setEchoes(await listRecentEchoes())
  }

  useEffect(() => {
    ;(async () => {
      const ctx = await getPageContext()
      setContext(ctx)
      const stored = await chrome.storage.local.get(KEEP_DRAFT_KEY)
      setThought(String(stored[KEEP_DRAFT_KEY] ?? ""))
      setIsDraftLoaded(true)
      await refreshEchoes()
    })()
  }, [])

  useEffect(() => {
    if (!isDraftLoaded) return

    const timer = window.setTimeout(() => {
      if (thought) {
        chrome.storage.local.set({ [KEEP_DRAFT_KEY]: thought })
      } else {
        chrome.storage.local.remove(KEEP_DRAFT_KEY)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [isDraftLoaded, thought])

  useEffect(
    () => () => {
      if (undoTimer.current != null) window.clearTimeout(undoTimer.current)
    },
    []
  )

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      const target = event.target
      const isEditing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      if (event.key === "/" && !isEditing) {
        event.preventDefault()
        setView("search")
        return
      }

      if (event.key === "Escape" && view === "search") {
        event.preventDefault()
        showHome()
      }
    }

    window.addEventListener("keydown", handleSearchShortcut)
    return () => window.removeEventListener("keydown", handleSearchShortcut)
  }, [view])

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
    await chrome.storage.local.remove(KEEP_DRAFT_KEY)
    await refreshEchoes()
    await notifyEchoListChanged()
    setIsSaving(false)
  }

  const handleDeleteEcho = async (id: string) => {
    const echo = echoes.find((item) => item.id === id)
    if (!echo) return

    await deleteEcho(id)
    setDeletedEcho(echo)
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => {
      setDeletedEcho(null)
      undoTimer.current = null
    }, UNDO_DELETE_MS)
    await refreshEchoes()
    await notifyEchoListChanged()
  }

  const handleUndoDelete = async () => {
    if (!deletedEcho) return

    if (undoTimer.current != null) window.clearTimeout(undoTimer.current)
    undoTimer.current = null
    await restoreEcho(deletedEcho)
    setDeletedEcho(null)
    await refreshEchoes()
    await notifyEchoListChanged()
  }

  const handleTogglePin = async (id: string) => {
    await togglePin(id)
    await refreshEchoes()
    await notifyEchoListChanged()
  }

  const handleOpenSource = async (echo: Echo) => {
    await chrome.runtime.sendMessage({
      type: "echo:open-source",
      url: echo.url,
      anchor: echo.capture?.anchor,
      fallbackText: echo.triggerText
    })
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
            aria-label="New echo"
            className="rounded-full p-2 text-secondary transition-colors hover:bg-secondary-container active:scale-95"
            onClick={focusComposer}
            title="New echo"
            type="button">
            <Plus size={20} />
          </button>
          <button
            aria-label="Settings"
            className="rounded-full p-2 text-secondary transition-colors hover:bg-secondary-container active:scale-95"
            title="Settings"
            type="button">
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-margin-side pb-24 pt-stack-lg">
        {view === "search" ? (
          <section className="mb-stack-lg">
            <div className="flex items-center gap-2 rounded-md border border-outline-variant bg-white px-3 py-2 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/30">
              <Search className="shrink-0 text-on-surface-variant" size={18} />
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search echoes..."
                type="search"
                value={searchQuery}
              />
              <button
                aria-label="Close search"
                className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                onClick={showHome}
                title="Close search"
                type="button">
                <X size={17} />
              </button>
            </div>
            <p className="mt-2 text-label-sm text-on-surface-variant">
              {searchQuery.trim()
                ? `${visibleEchoes.length} ${visibleEchoes.length === 1 ? "result" : "results"}`
                : `${echoes.length} echoes`}
            </p>
          </section>
        ) : (
          <section className="mb-stack-lg space-y-stack-md">
            <div className="rounded-lg border border-outline-variant bg-white p-3 shadow-sm">
              <label className="mb-2 flex items-center gap-2 text-label-md text-on-surface-variant">
                <Lightbulb size={16} className="text-tertiary" />
                New echo
              </label>
              <textarea
                className="min-h-24 w-full resize-none rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface outline-none transition focus:border-primary-container focus:bg-white focus:ring-2 focus:ring-primary-container/30"
                data-echo-composer
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
                <p className="text-label-sm text-on-surface-variant/70">
                  Ctrl/⌘ + Enter to save
                </p>
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
        )}

        {view === "home" ? (
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
        ) : null}

        <div className="space-y-stack-sm">
          {visibleEchoes.length ? (
            visibleEchoes.map((echo) => (
              <EchoCard
                key={echo.id}
                echo={echo}
                onDelete={handleDeleteEcho}
                onOpenSource={handleOpenSource}
                onTogglePin={handleTogglePin}
                searchMatch={
                  view === "search" && searchQuery.trim()
                    ? searchMatches.get(echo.id)
                    : undefined
                }
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant bg-white px-4 py-8 text-center text-body-md text-on-surface-variant">
              {view === "search" && searchQuery.trim()
                ? "No matching echoes."
                : "No echoes yet."}
            </div>
          )}
        </div>

        <div className="mt-stack-lg border-t border-outline-variant/30 pt-stack-lg text-center">
          <p className="text-label-sm uppercase italic tracking-wider text-on-surface-variant/50">
            End of Echo Stream
          </p>
        </div>
      </main>

      {deletedEcho ? (
        <div
          className="fixed bottom-[68px] left-margin-side right-margin-side z-[60] flex items-center justify-between gap-3 rounded-md bg-on-surface px-3 py-2 text-on-primary shadow-lg"
          role="status">
          <span className="text-body-sm">Echo deleted</span>
          <button
            className="text-label-md font-semibold text-primary-fixed hover:underline"
            onClick={handleUndoDelete}
            type="button">
            Undo
          </button>
        </div>
      ) : null}

      <nav className="fixed bottom-0 left-0 z-50 flex h-[56px] w-full items-center justify-around border-t border-outline-variant bg-surface px-gutter">
        <button
          aria-label="Home"
          className={`flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 ${
            view === "home"
              ? "bg-secondary-container px-4 py-1 text-on-secondary-container"
              : "p-2 text-on-surface-variant hover:bg-surface-container-high"
          }`}
          onClick={showHome}
          title="Home"
          type="button">
          <Home size={20} fill={view === "home" ? "currentColor" : "none"} />
        </button>
        <button
          aria-label="Search"
          className={`flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 ${
            view === "search"
              ? "bg-secondary-container px-4 py-1 text-on-secondary-container"
              : "p-2 text-on-surface-variant hover:bg-surface-container-high"
          }`}
          onClick={() => setView("search")}
          title="Search"
          type="button">
          <Search size={20} />
        </button>
        <button
          aria-label="History"
          className="flex items-center justify-center rounded-full p-2 text-on-surface-variant transition-all hover:bg-surface-container-high active:scale-90"
          title="History"
          type="button">
          <History size={20} />
        </button>
      </nav>
    </div>
  )
}

export default SidePanel
