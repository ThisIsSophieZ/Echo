export {}

import { createEcho } from "~db/echoes"
import type { EchoAnchor, EchoCapture, SelectionCapture } from "~capture/types"
import { notifyEchoListChanged } from "~lib/echo-events"
import { detectSourceApp } from "~lib/source-app"

const ADD_SELECTION_MENU_ID = "echo_add_selection"
const PENDING_ANCHOR_PREFIX = "echo_pending_anchor_"
const PENDING_ANCHOR_MAX_AGE_MS = 24 * 60 * 60 * 1000

type PendingAnchor = {
  anchor: EchoAnchor
  createdAt: number
}

const pendingAnchorKey = (tabId: number) => `${PENDING_ANCHOR_PREFIX}${tabId}`

const savePendingAnchor = (tabId: number, anchor: EchoAnchor) =>
  chrome.storage.session.set({
    [pendingAnchorKey(tabId)]: {
      anchor,
      createdAt: Date.now()
    } satisfies PendingAnchor
  })

const clearPendingAnchor = (tabId: number) =>
  chrome.storage.session.remove(pendingAnchorKey(tabId))

const getPendingAnchor = async (tabId: number) => {
  const key = pendingAnchorKey(tabId)
  const value = (await chrome.storage.session.get(key))[key] as PendingAnchor | undefined
  if (!value) return undefined

  if (Date.now() - value.createdAt > PENDING_ANCHOR_MAX_AGE_MS) {
    await chrome.storage.session.remove(key)
    return undefined
  }

  return value.anchor
}

// Ask the in-page content script to flash a quick "saved" confirmation near the
// selection. Fails silently on pages without the content script (e.g. non-LLM
// pages), where the echo is still saved without the visual cue.
const flashSavedOnTab = (tabId: number | undefined, sourceApp: string) => {
  if (tabId == null) return
  chrome.tabs
    .sendMessage(tabId, {
      type: "echo:show-saved",
      sourceApp
    })
    .catch(() => {})
}

const rebuildContextMenu = async () => {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: ADD_SELECTION_MENU_ID,
    title: "Add selection to Echo",
    contexts: ["selection"]
  })
}

const addSelectionAsEcho = async (
  quote: string,
  capture: EchoCapture | undefined,
  tab?: chrome.tabs.Tab,
  url?: string
) => {
  const sourceUrl = url ?? tab?.url

  const echo = await createEcho({
    triggerText: quote,
    sourceApp: detectSourceApp(sourceUrl),
    title: tab?.title,
    url: sourceUrl,
    status: "raw",
    capture
  })
  await notifyEchoListChanged()
  return echo
}

const getSelectionCaptureFromTab = async (
  tabId: number | undefined,
  fallback: string
): Promise<SelectionCapture> => {
  if (tabId == null) {
    return {
      plainText: fallback
    }
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "echo:get-selection-capture"
    })
    const selectionCapture = response?.selectionCapture as SelectionCapture | null
    if (selectionCapture?.plainText) return selectionCapture
  } catch {
    // Fall back to Chrome's plain context-menu selection below.
  }

  return {
    plainText: fallback
  }
}

const fallbackAnchor = (text: string): EchoAnchor => ({
  quote: {
    exactStart: text.replace(/\s+/g, " ").trim().slice(0, 160)
  }
})

const sendAnchorWhenReady = async (tabId: number, anchor: EchoAnchor) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "echo:locate-anchor",
        anchor
      })
      const found = Boolean(response?.found)
      if (found) await clearPendingAnchor(tabId)
      return found
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return false
}

const comparableUrl = (value: string) => {
  const parsed = new URL(value)
  parsed.hash = ""
  return parsed.href
}

const findOpenSourceTab = async (url: string) => {
  const expected = comparableUrl(url)
  const tabs = await chrome.tabs.query({})
  return tabs.find((tab) => {
    if (!tab.url) return false
    try {
      return comparableUrl(tab.url) === expected
    } catch {
      return false
    }
  })
}

const openSourceAtAnchor = async (url: string, anchor: EchoAnchor) => {
  const existingTab = await findOpenSourceTab(url)
  const tab =
    existingTab ??
    (await chrome.tabs.create({
      active: true,
      url
    }))

  if (tab.id == null) return false

  if (existingTab) {
    await chrome.tabs.update(tab.id, { active: true })
    if (tab.windowId != null) {
      await chrome.windows.update(tab.windowId, { focused: true })
    }
  }

  await savePendingAnchor(tab.id, anchor)
  return sendAnchorWhenReady(tab.id, anchor)
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Failed to enable side panel behavior", error))

  rebuildContextMenu().catch((error) => console.error("Failed to build context menu", error))
})

chrome.runtime.onStartup.addListener(() => {
  rebuildContextMenu().catch((error) => console.error("Failed to build context menu", error))
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== ADD_SELECTION_MENU_ID) return

  const fallback = (info.selectionText ?? "").trim()
  if (!fallback) return

  getSelectionCaptureFromTab(tab?.id, fallback)
    .then((selection) =>
      addSelectionAsEcho(selection.plainText, selection.capture, tab, info.pageUrl)
    )
    .then((echo) => flashSavedOnTab(tab?.id, echo.sourceApp))
    .catch((error) => console.error("Failed to add selection to Echo", error))
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "echo:get-pending-anchor") {
    const tabId = sender.tab?.id
    if (tabId == null) {
      sendResponse({})
      return false
    }

    getPendingAnchor(tabId)
      .then((anchor) => sendResponse({ anchor }))
      .catch(() => sendResponse({}))
    return true
  }

  if (message?.type === "echo:anchor-result") {
    const tabId = sender.tab?.id
    if (tabId != null && message.found) {
      clearPendingAnchor(tabId).catch(() => {})
    }
    return false
  }

  if (message?.type === "echo:open-source") {
    const url = String(message.url ?? "")
    const fallbackText = String(message.fallbackText ?? "").trim()
    if (!url || !fallbackText) {
      sendResponse({ ok: false, error: "Missing source URL or anchor text" })
      return false
    }

    const anchor = (message.anchor as EchoAnchor | undefined) ?? fallbackAnchor(fallbackText)
    openSourceAtAnchor(url, anchor)
      .then((found) => sendResponse({ ok: true, found }))
      .catch((error) =>
        sendResponse({ ok: false, error: String(error?.message ?? error) })
      )
    return true
  }

  if (message?.type !== "echo:add-selection") return false

  const quote = String(message.quote ?? "").trim()
  if (!quote) {
    sendResponse({ ok: false, error: "No selected text" })
    return false
  }

  const tab = sender.tab

  addSelectionAsEcho(
    quote,
    message.capture as EchoCapture | undefined,
    {
      ...tab,
      title: message.title ?? tab?.title,
      url: message.url ?? tab?.url
    } as chrome.tabs.Tab
  )
    .then((echo) =>
      sendResponse({ ok: true, echoId: echo.id, sourceApp: echo.sourceApp })
    )
    .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }))

  return true
})
