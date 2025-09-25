import { LLMGroup } from "../../types/model"
import { ModelConfig } from "../atoms/configState"

export function getVerifyKey(group: LLMGroup) {
  switch(group.modelProvider) {
  case "bedrock":
    return group.extra.credentials.accessKeyId
  default:
    return group.apiKey || group.baseURL || ""
  }
}

export function getVerifyKeyFromModelConfig(config: ModelConfig) {
  if (!config) {
    return ""
  }

  switch(config.modelProvider) {
  case "bedrock":
    return (config as any).credentials.accessKeyId
  default:
    return config.apiKey || config.baseURL || ""
  }
}