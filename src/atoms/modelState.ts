import { atom } from "jotai"
import { LLMGroup, ModelGroupSetting } from "../../types/model"
import { defaultModelGroupSetting, getGroupTerm, removeGroup, updateGroup } from "../helper/model"

export const modelSettingsAtom = atom<ModelGroupSetting>(defaultModelGroupSetting())

export const modelGroupsAtom = atom<LLMGroup[]>((get) => get(modelSettingsAtom).groups)

export const disableModelGroupAtom = atom(
  null,
  (get, set, group: LLMGroup) => {
    const settings = get(modelSettingsAtom)
    const groupTerm = getGroupTerm(group)
    const newGroups = updateGroup(groupTerm, settings.groups || [], {
      active: false
    })

    if (newGroups) {
      set(modelSettingsAtom, {
        ...settings,
        groups: newGroups
      })
    }
  }
)

export const removeModelGroupAtom = atom(
  null,
  (get, set, group: LLMGroup) => {
    const settings = get(modelSettingsAtom)
    const groupTerm = getGroupTerm(group)
    const newGroups = removeGroup(groupTerm, settings.groups || [])
    if (newGroups) {
      set(modelSettingsAtom, {
        ...settings,
        groups: newGroups
      })
    }
  }
)
