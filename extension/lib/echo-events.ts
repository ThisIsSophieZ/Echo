export const ECHO_LIST_CHANGED_KEY = "echo_list_changed_at"

export const notifyEchoListChanged = async () => {
  await chrome.storage.local.set({ [ECHO_LIST_CHANGED_KEY]: new Date().toISOString() })
}
