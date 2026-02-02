import "@/styles/components/_ModelSelect.scss"
import { useTranslation } from "react-i18next"
import Select from "./Select"
import { useCallback, useEffect, useMemo, useState } from "react"
import { isProviderIconNoFilter, PROVIDER_ICONS } from "../atoms/interfaceState"
import { useAtomValue, useSetAtom } from "jotai"
import { configAtom, writeRawConfigAtom } from "../atoms/configState"
import { openDrawerAtom } from "../atoms/drawerState"
import { showToastAtom } from "../atoms/toastState"
import Tooltip from "./Tooltip"
import { systemThemeAtom, userThemeAtom } from "../atoms/themeState"
import { modelSettingsAtom } from "../atoms/modelState"
import { getGroupTerm, getModelTerm, getTermFromRawModelConfig, GroupTerm, intoRawModelConfig, matchOpenaiCompatible, ModelTerm, queryGroup, queryModel } from "../helper/model"
import isEqual from "lodash/isEqual"

const DEFAULT_MODEL = { group: {}, model: {} }

type ModelSelectProps = {
  showSettingsButton?: boolean
}

const ModelSelect = ({ showSettingsButton = true }: ModelSelectProps) => {
  const { t } = useTranslation()
  const config = useAtomValue(configAtom)
  const saveAllConfig = useSetAtom(writeRawConfigAtom)
  const [model, setModel] = useState<{ group: GroupTerm, model: ModelTerm }>(DEFAULT_MODEL)
  const openDrawer = useSetAtom(openDrawerAtom)
  const showToast = useSetAtom(showToastAtom)
  const systemTheme = useAtomValue(systemThemeAtom)
  const userTheme = useAtomValue(userThemeAtom)
  const settings = useAtomValue(modelSettingsAtom)

  const getModelNamePrefix = (group: GroupTerm) => {
    switch (group.modelProvider) {
      case "oap":
        return "OAP"
      case "bedrock":
        return `***${group.extra?.credentials?.accessKeyId?.slice(-4)}`
      case "lmstudio":
        return "LMStudio"
      default:
        if (group.apiKey) {
          return `***${group.apiKey.slice(-4)}`
        }

        if (group.baseURL) {
          return `***${group.baseURL.slice(-4)}`
        }
    }
  }

  const modelList = useMemo(() => {
    return Object.values(settings.groups)
      .filter((group) => group.active)
      .flatMap((group) =>
        group.models
          .filter((model) => model.active)
          .map((model) => ({
            provider: group.modelProvider,
            name: `${getModelNamePrefix(group)}/${model.model}`,
            value: { group: getGroupTerm(group), model: getModelTerm(model) },
          })
          ))
  }, [settings])

  useEffect(() => {
    setModel(getTermFromRawModelConfig(config) ?? DEFAULT_MODEL)
  }, [config])

  const handleModelChange = async (value: { group: GroupTerm, model: ModelTerm }) => {
    const _model = model
    setModel(value)
    try {
      const group = queryGroup(value.group, settings.groups)
      if (group.length === 0) {
        throw new Error("Group not found")
      }

      const model = queryModel(value.model, group[0])
      if (model.length === 0) {
        throw new Error("Model not found")
      }

      const data = await saveAllConfig(intoRawModelConfig(settings, group[0], model[0])!)
      if (data.success) {
        showToast({
          message: t("setup.saveSuccess"),
          type: "success"
        })
      }
    } catch (error) {
      console.error(error)
      setModel(_model)
    }
  }

  const equalCustomizer = useCallback((a: { group: GroupTerm, model: ModelTerm }, b: { group: GroupTerm, model: ModelTerm }) => {
    // 创建副本避免修改原对象
    const aNormalized = { ...a, group: { ...a.group } }
    const bNormalized = { ...b, group: { ...b.group } }

    // 定义 openai 兼容的 provider 列表
    const openaiCompatibleProviders = [
      "openai_compatible",
      "lmstudio",
      "openrouter",
      "groq",
      "grok",
      "nvdia",
      "perplexity",
      "openai"
    ]

    // 标准化 a 的 provider
    if (aNormalized.group.modelProvider === "openai" && aNormalized.group.baseURL) {
      aNormalized.group.modelProvider = "openai_compatible"
    } else if (aNormalized.group.modelProvider !== "openai_compatible" && aNormalized.group.baseURL) {
      const matchProvider = matchOpenaiCompatible(aNormalized.group.baseURL)
      if (matchProvider !== "openai_compatible") {
        aNormalized.group.modelProvider = matchProvider
      }
    }

    // 标准化 b 的 provider
    if (bNormalized.group.modelProvider === "openai" && bNormalized.group.baseURL) {
      bNormalized.group.modelProvider = "openai_compatible"
    } else if (bNormalized.group.modelProvider !== "openai_compatible" && bNormalized.group.baseURL) {
      const matchProvider = matchOpenaiCompatible(bNormalized.group.baseURL)
      if (matchProvider !== "openai_compatible") {
        bNormalized.group.modelProvider = matchProvider
      }
    }

    // 如果两个都是 openai 兼容的 provider，且 baseURL 相同，则统一标准化后再比较
    // 忽略 apiKey 的差异（因为 lmstudio 等 provider 的 apiKey 可能是固定的）
    const aIsOpenaiCompatible = openaiCompatibleProviders.includes(aNormalized.group.modelProvider || "")
    const bIsOpenaiCompatible = openaiCompatibleProviders.includes(bNormalized.group.modelProvider || "")

    if (aIsOpenaiCompatible && bIsOpenaiCompatible &&
      aNormalized.group.baseURL && bNormalized.group.baseURL &&
      aNormalized.group.baseURL === bNormalized.group.baseURL) {
      // 统一标准化：都使用 baseURL 匹配的结果
      const matchedProvider = matchOpenaiCompatible(aNormalized.group.baseURL)
      aNormalized.group.modelProvider = matchedProvider
      bNormalized.group.modelProvider = matchedProvider
      // 移除 apiKey 字段进行比较（因为不同 provider 的 apiKey 可能不同）
      const { apiKey: aApiKey, ...aGroupWithoutApiKey } = aNormalized.group
      const { apiKey: bApiKey, ...bGroupWithoutApiKey } = bNormalized.group
      return isEqual(
        { group: aGroupWithoutApiKey, model: aNormalized.model },
        { group: bGroupWithoutApiKey, model: bNormalized.model }
      )
    }

    return isEqual(aNormalized, bNormalized)
  }, [])

  return (
    <div className="model-select">
      <Select
        options={modelList.map((model, i) => ({
          value: model.value,
          label: (
            <div className="model-select-label" key={i}>
              <img
                src={PROVIDER_ICONS[model.provider]}
                alt={model.provider}
                className={`model-select-label-icon ${isProviderIconNoFilter(model.provider, userTheme, systemTheme) ? "no-filter" : ""}`}
              />
              <span className="model-select-label-text">
                {model.name}
              </span>
            </div>
          )
        })
        )}
        placeholder={modelList.length === 0 ? t("models.noModelAlertOption") : t("models.selectModelPlaceHolder")}
        value={model!}
        onSelect={handleModelChange}
        className={`${modelList.length === 0 ? "disabled" : ""}`}
        contentClassName="model-select-content"
        equalCustomizer={equalCustomizer}
      />
      {showSettingsButton && (
        <Tooltip
          content={t("chat.modelSettings")}
        >
          <button
            className="model-select-add-btn"
            onClick={() => openDrawer({ id: "Settings", page: "Settings", tab: "Model" })}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
            </svg>
          </button>
        </Tooltip>
      )}
    </div>
  )
}

export default ModelSelect
