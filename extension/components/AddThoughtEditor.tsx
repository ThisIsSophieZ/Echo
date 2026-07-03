import { useState } from "react"

type AddThoughtEditorProps = {
  onCancel: () => void
  onSave: (thought: string) => Promise<void>
}

export const AddThoughtEditor = ({
  onCancel,
  onSave
}: AddThoughtEditorProps) => {
  const [thought, setThought] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const save = async () => {
    const cleanThought = thought.trim()
    if (!cleanThought || isSaving) return

    setIsSaving(true)
    try {
      await onSave(cleanThought)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="mt-3 rounded-md border border-outline-variant bg-surface-container-lowest p-2"
      onClick={(event) => event.stopPropagation()}>
      <textarea
        autoFocus
        className="min-h-16 w-full resize-none bg-transparent text-body-sm text-on-surface outline-none"
        onChange={(event) => setThought(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault()
            void save()
          }
          if (event.key === "Escape") onCancel()
        }}
        placeholder="补充你的想法..."
        value={thought}
      />
      <div className="mt-1 flex justify-end gap-2">
        <button
          className="px-2 py-1 text-label-sm text-on-surface-variant hover:text-on-surface"
          onClick={onCancel}
          type="button">
          取消
        </button>
        <button
          className="rounded-full bg-primary-container px-3 py-1 text-label-sm font-medium text-on-primary disabled:opacity-50"
          disabled={!thought.trim() || isSaving}
          onClick={() => void save()}
          type="button">
          {isSaving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  )
}
