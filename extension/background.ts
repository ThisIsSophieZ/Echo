export {}

import { createEcho } from "~db/echoes"
import { notifyEchoListChanged } from "~lib/echo-events"
import { detectSourceApp } from "~lib/source-app"

const ADD_SELECTION_MENU_ID = "echo_add_selection"

const openSidePanel = async (tab?: chrome.tabs.Tab) => {
  if (tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id })
    return
  }

  if (tab?.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId })
  }
}

const rebuildContextMenu = async () => {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: ADD_SELECTION_MENU_ID,
    title: "Add selection to Echo",
    contexts: ["selection"]
  })
}

const addSelectionAsEcho = async (quote: string, tab?: chrome.tabs.Tab, url?: string) => {
  const sourceUrl = url ?? tab?.url

  await createEcho({
    triggerText: quote,
    sourceApp: detectSourceApp(sourceUrl),
    title: tab?.title,
    url: sourceUrl,
    status: "raw"
  })
  await notifyEchoListChanged()
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

  const quote = (info.selectionText ?? "").trim()
  if (!quote) return

  addSelectionAsEcho(quote, tab, info.pageUrl)
    .then(() => openSidePanel(tab))
    .catch((error) => console.error("Failed to add selection to Echo", error))
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "echo:add-selection") return false

  const quote = String(message.quote ?? "").trim()
  if (!quote) {
    sendResponse({ ok: false, error: "No selected text" })
    return false
  }

  const tab = sender.tab

  addSelectionAsEcho(quote, {
    ...tab,
    title: message.title ?? tab?.title,
    url: message.url ?? tab?.url
  } as chrome.tabs.Tab)
    .then(() => openSidePanel(tab))
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }))

  return true
})
