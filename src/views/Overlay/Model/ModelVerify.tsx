import { useAtom } from "jotai"
import { ModelConfig, modelVerifyListAtom, verifyModelWithConfig } from "../../../atoms/configState"
import { useRef } from "react"
import { BaseModel, LLMGroup, ModelVerifyStatus } from "../../../../types/model"
import { getVerifyKey } from "../../../helper/verify"
import { intoModelConfig } from "../../../helper/model"

export interface ModelVerifyDetail {
  name: string
  status: ModelVerifyStatus
  detail?: Record<string, any>
}

const MAX_CONCURRENT = 10

export const useModelVerify = () => {
  const [allVerifiedList, setAllVerifiedList] = useAtom(modelVerifyListAtom)
  const detail = useRef<ModelVerifyDetail[]>([])
  const queue = useRef<BaseModel[]>([])
  const controllers = useRef<Set<AbortController>>(new Set())
  const abortTimeout = useRef<NodeJS.Timeout | null>(null)
  const aborted = useRef(false)

  const verify = async (
    group: LLMGroup,
    needVerifyList: BaseModel[],
    onComplete: () => void,
    onUpdate?: (detail: ModelVerifyDetail[]) => void,
    onAbort?: () => void,
    timeout?: number
  ) => {
    if (queue.current.length > 0 || needVerifyList.length === 0) {
      return
    }

    let working = 0
    queue.current = [...needVerifyList]
    aborted.current = false
    detail.current = []
    const verifyKey = getVerifyKey(group)
    needVerifyList.forEach((model) => {
      detail.current.push({name: model.model ?? "", status: "verifying", detail: {}})
    })

    onUpdate?.(detail.current)

    if(timeout) {
      abortTimeout.current = setTimeout(abort, timeout)
    }

    const addNewTask = (model: BaseModel) => {
      if (working > MAX_CONCURRENT) {
        return
      }

      working++
      const controller = new AbortController()
      controllers.current.add(controller)

      const task = verifyModel(intoModelConfig(group, model), controller.signal)
        .then(verifyResult => {
          const verifiedList = allVerifiedList[verifyKey] ?? {}
          verifiedList[model.model] = verifyResult
          allVerifiedList[verifyKey] = verifiedList
          setAllVerifiedList({...allVerifiedList})
          const _detail = [...detail.current]
          const index = _detail.findIndex(item => item.name === model.model)
          _detail[index].detail = verifyResult ?? {success: false}
          _detail[index].status = getVerifyStatus(verifyResult ?? {success: false})
          detail.current = _detail
          onUpdate?.(detail.current)
        })
        .catch(error => {
          const _detail = [...detail.current]
          const _detailItem = _detail.find(item => item.name === model.model)!
          if (!_detailItem) {
            return
          }

          if (error.name === "AbortError") {
            _detailItem.status = "abort"
          } else {
            _detailItem.status = "error"
            _detailItem.detail = error.message
          }

          detail.current = _detail
          onUpdate?.(detail.current)
        })
        .finally(() => {
          controllers.current.delete(controller)
          working--

          if (queue.current.length > 0) {
            addNewTask(queue.current.shift()!)
          }

          if (aborted.current) {
            onAbort?.()
            return
          }

          if (working === 0) {
            onComplete()
          }
        })

      return task
    }

    new Array(Math.min(MAX_CONCURRENT, needVerifyList.length)).fill(0).forEach(() => {
      addNewTask(queue.current.shift()!)
    })
  }

  const abort = () => {
    aborted.current = true
    detail.current = []
    queue.current = []
    controllers.current.forEach(controller => {
      if(!controller.signal.aborted) {
        controller.abort("cancel")
      }
    })
    controllers.current.clear()
    if(abortTimeout.current)
      clearTimeout(abortTimeout.current)
    abortTimeout.current = null
  }

  return { verify, abort }
}

const verifyModel = async (modelConfig: ModelConfig, signal?: AbortSignal) => {
  return verifyModelWithConfig(modelConfig, signal)
    .catch(error => {
      console.error("Failed to verify model:", error)
      return false
    })
}

export const getVerifyStatus = (data: any): ModelVerifyStatus => {
  if(data === "ignore") {
    return "ignore"
  }else if(data && data.connecting && data.connecting.success && data.supportTools && data.supportTools.success) {
    return "success"
  }else if(data && data.connecting && data.connecting.success && !(data.supportTools && data.supportTools.success) && data.supportToolsInPrompt && data.supportToolsInPrompt.success) {
    return "successInPrompt"
  }else if(data && data.connecting && data.connecting.success && !(data.supportTools && data.supportTools.success) && !(data.supportToolsInPrompt && data.supportToolsInPrompt.success)) {
    return "unSupportTool"
  }else if(data && data.connecting && !data.connecting.success) {
    return "unSupportModel"
  }else if(data && !data.success) {
    return "unSupportTool"
  }

  return "unVerified"
}