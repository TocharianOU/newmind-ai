import { Anthropic } from "@anthropic-ai/sdk"
import { BrowserWindow } from "electron"
import { Ollama } from "ollama"
import OpenAI, { AzureOpenAI } from "openai"
import { Mistral } from "@mistralai/mistralai"
import {
  BedrockClient,
  ListFoundationModelsCommand,
} from "@aws-sdk/client-bedrock"
import { safeRegisterHandler } from "../utils/ipcRegistry"

export function ipcLlmHandler(_win: BrowserWindow) {
  safeRegisterHandler("llm:openaiModelList", async (_, apiKey: string) => {
    try {
      const client = new OpenAI({ apiKey })
      const models = await client.models.list()
      return { results: models.data.map((model) => model.id), error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })
  
  safeRegisterHandler("llm:azureOpenaiModelList", async (_, apiKey: string, azureEndpoint: string, azureDeployment: string, apiVersion: string) => {
    try {
      const client = new AzureOpenAI({ apiKey, endpoint: azureEndpoint, deployment: azureDeployment, apiVersion })
      const models = await client.models.list()
      return { results: models.data?.map((model) => model.id) ?? [], error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  safeRegisterHandler("llm:anthropicModelList", async (_, apiKey: string, baseURL: string) => {
    try {
      const client = new Anthropic({ apiKey, baseURL })
      const models = await client.models.list()
      return { results: models.data.map((model: any) => model.id), error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  safeRegisterHandler("llm:ollamaModelList", async (_, baseURL: string) => {
    try {
      const ollama = new Ollama({ host: baseURL })
      const list = await ollama.list()
      return { results: list.models.map((model) => model.name), error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  safeRegisterHandler("llm:openaiCompatibleModelList", async (_, apiKey: string, baseURL: string) => {
    try {
      const client = new OpenAI({ apiKey, baseURL })
      const list = await client.models.list()

      const modelsWithMetadata = list.data.map((model) => {
        const metadata = (model as any).metadata
        if (metadata?.real_provider) {
          return {
            id: model.id,
            real_provider: metadata.real_provider,
            base_model: metadata.base_model,
            supports_tools: metadata.supports_tools,
            supports_streaming: metadata.supports_streaming
          }
        }
        return { id: model.id }
      })

      return {
        results: list.data.map((model) => model.id),
        metadata: modelsWithMetadata,
        error: null
      }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  safeRegisterHandler("llm:googleGenaiModelList", async (_, apiKey: string) => {
    try {
      // Pass the key in a header to avoid leaking it in logs/Referer
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": apiKey },
      })
      const data = await response.json() as { models: { name: string }[] }
      return { results: data.models.map((model) => model.name), error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  safeRegisterHandler("llm:mistralaiModelList", async (_, apiKey: string) => {
    try {
      const client = new Mistral({ apiKey })
      const models = await client.models.list()
      return { results: models.data?.map((model) => model.id) ?? [], error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  safeRegisterHandler("llm:bedrockModelList", async (_, accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string) => {
    try {
      let modelPrefix = ""
      if (region.startsWith("us-")) {
        modelPrefix = "us."
      } else if (region.startsWith("eu-")) {
        modelPrefix = "eu."
      } else if (region.startsWith("ap-")) {
        modelPrefix = "apac."
      } else if (region.includes("-")) {
        modelPrefix = region.split("-")[0] + "."
      }

      const client = new BedrockClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
          sessionToken,
        }
      })
      const command = new ListFoundationModelsCommand({})
      const response = await client.send(command)
      const models = response.modelSummaries
      return { results: models?.map((model: any) => `${modelPrefix}${model.modelId}`) ?? [], error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })
}
