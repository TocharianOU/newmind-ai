import { Anthropic } from "@anthropic-ai/sdk"
import { ipcMain, BrowserWindow } from "electron"
import { Ollama } from "ollama"
import OpenAI, { AzureOpenAI } from "openai"
import { Mistral } from "@mistralai/mistralai"
import {
  BedrockClient,
  ListFoundationModelsCommand,
} from "@aws-sdk/client-bedrock"
import https from "node:https"
import http from "node:http"
import { HttpsProxyAgent } from "https-proxy-agent"

// Timeout helper function - 30 seconds default
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 30000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms. Please check your network connection.`)), timeoutMs)
    )
  ])
}

/**
 * Get HTTP/HTTPS agent with optional proxy support
 * Checks for HTTP_PROXY and HTTPS_PROXY environment variables
 * Falls back to direct connection if proxy is not configured or fails
 */
function getHttpAgent(targetUrl?: string): { httpAgent?: http.Agent | https.Agent } {
  try {
    const isHttps = targetUrl?.startsWith('https://') ?? true
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || 
                     process.env.HTTP_PROXY || process.env.http_proxy
    
    if (proxyUrl) {
      console.log(`[DEBUG] Using proxy for OpenAI API: ${proxyUrl}`)
      // Create proxy agent that also ignores SSL certificate errors
      const proxyAgent = new HttpsProxyAgent(proxyUrl, {
        rejectUnauthorized: false // Allow self-signed certificates
      })
      return { httpAgent: proxyAgent as any }
    }
    
    // No proxy configured, return agent that allows self-signed certs
    if (isHttps) {
      return {
        httpAgent: new https.Agent({
          rejectUnauthorized: false
        }) as any
      }
    }
    
    return {}
  } catch (error) {
    console.warn('[DEBUG] Failed to configure proxy agent, falling back to direct connection:', error)
    // Return default agent that allows self-signed certs on failure
    return {
      httpAgent: new https.Agent({
        rejectUnauthorized: false
      }) as any
    }
  }
}

export function ipcLlmHandler(_win: BrowserWindow) {
  ipcMain.handle("llm:openaiModelList", async (_, apiKey: string) => {
    try {
      const client = new OpenAI({ 
        apiKey,
        ...getHttpAgent('https://api.openai.com')
      })
      const models = await withTimeout(client.models.list())
      return { results: models.data.map((model) => model.id), error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  ipcMain.handle("llm:azureOpenaiModelList", async (_, apiKey: string, azureEndpoint: string, azureDeployment: string, apiVersion: string) => {
    try {
      const client = new AzureOpenAI({ 
        apiKey, 
        endpoint: azureEndpoint, 
        deployment: azureDeployment, 
        apiVersion,
        ...getHttpAgent(azureEndpoint)
      })
      const models = await withTimeout(client.models.list())
      return { results: models.data?.map((model) => model.id) ?? [], error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  ipcMain.handle("llm:anthropicModelList", async (_, apiKey: string, baseURL: string) => {
    try {
      const client = new Anthropic({ apiKey, baseURL })
      const models = await withTimeout(client.models.list())
      return { results: models.data.map((model: any) => model.id), error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  ipcMain.handle("llm:ollamaModelList", async (_, baseURL: string) => {
    try {
      const ollama = new Ollama({ host: baseURL })
      const list = await withTimeout(ollama.list())
      return { results: list.models.map((model) => model.name), error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  ipcMain.handle("llm:openaiCompatibleModelList", async (_, apiKey: string, baseURL: string) => {
    try {
      console.log(`[DEBUG] OpenAI Compatible Model List - baseURL: ${baseURL}, apiKey: ${apiKey ? apiKey.substring(0, 10) + '...' : 'undefined'}`)

      // Try with proxy first, fallback to direct connection on proxy failure
      const client = new OpenAI({ 
        apiKey, 
        baseURL,
        ...getHttpAgent(baseURL)
      })
      
      const list = await withTimeout(client.models.list())

      console.log(`[DEBUG] OpenAI Compatible API Response:`, {
        dataLength: list.data?.length || 0,
        firstModel: list.data?.[0]?.id || 'none',
        fullResponse: JSON.stringify(list, null, 2)
      })

      // Extract model names and metadata
      const modelsWithMetadata = list.data.map((model) => {
        // Check if model has metadata indicating real provider
        const metadata = (model as any).metadata
        if (metadata?.real_provider) {
          console.log(`[DEBUG] Found model ${model.id} with real_provider: ${metadata.real_provider}`)
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
      console.error(`[DEBUG] OpenAI Compatible API Error:`, error)
      return { results: [], error: (error as Error).message }
    }
  })

  ipcMain.handle("llm:googleGenaiModelList", async (_, apiKey: string) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      const response = await withTimeout(fetch(url))
      const data = await response.json() as { models: { name: string }[] }
      return { results: data.models.map((model) => model.name), error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  ipcMain.handle("llm:mistralaiModelList", async (_, apiKey: string) => {
    try {
      const client = new Mistral({ apiKey })
      const models = await withTimeout(client.models.list())
      return { results: models.data?.map((model) => model.id) ?? [], error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })

  ipcMain.handle("llm:bedrockModelList", async (_, accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string) => {
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
      const response = await withTimeout(client.send(command))
      const models = response.modelSummaries
      return { results: models?.map((model: any) => `${modelPrefix}${model.modelId}`) ?? [], error: null }
    } catch (error) {
      return { results: [], error: (error as Error).message }
    }
  })
}
