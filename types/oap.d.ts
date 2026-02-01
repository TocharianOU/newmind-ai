export interface MCPServerResponse {
  status: "success" | "error"
  error: string | null
  data: OAPMCPServer[]
}

export interface OAPMCPServer {
  id: string
  instanceId?: string
  name: string
  plan: string
  description: string
  tags: string[]
  transport: string
  url: string
  headers: Record<string, string> | null
  version: string | null
  downloadUrl?: string | null
  configSchema: Record<string, any> | null
  command?: string | null
  args?: string[] | null
}

export interface OAPModelDescription {
  id: string
  model_id: string
  name: string
  icon: string
  provider: string
  token_cost: number
  description: string
  extra: {
      feature: string
      special: string[]
  }
}

export type OAPModelDescriptionParam = {
  models: string[]
}

export type ApiSuccess<T> = {
  status: "success"
  error: null
  data: T
}

export type ApiError = {
  status: "error"
  error: string
  data: null
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export type MCPServerSearchParam = {
  search_input: string
  tags?: string[] //for escaping pre-fetch
  text_tag?: boolean
  search_tag?: boolean
  document_tag?: boolean
  image_tag?: boolean
  audio_video_tag?: boolean
  page?: number
  /** 0 all, 1 base, 2 pro */
  filter?: 0 | 1 | 2
  /** 0 popular, 1 newest */
  "mcp-sort-order"?: 0 | 1
}

export type OAPUser = {
  id: string
  email: string
  username: string
  picture: string
  team: string
  subscription: OAPSubscription
}

export type OAPSubscription = {
  IsDefaultPlan: boolean
  NextBillingDate: string
  PlanName: string
  StartDate: string
  Start: string
  End: string
}

export type OAPUsage = {
  limit: number
  mcp: number
  model: number
  total: number //mcp + model
  coupon: OAPCoupon
}

//token package
export type OAPCoupon = {
  model: number
  mcp: number
  total: number
  limit: number
}

export interface InstanceInfo {
  instance_id: string
  instance_name: string
  tool_id: string
  tool_name: string
  enabled: boolean
  version: string | null
  env?: Record<string, string> | null
}

export interface PackageInfo {
  name: string
  version: string
  path: string
  package_json: any
}

export interface CreateInstanceRequest {
  tool_id: string
  tool_name: string
  instance_name?: string
  transport: string
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  version?: string
  download_url?: string
  config_schema?: Record<string, any>
  plan_tag?: string
  description?: string
}

export interface UpdateInstanceRequest {
  env?: Record<string, string>
  enabled?: boolean
}