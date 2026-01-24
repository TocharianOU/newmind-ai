import { useCallback } from "react"
import { ModelConfig } from "../atoms/configState"
import { FieldDefinition } from "../atoms/interfaceState"

export default function useModelInterface() {
  const fetchListField = useCallback(async (def: FieldDefinition, fields: Record<string, any>) => {
    if (!def || !def.listCallback || !def.listDependencies) {
      return []
    }

    const deps = def.listDependencies.reduce((acc, dep) => ({
      ...acc,
      [dep]: fields[dep as keyof ModelConfig] || ""
    }), {})

    const allDepsHaveValue = def.listDependencies.every(dep => fields[dep as keyof ModelConfig] !== undefined)
    if (allDepsHaveValue) {
      return def.listCallback(deps)
    }

    return []
  }, [])

  return {
    fetchListField,
  }
}