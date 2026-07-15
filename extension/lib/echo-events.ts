export const ECHO_LIST_CHANGED_KEY = "echo_list_changed_at"
export const PENDING_USER_THOUGHT_KEY = "echo_pending_user_thought"

export type PendingUserThought = {
  echoId: string
  thought: string
  at: number
}

export const notifyEchoListChanged = async () => {
  await chrome.storage.local.set({ [ECHO_LIST_CHANGED_KEY]: new Date().toISOString() })
}

export const enqueuePendingUserThought = async (
  echoId: string,
  thought: string
) => {
  const payload: PendingUserThought = {
    echoId,
    thought: thought.trim(),
    at: Date.now()
  }
  if (!payload.echoId || !payload.thought) return
  await chrome.storage.local.set({ [PENDING_USER_THOUGHT_KEY]: payload })
}

export const readPendingUserThought = async () => {
  const stored = await chrome.storage.local.get(PENDING_USER_THOUGHT_KEY)
  return (stored[PENDING_USER_THOUGHT_KEY] as PendingUserThought | undefined) ?? null
}

export const clearPendingUserThought = async () => {
  await chrome.storage.local.remove(PENDING_USER_THOUGHT_KEY)
}
