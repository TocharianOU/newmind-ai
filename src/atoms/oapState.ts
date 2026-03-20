import { atom } from "jotai"
import { oapGetUsage, oapLogout } from "../ipc"
import type { OAPUsage, OAPUser } from "../../types/oap"

export const oapUserAtom = atom<OAPUser | null>(null)
export const oapUsageAtom = atom<OAPUsage | null>(null)
export const isLoggedInOAPAtom = atom((get) => get(oapUserAtom))

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
  const oapUsage = get(oapUsageAtom)
  if (!oapUsage) return false
  const overMainQuota = oapUsage.total >= oapUsage.limit
  const couponExhausted = (oapUsage.coupon?.limit ?? 0) === 0
    || (oapUsage.coupon.limit > 0 && oapUsage.coupon.total >= oapUsage.coupon.limit)
  const hasUsdBalance = (oapUsage.usdBalance ?? 0) > 0
  return overMainQuota && couponExhausted && !hasUsdBalance
})

export const OAPLevelAtom = atom((get) => {
  const oapUser = get(oapUserAtom)
  return oapUser?.subscription.PlanName
})

export const isOAPProAtom = atom((get) => {
  const OAPLevel = get(OAPLevelAtom)
  return OAPLevel === "PRO"
})

