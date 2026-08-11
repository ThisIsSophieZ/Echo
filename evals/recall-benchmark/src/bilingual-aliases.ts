type AliasGroup = {
  id: string
  phrases: string[]
}

// Frozen from Report 4 dev topics. Holdout labels must not influence this list.
const DEV_ALIAS_GROUPS: AliasGroup[] = [
  {
    id: "heap",
    phrases: ["heap", "堆", "min-heap", "小根堆", "max-heap", "大根堆", "shift down", "下沉"]
  },
  {
    id: "memory-retrieval",
    phrases: ["memory", "记忆", "retrieval", "检索", "recall", "召回"]
  },
  {
    id: "chrome-store",
    phrases: ["chrome web store", "chrome 商店", "chrome 应用商店"]
  },
  {
    id: "screenshots",
    phrases: ["screenshot", "screenshots", "截图", "mockup"]
  },
  {
    id: "native-english-copy",
    phrases: ["native english", "地道英文", "英文文案"]
  },
  {
    id: "marketing-copy",
    phrases: ["marketing copy", "营销文案", "copywriting"]
  },
  {
    id: "email-routing",
    phrases: ["email routing", "邮件路由", "catch-all", "邮件转发"]
  },
  {
    id: "dynamic-dom",
    phrases: ["dynamic dom", "动态 dom", "mutationobserver"]
  },
  {
    id: "elevator-pitch",
    phrases: ["elevator pitch", "电梯演讲"]
  }
]

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase()

export const expandWithDevAliases = (selection: string) => {
  const normalizedSelection = normalize(selection)
  const matchedGroups = DEV_ALIAS_GROUPS.filter((group) =>
    group.phrases.some((phrase) => normalizedSelection.includes(normalize(phrase)))
  )

  if (!matchedGroups.length) {
    return { selection, matchedGroupIds: [] as string[] }
  }

  const additions = new Set<string>()
  for (const group of matchedGroups) {
    for (const phrase of group.phrases) {
      if (!normalizedSelection.includes(normalize(phrase))) additions.add(phrase)
    }
  }

  return {
    selection: `${selection}\n${[...additions].join(" ")}`,
    matchedGroupIds: matchedGroups.map((group) => group.id)
  }
}
