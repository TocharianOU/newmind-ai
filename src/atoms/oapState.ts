import { atom } from "jotai"
import { oapGetMCPServers, oapGetUsage, oapLogout } from "../ipc"
import type { OAPMCPServer, OAPUsage, OAPUser } from "../../types/oap"

export const oapUserAtom = atom<OAPUser | null>(null)
export const oapUsageAtom = atom<OAPUsage | null>(null)
export const isLoggedInOAPAtom = atom((get) => get(oapUserAtom))

export const oapToolsAtom = atom<OAPMCPServer[]>([])

export const logoutOAPAtom = atom(null, (get, set) => {
  oapLogout()
  set(oapUserAtom, null)
  set(oapUsageAtom, null)
})

export const updateOAPUsageAtom = atom(null, async (get, set) => {
  if (!get(isLoggedInOAPAtom)) {
    return
  }

  const { data } = await oapGetUsage()
  set(oapUsageAtom, data)
})

export const isOAPUsageLimitAtom = atom((get) => {
  const OAPLevel = get(OAPLevelAtom)
  const oapUsage = get(oapUsageAtom)
  return oapUsage
        && OAPLevel !== "BASE"
        && oapUsage?.total >= oapUsage?.limit
        && ((oapUsage?.coupon?.limit ?? 0) === 0
          || (oapUsage?.coupon?.limit > 0 && oapUsage?.coupon?.total >= oapUsage?.coupon?.limit)
        )
})

export const OAPLevelAtom = atom((get) => {
  const oapUser = get(oapUserAtom)
  return oapUser?.subscription.PlanName
})

export const isOAPProAtom = atom((get) => {
  const OAPLevel = get(OAPLevelAtom)
  return OAPLevel === "PRO"
})

export const loadOapToolsAtom = atom(null, async (get, set) => {
  if(!get(isLoggedInOAPAtom)) {
    set(oapToolsAtom, [])
    return
  }
  const oapData = await oapGetMCPServers()
  if (oapData.status === "success") {
    set(oapToolsAtom, oapData.data)
  }
  return oapData
})
