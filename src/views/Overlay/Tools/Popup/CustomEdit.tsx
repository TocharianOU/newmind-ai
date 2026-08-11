//@ts-nocheck
import jsonlint from "jsonlint-mod"
import CodeMirror, { EditorView } from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { linter, lintGutter } from "@codemirror/lint"
import { systemThemeAtom, themeAtom } from "../../../../atoms/themeState"
import { mcpServersProps } from ".."
import { MCPConfig } from "../../../../atoms/toolState"
import { useTranslation } from "react-i18next"
import { useAtomValue, useSetAtom } from "jotai"
import { showToastAtom } from "../../../../atoms/toastState"
import { useState, useEffect, useRef, useMemo } from "react"
import React from "react"
import Tooltip from "../../../../components/Tooltip"
import PopupConfirm from "../../../../components/PopupConfirm"
import Button from "../../../../components/Button"
import Switch from "../../../../components/Switch"
import Select from "../../../../components/Select"

export interface customListProps {
  name: string
  mcpServers: mcpServersProps & Record<string, any>
  jsonString: string
  isError: { isError: boolean, text: string, name?: string }
  isRangeError: { isError: boolean, text: string, fieldKey: string, value: number }
}

interface customEditPopupProps {
  _type: "add" | "add-json" | "edit" | "edit-json"
  _config: Record<string, any>
  _toolName?: string
  onDelete?: (toolName: string) => Promise<void>
  onCancel: () => void
  onSubmit: (config: {mcpServers: MCPConfig}) => Promise<void>
  onAdd: (config: {mcpServers: MCPConfig}) => Promise<void>
  toolLog?: Array<LogType>
}

interface LogType {
  body: string
  client_state: string
  event: string
  mcp_server_name: string
  timestamp: string
}

const FieldType = {
  "enabled": {
    type: "boolean",
    error: "tools.jsonFormatError.booleanError",
    required: false,
  },
  "command": {
    type: "string",
    error: "tools.jsonFormatError.stringError",
    required: false,
  },
  "args": {
    type: "array",
    error: "tools.jsonFormatError.arrayError",
    required: false,
  },
  "env": {
    type: "object",
    error: "tools.jsonFormatError.objectError",
    required: false,
  },
  "url": {
    type: "string",
    error: "tools.jsonFormatError.stringError",
    required: false,
  },
  "transport": {
    type: "select",
    options: ["stdio", "sse", "streamable", "websocket"] as const,
    error: "tools.jsonFormatError.optionError",
    required: false,
  },
  "initialTimeout": {
    type: "number",
    min: 10,
    minError: "tools.jsonFormatError.minRange",
    maxError: "tools.jsonFormatError.maxRange",
    required: false,
    error: "tools.jsonFormatError.floatError"
  }
} as const

interface JsonLintError {
  errorType: "ToolNumber" | "NameEmpty" | "NameExist" | "Required" | "Options" | "FieldType" | "MinRange" | "MaxRange" | "JsonError",
  from: number
  to: number
  message: string
  severity: "error"
}

const emptyCustom = (): customListProps => {
  const _emptyCustom : customListProps = {
    name: "",
    mcpServers: {},
    jsonString: "",
    isError: { isError: false, text: "" },
    isRangeError: { isError: false, text: "", fieldKey: "", value: 0 }
  }

  Object.keys(FieldType).forEach((fieldKey) => {
    if("min" in FieldType[fieldKey as keyof typeof FieldType] && !_emptyCustom.mcpServers[fieldKey]) {
      _emptyCustom.mcpServers[fieldKey] = FieldType[fieldKey as keyof typeof FieldType].min
    }
  })

  return _emptyCustom
}

import SchemaForm from "./SchemaForm"
import { isWeb } from "../../../../ipc/env"

const CustomEdit = React.memo(({ _type, _config, _toolName, onDelete, onCancel, onSubmit, toolLog }: customEditPopupProps) => {
  const [type, setType] = useState<customEditPopupProps["_type"]>(_type)
  const { t } = useTranslation()
  const [tmpCustom, setTmpCustom] = useState<customListProps>(emptyCustom())
  const [customList, setCustomList] = useState<customListProps[]>([])
  const [otherList, setOtherList] = useState<customListProps[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isFormatError, setIsFormatError] = useState(false)
  const [isRangeError, setIsRangeError] = useState(false)
  const theme = useAtomValue(themeAtom)
  const systemTheme = useAtomValue(systemThemeAtom)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // 认证方式（针对 http 类 transport 的 headers 快捷填写）
  const [authMethod, setAuthMethod] = useState("none")   // none | bearer | basic | custom
  const [authToken, setAuthToken] = useState("")          // Bearer token
  const [authUser, setAuthUser] = useState("")            // Basic 用户名
  const [authPass, setAuthPass] = useState("")            // Basic 密码
  const [authHeaderName, setAuthHeaderName] = useState("")   // 自定义头名
  const [authHeaderValue, setAuthHeaderValue] = useState("") // 自定义头值
  const [authValueVisible, setAuthValueVisible] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const logContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if(!_config.mcpServers) {
      return
    }
    const newCustomList: customListProps[] = []
    const newOtherList: customListProps[] = []
    const newConfig = JSON.parse(JSON.stringify(_config))

    // remove disabled field
    Object.keys(newConfig.mcpServers).forEach((toolName) => {
      delete newConfig.mcpServers[toolName].disabled
    })

    Object.keys(newConfig.mcpServers)
    // Filter: allow custom tools, OR the specific OAP tool being edited
    .filter((toolName) => 
      // !newConfig.mcpServers[toolName]?.extraData?.oap || toolName === _toolName
      // Allow all tools to be visible in the list for better debugging and UX
      true
    )
    .sort((a, b) => {
      const aEnabled = newConfig.mcpServers[a]?.enabled
      const bEnabled = newConfig.mcpServers[b]?.enabled
      if (aEnabled && !bEnabled)
        return -1
      if (!aEnabled && bEnabled)
        return 1
      return 0
    })
    .forEach((toolName) => {
      const newJson = {
        mcpServers: {
          [toolName]: newConfig.mcpServers[toolName]
        }
      }
      // All transports (stdio, sse, streamable, websocket) go to customList
      newCustomList.push({
        name: toolName,
        mcpServers: encodeMcpServers(newConfig.mcpServers[toolName]),
        jsonString: JSON.stringify(newJson, null, 2),
        isError: { isError: false, text: "" },
        isRangeError: { isError: false, text: "", fieldKey: "", value: 0 }
      })
    })
    handleError(tmpCustom, newCustomList)
    const index = newCustomList.findIndex(mcp => mcp.name === _toolName)
    setCurrentIndex(index)
    setCustomList(newCustomList)
    setOtherList(newOtherList)
  }, [])

  useEffect(() => {
    if(!type.includes("add")) {
      return
    }
    try {
      let newTmpCustomServers = JSON.parse(tmpCustom.jsonString)
      if(Object.keys(newTmpCustomServers)[0] === "mcpServers") {
        newTmpCustomServers = newTmpCustomServers.mcpServers
      }
      const newToolNames = Object.keys(newTmpCustomServers)
      let newType = type
      if(newType.includes("add")) {
        try {
          if(newToolNames.length > 1 && type === "add") {
            newType = "add-json"
          } else if(newToolNames.length < 2 && type === "add-json") {
            newType = "add"
          }
        } catch(_e) {
          newType = "add"
        }
      }
      if(newType !== type) {
        setType(newType)
      }
    } catch(_e) {
      setType("add")
    }
  }, [currentIndex])

  useEffect(() => {
    if(logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight
    }
  }, [toolLog])

  const handleError = (newTmpCustom: customListProps, newCustomList: customListProps[]) => {
    try {
      let newTmpCustomServers = {} as Record<string, any>
      if(newTmpCustom.jsonString !== "") {
        newTmpCustomServers = JSON.parse(newTmpCustom.jsonString)
        if(newTmpCustomServers.mcpServers) {
          newTmpCustomServers = newTmpCustomServers.mcpServers
        }
      }
      const newTmpCustomNames = Object.keys(newTmpCustomServers)
      let newTmpCustomError = { isError: false, text: "" } as Record<string, any>
      for(const newTmpCustomName of newTmpCustomNames) {
        // tmpCustomNames are from parsed jsonString, so NO need to check duplicate name in tmpCustom
        const nameError = !isValidName(newCustomList, newTmpCustom, -1, newTmpCustomName)
        const typeError = !isValidType(newTmpCustomServers[newTmpCustomName])
        const fieldError = !isValidField(newTmpCustomServers[newTmpCustomName])
        nameError && console.log("nameError:", newTmpCustomName)
        typeError && console.log("typeError:", newTmpCustomName)
        fieldError && console.log("fieldError:", newTmpCustomName)
        if(nameError) {
          newTmpCustomError = { isError: true, text: "tools.jsonFormatError.nameExist", name: newTmpCustomName }
        } else if(typeError || fieldError) {
          newTmpCustomError = { isError: true, text: "tools.jsonFormatError.format" }
        }
        if(newTmpCustomError.isError) {
          break
        }
      }
      //separate jsonError for showing other error first
      if(!newTmpCustomError.isError) {
        const jsonError = jsonLinterError(newTmpCustom.jsonString, newCustomList, newTmpCustom, -1)
        // jsonError.length > 0 && console.log("jsonError:", jsonError)
        if(jsonError.length > 0) {
          newTmpCustomError = { isError: true, text: "tools.jsonFormatError.format" }
        }
      }
      if(newTmpCustomNames.length < 2) {
        // if there is only one MCP, jsonString will be original tmpCustom.jsonString
        // but mcpServers will be changed, so need to check again
        newTmpCustomError = {
          isError: newTmpCustomError.isError || !isValidField(newTmpCustom.mcpServers),
          text: newTmpCustomError.text || (!isValidField(newTmpCustom.mcpServers) ? "tools.jsonFormatError.format" : "")
        }
      }
      let newTmpCustomRangeError = { isError: false, text: "", fieldKey: "", value: 0 } as Record<string, any>
      for(const newTmpCustomName of newTmpCustomNames) {
        newTmpCustomRangeError = isValidRange(newTmpCustomServers[newTmpCustomName])
        if(newTmpCustomRangeError?.isError) {
          break
        }
      }
      setTmpCustom({
        ...newTmpCustom,
        isError: newTmpCustomError as { isError: boolean, text: string, name?: string },
        isRangeError: newTmpCustomRangeError as { isError: boolean, text: string, fieldKey: string, value: number }
      })
      newCustomList.forEach((mcp, index) => {
        let newMcpError = { isError: false, text: "" }
        const nameError = !isValidName(newCustomList, newTmpCustom, index, mcp.name)
        const fieldError = !isValidField(mcp.mcpServers)
        const typeError = !isValidType(decodeMcpServers(mcp.mcpServers))
        const toolNumberError = isValidToolNumber("edit", mcp.jsonString)
        const jsonError = jsonLinterError(mcp.jsonString, newCustomList, newTmpCustom, index)
        // nameError && console.log("nameError:", mcp.name)
        // typeError && console.log("typeError:", mcp.name)
        // fieldError && console.log("fieldError:", mcp.name)
        // toolNumberError.length > 0 && console.log("toolNumberError:", mcp.name)
        // jsonError.length > 0 && console.log("jsonError:", jsonError)
        if(nameError) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.nameExist" }
        } else if(toolNumberError.length > 0) {
          newMcpError = { isError: true, text: toolNumberError }
        } else if(typeError || fieldError || jsonError.length > 0) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.format" }
        }
        mcp.isError = newMcpError
        mcp.isRangeError = isValidRange(mcp.mcpServers) as { isError: boolean, text: string, fieldKey: string, value: number }
      })
      setCustomList(newCustomList)
    } catch(_e) {
      // console.log("handleError error", _e)
      setTmpCustom({
        ...newTmpCustom,
        isError: { isError: true, text: "tools.jsonFormatError.format" },
        isRangeError: { isError: false, text: "", fieldKey: "", value: 0 }
      })
      newCustomList.forEach((mcp, index) => {
        let newMcpError = { isError: false, text: "" }
        const nameError = !isValidName(newCustomList, newTmpCustom, index, mcp.name)
        const fieldError = !isValidField(mcp.mcpServers)
        const typeError = !isValidType(decodeMcpServers(mcp.mcpServers))
        const toolNumberError = isValidToolNumber("edit", mcp.jsonString)
        const jsonError = jsonLinterError(mcp.jsonString, newCustomList, newTmpCustom, index)
        // nameError && console.log("nameError:", mcp.name)
        // typeError && console.log("typeError:", mcp.name)
        // fieldError && console.log("fieldError:", mcp.name)
        // toolNumberError.length > 0 && console.log("toolNumberError:", mcp.name)
        // jsonError.length > 0 && console.log("jsonError:", jsonError)
        if(nameError) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.nameExist" }
        } else if(toolNumberError.length > 0) {
          newMcpError = { isError: true, text: toolNumberError }
        } else if(typeError || fieldError || jsonError.length > 0) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.format" }
        }
        mcp.isError = newMcpError
        mcp.isRangeError = isValidRange(mcp.mcpServers) as { isError: boolean, text: string, fieldKey: string, value: number }
      })
      setCustomList(newCustomList)
    }
  }

  const handleCustomChange = (key: string, value: any) => {
    //"add-json" will not show Field, so there is no need to check error of "add-json" in handleCustomChange
    if(type === "add") {
      const newMcpServers = JSON.parse(JSON.stringify(tmpCustom.mcpServers))
      let newName = tmpCustom.name

      if(key === "name") {
        newName = value
      } else {
        if(FieldType[key]?.min > 0 && isNaN(value) && !FieldType[key].required) {
          delete newMcpServers[key]
        } else {
          newMcpServers[key] = value
        }
      }

      const newJsonString = { mcpServers: { [newName]: decodeMcpServers(newMcpServers) } }
      const newTmpCustom = {
        name: newName,
        mcpServers: newMcpServers,
        // if field is unValid, there will be error in JSON.stringify, use original tmpCustom.jsonString
        jsonString: isValidField(newMcpServers) ? JSON.stringify(newJsonString, null, 2) : tmpCustom.jsonString
      }
      handleError(newTmpCustom as customListProps, customList)
    } else {
      const newMcpServers = JSON.parse(JSON.stringify(customList[currentIndex].mcpServers))
      let newName = customList[currentIndex].name

      if(key === "name") {
        newName = value
      } else {
        if(FieldType[key]?.min > 0 && isNaN(value) && !FieldType[key].required) {
          delete newMcpServers[key]
        } else {
          newMcpServers[key] = value
        }
      }

      const newJsonString = { mcpServers: { [newName]: decodeMcpServers(newMcpServers) } }
      const newCustomList = [...customList]
      newCustomList[currentIndex] = {
        ...newCustomList[currentIndex],
        name: newName,
        mcpServers: newMcpServers,
        jsonString: isValidField(newMcpServers) ? JSON.stringify(newJsonString, null, 2) : newCustomList[currentIndex].jsonString
      }
      handleError(tmpCustom as customListProps, newCustomList)
    }
  }

  const jsonLinterError = (jsonString: string, _customList: customListProps[], _tmpCustom: customListProps, _index?: number, _view?: EditorView): JsonLintError[] => {
    const jsonError: JsonLintError[] = []
    try{
      let parsed = jsonlint.parse(jsonString)

      // handle when the json is not start with 'mcpServers' object
      if (Object.keys(parsed)[0] !== "mcpServers") {
        parsed = { mcpServers: parsed }
      }
      const newNames = Object.keys(parsed.mcpServers)

      // "edit" mode: mcpServers must contain exactly one tool
      if (newNames.length !== 1 && type === "edit") {
        setIsFormatError(true)
        jsonError.push({
          errorType: "ToolNumber",
          from: 0,
          to: jsonString.length,
          message: t("tools.jsonFormatError.toolNumberError"),
          severity: "error",
        })
      }

      // tool name cannot be empty
      if (newNames.some(key => key === "")) {
        setIsFormatError(true)
        jsonError.push({
          errorType: "NameEmpty",
          from: 0,
          to: jsonString.length,
          message: t("tools.jsonFormatError.nameEmpty"),
          severity: "error",
        })
      }

      // Check for duplicate names in customList
      let showDuplicateError
      for(const newName of newNames) {
        // there is NO need to check duplicate name in tmpCustom self
        // because this error will be blocked by parse error
        if(!isValidName(_customList, _tmpCustom, _index ?? currentIndex, newName)) {
          showDuplicateError = newName
          break
        }
      }
      if (showDuplicateError) {
        setIsFormatError(true)
        jsonError.push({
          errorType: "NameExist",
          from: 0,
          to: jsonString.length,
          message: t("tools.jsonFormatError.nameExist", { mcp: showDuplicateError }),
          severity: "error",
        })
      }

      // check field type
      for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
        for(const newName of newNames) {
          if(FieldType[fieldKey].required && (!(fieldKey in parsed.mcpServers[newName]) || !parsed.mcpServers[newName])) {
            setIsFormatError(true)
            jsonError.push({
              errorType: "Required",
              from: 0,
              to: jsonString.length,
              message: t("tools.jsonFormatError.requiredError", { mcp: newName, field: fieldKey }),
              severity: "error",
            })
          }
          const fieldType = Array.isArray(parsed.mcpServers[newName][fieldKey]) ? "array" : typeof parsed.mcpServers[newName][fieldKey]
          if(parsed.mcpServers[newName]?.[fieldKey] && FieldType[fieldKey].type === "select") {
            const field = FieldType[fieldKey]
            if("options" in field && !field.options?.includes(parsed.mcpServers[newName][fieldKey])) {
              setIsFormatError(true)
              jsonError.push({
                errorType: "Options",
                from: 0,
                to: jsonString.length,
                message: t(FieldType[fieldKey].error, { mcp: newName, field: fieldKey, options: field.options.flat().join(" / ") }),
                severity: "error",
              })
            }
          } else if(parsed.mcpServers[newName]?.[fieldKey] && FieldType[fieldKey]?.type !== fieldType) {
            setIsFormatError(true)
            jsonError.push({
              errorType: "FieldType",
              from: 0,
              to: jsonString.length,
              message: t(FieldType[fieldKey].error, { mcp: newName, field: fieldKey }),
              severity: "error",
            })
          } else if(FieldType[fieldKey].type === "number") {
            if("min" in FieldType[fieldKey] && "minError" in FieldType[fieldKey] && (isNaN(parsed.mcpServers[newName][fieldKey]) || (parsed.mcpServers[newName][fieldKey] as number) < (FieldType[fieldKey] as any).min)) {
              if(!FieldType[fieldKey].required && !(fieldKey in parsed.mcpServers[newName])) {
                continue
              }
              setIsRangeError(true)
              jsonError.push({
                errorType: "MinRange",
                from: 0,
                to: jsonString.length,
                message: t(FieldType[fieldKey].minError, { mcp: newName, field: fieldKey, value: FieldType[fieldKey].min }),
                severity: "error",
              })
            } else if("max" in FieldType[fieldKey] && "maxError" in FieldType[fieldKey] && (parsed.mcpServers[newName][fieldKey] as number) > (FieldType[fieldKey] as any).max) {
              setIsRangeError(true)
              jsonError.push({
                errorType: "MaxRange",
                from: 0,
                to: jsonString.length,
                message: t(FieldType[fieldKey].maxError, { mcp: newName, field: fieldKey, value: FieldType[fieldKey].max }),
                severity: "error",
              })
            }
          }
        }
      }

      setIsFormatError(false)
      setIsRangeError(false)
      return jsonError as JsonLintError[]
    } catch (e: any) {
      if(jsonString.trim() === "") {
        return jsonError as JsonLintError[]
      }
      if(!_view) {
        jsonError.push({
          from: 0,
          to: jsonString.length,
          message: e.message,
          severity: "error",
          errorType: "JsonError",
        })
        return jsonError as JsonLintError[]
      }
      const lineMatch = e.message.match(/line\s+(\d+)/)
      const line = lineMatch ? parseInt(lineMatch[1]) : 1
      const linePos = _view.state.doc.line(line)
      setIsFormatError(true)

      jsonError.push({
        from: linePos.from,
        to: linePos.to,
        message: e.message,
        severity: "error",
        errorType: "JsonError",
      })
      return jsonError as JsonLintError[]
    }
  }

  // input  : object
  // output : array [[key, value, isError],...]
  const encodeMcpServers = (mcpServers: mcpServersProps & { env?: Record<string, unknown> }) => {
    const newMcpServers = JSON.parse(JSON.stringify(mcpServers))
    Object.keys(newMcpServers).forEach((fieldKey) => {
      if(newMcpServers[fieldKey] && FieldType[fieldKey as keyof typeof FieldType]?.type === "object" && !Array.isArray(newMcpServers[fieldKey])) {
        const newField = Object.entries(newMcpServers[fieldKey])
                              .map(([key, value]) => [key, value, false] as [string, unknown, boolean])
        newMcpServers[fieldKey] = newField
      }
    })
    return newMcpServers
  }

  // input  : array [[key, value, isError],...]
  // output : object
  const decodeMcpServers = (mcpServers: mcpServersProps) => {
    const newMcpServers = JSON.parse(JSON.stringify(mcpServers))
    Object.keys(newMcpServers).forEach((fieldKey) => {
      if(newMcpServers[fieldKey] && FieldType[fieldKey as keyof typeof FieldType]?.type === "object" && Array.isArray(newMcpServers[fieldKey])) {
        newMcpServers[fieldKey] = Object.fromEntries(newMcpServers[fieldKey])
      }
    })
    return newMcpServers
  }

  // check duplicate name in customList
  const isValidName = (_customList: customListProps[], _tmpCustom: customListProps, index: number, newName: string) => {
    let tmpCustomNames: string[] = []
    try {
      let newTmpCustomServers: Record<string, any> = {}
      if(_tmpCustom.jsonString !== "") {
        newTmpCustomServers = JSON.parse(_tmpCustom.jsonString)
        if(newTmpCustomServers.mcpServers) {
          newTmpCustomServers = newTmpCustomServers.mcpServers
        }
      }
      const newTmpCustomNames = Object.keys(newTmpCustomServers)
      tmpCustomNames = newTmpCustomNames
    } catch(_e) {
      tmpCustomNames = []
    }
    return !_customList.some((custom, i) => i !== index && custom.name === newName)
        && !otherList.some((custom) => custom.name === newName)
        && (index === -1 || !tmpCustomNames.includes(newName))
  }

  // only allow multiple MCPs in type includes "json"
  const isValidToolNumber = (type: customEditPopupProps["_type"], jsonString: string) => {
    try {
      let newMcpServers = JSON.parse(jsonString)
      if(newMcpServers.mcpServers) {
        newMcpServers = newMcpServers.mcpServers
      }
      if(!type.includes("json") && Object.keys(newMcpServers)?.length !== 1) {
        return "tools.jsonFormatError.toolNumberError"
      }
      if(Object.keys(newMcpServers)?.some(key => key === "")) {
        return "tools.jsonFormatError.nameEmpty"
      }
      return ""
    } catch(_e) {
      if(type === "edit" && jsonString.trim() === "") {
        return "tools.jsonFormatError.nameEmpty"
      }
      return "tools.jsonFormatError.jsonError"
    }
  }

  // check type of SINGLE decoded MCP
  // input  : SINGLE mcpServers
  // output : boolean
  const isValidType = (_newMcpServers: Record<string, any>) => {
    const newMcpServers = decodeMcpServers(_newMcpServers)
    for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
      if(FieldType[fieldKey].required && !(fieldKey in newMcpServers)) {
        return false
      }

      if(newMcpServers[fieldKey]) {
        const fieldType = Array.isArray(newMcpServers[fieldKey]) ? "array" : typeof newMcpServers[fieldKey]
        if(FieldType[fieldKey].type === "select") {
          const field = FieldType[fieldKey]
          if("options" in field && !field.options?.includes(newMcpServers[fieldKey])) {
            return false
          }
        } else if(FieldType[fieldKey].type !== fieldType) {
          return false
        }
      }
    }
    return true
  }

  // before field transfer to jsonString
  // check field of SINGLE unEncoded mcpServers Object key is valid
  // input  : SINGLE mcpServers
  // output : boolean
  const isValidField = (_newMcpServers: Record<string, any>) => {
    const newMcpServers = encodeMcpServers(_newMcpServers)
    // [key, value, isError]
    try {
      for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
        if(newMcpServers[fieldKey]) {
          if(FieldType[fieldKey].type === "object") {
            const keys = newMcpServers[fieldKey].map(([key]: [string]) => key)
            const duplicateIndex = keys.findIndex((key: string, index: number) => keys.indexOf(key) !== index)

            if(duplicateIndex !== -1) {
              newMcpServers[fieldKey][duplicateIndex][2] = true
              return false
            }
          } else if(FieldType[fieldKey].type === "select") {
            const field = FieldType[fieldKey]
            if("options" in field && !field.options?.includes(newMcpServers[fieldKey])) {
              newMcpServers[fieldKey][2] = true
              return false
            }
          }
        }
      }
      return true
    } catch(_e) {
      console.log("isValidField error:", _e)
      return false
    }
  }

  const isValidRange = (value: Record<string, any>, field?: keyof typeof FieldType) => {
    try {
      let newMcpServers = value
      if(newMcpServers.mcpServers) {
        newMcpServers = newMcpServers.mcpServers
      }

      // check value is in range
      // if field is required but not in newMcpServers, this error is in isValidField, not in isValidRange
      for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
        if(field && fieldKey !== field) {
          continue
        }
        if(FieldType[fieldKey].type === "number") {
          if(!FieldType[fieldKey].required && !(fieldKey in newMcpServers)) {
            continue
          }
          if("min" in FieldType[fieldKey] && (newMcpServers[fieldKey] ?? 0) < (FieldType[fieldKey].min as number)) {
            if(!FieldType[fieldKey].required && !(fieldKey in newMcpServers)) {
              continue
            }
            return { isError: true, text: "tools.jsonFormatError.minRange", fieldKey: fieldKey, value: FieldType[fieldKey].min as number }
          }
          if("max" in FieldType[fieldKey] && (newMcpServers[fieldKey] ?? 0) > (FieldType[fieldKey].max as number)) {
            return { isError: true, text: "tools.jsonFormatError.maxRange", fieldKey: fieldKey, value: FieldType[fieldKey].max }
          }
        }
      }
      return { isError: false, text: "", fieldKey: "", value: 0 }
    } catch(_e) {
      return { isError: true, text: "", fieldKey: "", value: 0 }
    }
  }

  const handleSubmit = async () => {
    try {
      console.log('[handleSubmit] START - customList:', JSON.stringify(customList.map(c => ({
        name: c.name,
        env: c.mcpServers.env
      })), null, 2))
      
      if (customList.some(mcp => mcp.isError.isError || mcp.isRangeError?.isError)
        || tmpCustom.isError.isError || tmpCustom.isRangeError?.isError)
        return

      setIsSubmitting(true)

      // Check if current editing target is an OAP instance
      const currentMcp = type.includes("add") ? tmpCustom : customList[currentIndex]
      const isOap = currentMcp?.mcpServers?.extraData?.oap
      const originalName = _toolName // Original name from when edit started
      const hasNameChanged = isOap && !type.includes("add") && currentMcp.name !== originalName
      
      if (isOap && !type.includes("add") && !hasNameChanged) {
        // OAP instance with no name change: use PATCH API for quick update
        const envObj: Record<string, string> = {}
        
        if (Array.isArray(currentMcp.mcpServers.env)) {
          currentMcp.mcpServers.env.forEach(([key, value]) => {
            if (key) {
              envObj[key] = String(value)
            }
          })
        }
        
        // Map tlsMode to NODE_TLS_REJECT_UNAUTHORIZED
        if (envObj.tlsMode) {
          envObj.NODE_TLS_REJECT_UNAUTHORIZED = envObj.tlsMode === "skip" ? "0" : "1"
          delete envObj.tlsMode
        }
        
        console.log('[handleSubmit] OAP instance update (no rename):', {
          instanceName: currentMcp.name,
          env: envObj
        })
        
        const res = await fetch(`/api/plugins/oap-platform/instances/${currentMcp.name}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            env: envObj,
            enabled: true  // Auto-enable after successful configuration
          }),
        })
        
        if (!res.ok) {
          throw new Error("Failed to update instance")
        }
        
        showToast({
          message: t("tools.instance.updated") || "Instance updated successfully",
          type: "success"
        })
        
      // Reload MCP config to reflect changes
      await onSubmit(null as any)
      return
    }
    
    // If OAP instance name changed, fall through to full config update below
    if (hasNameChanged) {
      console.log('[handleSubmit] OAP instance renamed:', {
        oldName: originalName,
        newName: currentMcp.name
      })
    }

      // Custom MCP or adding new: use traditional full config update
      const newConfig: {mcpServers: MCPConfig} = { mcpServers: {} }
      if(tmpCustom.jsonString !== "") {
        let processedJsonString = tmpCustom.jsonString.trim()
        if (!processedJsonString.startsWith("{")) {
          processedJsonString = `{${processedJsonString}}`
        }
        let newMcpServers = JSON.parse(processedJsonString)
        if(newMcpServers.mcpServers) {
          newMcpServers = newMcpServers.mcpServers
        }
        newConfig.mcpServers = newMcpServers
      }
      for(const mcp of customList) {
        newConfig.mcpServers[mcp.name] = decodeMcpServers(mcp.mcpServers)
        console.log('[handleSubmit] decoded:', {
          name: mcp.name,
          envType: Array.isArray(newConfig.mcpServers[mcp.name].env) ? 'array' : 'object',
          env: newConfig.mcpServers[mcp.name].env
        })
      }

      //clear env empty key
      Object.keys(newConfig.mcpServers).forEach(mcpName => {
        if(newConfig.mcpServers[mcpName].env) {
          newConfig.mcpServers[mcpName].env = Object.entries(newConfig.mcpServers[mcpName].env)
            .reduce((acc, [k, v]) => {
              if(k) {
                acc[k] = v
              }
              return acc
            }, {} as Record<string, any>)
        }
      })

      // add oap servers to newConfig only if they are missing (to avoid overwriting edited ones)
      const oapServers = Object.keys(_config.mcpServers).filter((mcp: string) => _config.mcpServers[mcp].extraData?.oap)
      for(const oap of oapServers) {
        const oapInstanceId = _config.mcpServers[oap].extraData?.oap?.instanceId
        const oapToolId = _config.mcpServers[oap].extraData?.oap?.id
        
        // Check if this OAP instance already exists in newConfig
        const alreadyExists = Object.values(newConfig.mcpServers).some(
          (v: any) => {
            const vInstanceId = v.extraData?.oap?.instanceId
            const vToolId = v.extraData?.oap?.id
            
            // Match by instanceId if available, otherwise by toolId (backward compat)
            return (oapInstanceId && vInstanceId === oapInstanceId) ||
                   (!oapInstanceId && !vInstanceId && vToolId === oapToolId)
          }
        )
        // Only add if it doesn't exist (user hasn't renamed/edited it)
        if (!alreadyExists && !newConfig.mcpServers[oap]) {
          newConfig.mcpServers[oap] = _config.mcpServers[oap]
        }
      }

      console.log('[handleSubmit] FINAL newConfig:', JSON.stringify(newConfig, null, 2))
      
      // Map tlsMode to NODE_TLS_REJECT_UNAUTHORIZED in env objects
      Object.keys(newConfig.mcpServers).forEach((serverName) => {
        const serverEnv = newConfig.mcpServers[serverName]?.env
        if (serverEnv && typeof serverEnv === "object" && !Array.isArray(serverEnv)) {
          if (serverEnv.tlsMode) {
            serverEnv.NODE_TLS_REJECT_UNAUTHORIZED = serverEnv.tlsMode === "skip" ? "0" : "1"
            delete serverEnv.tlsMode
          }
        }
      })
      
      await onSubmit(newConfig)
    } catch (err) {
      if (err instanceof SyntaxError) {
        showToast({
          message: t("tools.invalidJson"),
          type: "error"
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const mcpNameMask = (name: string, maxLength: number = 18) => {
    return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name
  }

  const CustomList = useMemo(() => {
    if(type === "edit-json") {
      return null
    }

    return (
      <div className="tool-edit-list">
        <Tooltip
          disabled={!tmpCustom.isError.isError && !tmpCustom.isRangeError?.isError}
          content={(tmpCustom.isRangeError?.isError && tmpCustom.isRangeError.fieldKey !== "") ? t(tmpCustom.isRangeError.text, { mcp: tmpCustom.name, field: tmpCustom.isRangeError.fieldKey, value: tmpCustom.isRangeError.value }) : t(tmpCustom.isError.text, { mcp: tmpCustom.isError.name ?? tmpCustom.name })}
          side="right"
        >
          <div
            className={`tool-edit-list-item ${(tmpCustom.isError.isError || tmpCustom.isRangeError?.isError) && "error"} ${currentIndex === -1 && type.includes("add") && "active"}`}
            onClick={() => {
              setType("add")
              setCurrentIndex(-1)
            }}
          >
            <div className="tool-edit-list-item-content">
              <div className="left">
                <label>
                  {`+ ${t("tools.custom.listAdd")}`}
                </label>
                {(tmpCustom.isError.isError || tmpCustom.isRangeError?.isError) && (
                  <svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                    <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                    <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                  </svg>
                )}
              </div>
            </div>
          </div>
        </Tooltip>
        {customList && customList.map((mcp, index) => (
          (mcp.isError?.isError || mcp.isRangeError?.isError) ? (
            <Tooltip
              key={index}
              content={(mcp.isRangeError?.isError && mcp.isRangeError.fieldKey !== "") ? t(mcp.isRangeError.text, { mcp: mcp.name, field: mcp.isRangeError.fieldKey, value: mcp.isRangeError.value }) : t(mcp.isError.text, { mcp: mcp.name })}
              side="right"
            >
              <div
                className={`tool-edit-list-item error ${index === currentIndex ? "active" : ""}`}
                onClick={() => {
                  setType("edit")
                  setCurrentIndex(index)
                }}
              >
                <div className="tool-edit-list-item-content">
                  <div className="left">
                    <label>
                      {mcpNameMask(mcp.name, 18)}
                    </label>
                    <svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                      <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                      <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                    </svg>
                  </div>
                </div>
              </div>
            </Tooltip>
          ) : (
            <div
              key={index}
              className={`tool-edit-list-item ${index === currentIndex ? "active" : ""}`}
              onClick={() => {
                setType("edit")
                setCurrentIndex(index)
              }}
            >
              <label>
                {mcpNameMask(mcp.name, 21)}
              </label>
            </div>
          )
        ))}
      </div>
    )
  }, [customList, tmpCustom, currentIndex])

  // Calculate currentMcpServers at component top level
  const currentMcpServers = useMemo(() => {
    const result = type.includes("add") ? tmpCustom.mcpServers : customList[currentIndex]?.mcpServers
    return result
  }, [type, tmpCustom.mcpServers, customList, currentIndex])

  // 切换 server/tool 时，从现有 headers 反解认证方式，回填到表单
  useEffect(() => {
    const h = (currentMcpServers && currentMcpServers.headers) || {}
    const auth = h.Authorization || h.authorization || ""
    if (typeof auth === "string" && auth.startsWith("Bearer ")) {
      setAuthMethod("bearer"); setAuthToken(auth.slice(7))
    } else if (typeof auth === "string" && auth.startsWith("Basic ")) {
      setAuthMethod("basic")
      try { const d = atob(auth.slice(6)); const i = d.indexOf(":"); setAuthUser(i >= 0 ? d.slice(0, i) : d); setAuthPass(i >= 0 ? d.slice(i + 1) : "") }
      catch { setAuthUser(""); setAuthPass("") }
    } else if (Object.keys(h).length > 0) {
      const n = Object.keys(h)[0]; setAuthMethod("custom"); setAuthHeaderName(n); setAuthHeaderValue(String(h[n] ?? ""))
    } else {
      setAuthMethod("none")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, type])

  // 根据认证方式生成 headers 并写入配置
  const writeAuthHeaders = (method: string, token: string, user: string, pass: string, name: string, value: string) => {
    let headers: Record<string, string> = {}
    if (method === "bearer") {
      if (token) headers = { "Authorization": `Bearer ${token}` }
    } else if (method === "basic") {
      if (user || pass) { try { headers = { "Authorization": `Basic ${btoa(`${user}:${pass}`)}` } } catch { headers = {} } }
    } else if (method === "custom") {
      if (name) headers = { [name]: value }
    }
    handleCustomChange("headers", headers)
  }

  // Convert env to array format for SchemaForm - moved to component top level
  const envConfig = useMemo(() => {
    const env = currentMcpServers?.env;
    
    if (!env) {
      return [];
    }
    
    // If it's already an array, process values and return
    if (Array.isArray(env)) {
      const result = env.map(([key, value, error]) => {
        let processedValue = value;
        
        // Ensure MAX_TOKEN_CACHE_SIZE is string or number
        if (key === 'MAX_TOKEN_CACHE_SIZE' && value !== null && value !== undefined) {
          processedValue = String(value);
        }
        
        return [key, processedValue, error] as [string, unknown, boolean];
      });
      
      // Map NODE_TLS_REJECT_UNAUTHORIZED to tlsMode for UI
      const tlsEntry = result.find(([key]) => key === 'NODE_TLS_REJECT_UNAUTHORIZED');
      const esCa = result.find(([key]) => key === 'ES_CA_CERT');
      const kibanaCa = result.find(([key]) => key === 'KIBANA_CA_CERT');
      if (tlsEntry) {
        const tlsValue = String(tlsEntry[1] ?? '');
        const hasCaCert = !!(esCa?.[1] || kibanaCa?.[1]);
        const tlsMode = tlsValue === '0' ? 'skip' : (hasCaCert ? 'ca-cert' : 'default');
        
        // Remove NODE_TLS_REJECT_UNAUTHORIZED from form config and add tlsMode
        const filtered = result.filter(([key]) => key !== 'NODE_TLS_REJECT_UNAUTHORIZED');
        filtered.push(['tlsMode', tlsMode, false]);
        return filtered;
      }
      
      return result;
    }
    
    // If it's an object, convert to array format [key, value, error] with value conversion
    if (typeof env === 'object') {
      const result = Object.entries(env).map(([key, value]) => {
        let processedValue = value;
        
        // Ensure MAX_TOKEN_CACHE_SIZE is string or number
        if (key === 'MAX_TOKEN_CACHE_SIZE' && value !== null && value !== undefined) {
          processedValue = String(value);
        }
        
        return [key, processedValue, false] as [string, unknown, boolean];
      });
      
      // Map NODE_TLS_REJECT_UNAUTHORIZED to tlsMode for UI
      const tlsEntry = result.find(([key]) => key === 'NODE_TLS_REJECT_UNAUTHORIZED');
      const esCa = result.find(([key]) => key === 'ES_CA_CERT');
      const kibanaCa = result.find(([key]) => key === 'KIBANA_CA_CERT');
      if (tlsEntry) {
        const tlsValue = String(tlsEntry[1] ?? '');
        const hasCaCert = !!(esCa?.[1] || kibanaCa?.[1]);
        const tlsMode = tlsValue === '0' ? 'skip' : (hasCaCert ? 'ca-cert' : 'default');
        
        const filtered = result.filter(([key]) => key !== 'NODE_TLS_REJECT_UNAUTHORIZED');
        filtered.push(['tlsMode', tlsMode, false]);
        return filtered;
      }
      
      return result;
    }
    
    return [];
  }, [currentMcpServers?.env]);

  const Field = useMemo(() => {
    if(type === "edit-json" || type === "add-json") {
      return null
    }

    // wait for customList and currentIndex, so show container first
    if (type !== "add" && (!customList || !customList[currentIndex] || !customList[currentIndex])) {
      return (
        <div className="tool-edit-field"></div>
      )
    }

    const currentMcp = type.includes("add") ? tmpCustom : customList[currentIndex]
    const isOap = currentMcpServers?.extraData?.oap;
    // Try to get configSchema from multiple possible locations
    const configSchema = currentMcpServers?.configSchema 
      || currentMcpServers?.extraData?.oap?.configSchema
      || null;

    const handleEnvChange = (newEnv: [string, unknown, boolean][]) => {
      const keys = newEnv.map(([key]) => key)
      keys.forEach((key, index) => {
        newEnv[index][2] = false
        if(keys.filter(k => k === key).length > 1) {
          newEnv[index][2] = true
        }
      })
      
      // Convert values before passing to handleCustomChange
      // Ensure all keys are preserved, only convert NODE_TLS_REJECT_UNAUTHORIZED
      const processedEnv = newEnv.map(([key, value, error]) => {
        // Convert NODE_TLS_REJECT_UNAUTHORIZED from boolean to '1'/'0'
        if (key === 'NODE_TLS_REJECT_UNAUTHORIZED') {
          const boolValue = value === true || value === 'true' || value === 1 || value === '1';
          return [key, boolValue ? '1' : '0', error] as [string, unknown, boolean];
        }
        
        // Preserve all other keys and values as-is
        return [key, value, error] as [string, unknown, boolean];
      });
      
      handleCustomChange("env", processedEnv)
    }

    return (
      <div className="tool-edit-field">
        {/* Hide "栏位" title in OAP mode */}
        {!isOap && (
          <div className="tool-edit-title">
            {t("tools.fieldTitle")}
            <Tooltip content={t("tools.fieldTitleAlt")} side="bottom" align="start" maxWidth={402}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
                <path d="M8.73 6.64V12H7.85V6.64H8.73ZM8.3 4.63C8.43333 4.63 8.55 4.67667 8.65 4.77C8.75667 4.85667 8.81 4.99667 8.81 5.19C8.81 5.37667 8.75667 5.51667 8.65 5.61C8.55 5.70333 8.43333 5.75 8.3 5.75C8.15333 5.75 8.03 5.70333 7.93 5.61C7.83 5.51667 7.78 5.37667 7.78 5.19C7.78 4.99667 7.83 4.85667 7.93 4.77C8.03 4.67667 8.15333 4.63 8.3 4.63Z" fill="currentColor"/>
              </svg>
            </Tooltip>
          </div>
        )}
        <div className="field-content">
          {isOap ? (
            <>
              {/* OAP Integration: Simplified UI */}
              <div className="oap-edit-notice">
                {t("tools.oap.edit_managed_notice") || "This integration is managed by OAP Platform. Configure the required settings below."}
              </div>
              
              {/* Name (editable for OAP) */}
              <div className="field-item">
                <label>Name</label>
                <input
                  disabled={false}
                  placeholder={t("tools.namePlaceholder")}
                  type="text"
                  value={currentMcp.name}
                  onChange={(e) => handleCustomChange("name", e.target.value)}
                />
              </div>
              
              {/* Package Info */}
              <div className="field-item">
                <label>{t("tools.packageInfo") || "Package"}</label>
                <div className="field-item-package-info">
                  <div className="package-name">
                    {currentMcpServers?.extraData?.oap?.name || 
                     currentMcpServers?.extraData?.oap?.id || 
                     currentMcp.name || 
                     "Unknown"}
                  </div>
                  {currentMcpServers.version && (
                    <div className="package-version">v{currentMcpServers.version}</div>
                  )}
                </div>
              </div>
              
              {/* Schema Form for ENV configuration */}
              {configSchema ? (
                <>
                  <SchemaForm
                    schema={configSchema}
                    config={envConfig}
                    onChange={handleEnvChange}
                    disabled={false}
                  />
                  
                  {/* JSON Configuration Preview - ONLY for custom MCPs, not OAP integrations */}
                  {!currentMcp?.mcpServers?.extraData?.oap && (
                    <details className="oap-json-preview">
                      <summary className="oap-json-preview-summary">
                        <svg className="chevron-icon" width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>{t("tools.viewJsonConfig")}</span>
                      </summary>
                      <div className="oap-json-preview-content">
                        <pre className="json-code">
                          {JSON.stringify({
                            mcpServers: {
                              [currentMcp.name]: decodeMcpServers(currentMcp.mcpServers)
                            }
                          }, null, 2)}
                        </pre>
                        <div className="oap-json-preview-actions">
                          <button
                            className="copy-json-button"
                            onClick={() => {
                              const jsonConfig = JSON.stringify({
                                mcpServers: {
                                  [currentMcp.name]: decodeMcpServers(currentMcp.mcpServers)
                                }
                              }, null, 2);
                              navigator.clipboard.writeText(jsonConfig);
                              showToast({
                                message: t("tools.jsonCopied"),
                                type: "success"
                              });
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M10.5 13.5H1.5V3.5H7.5L10.5 6.5V13.5Z" stroke="currentColor" strokeWidth="1.2"/>
                              <path d="M5.5 1.5H14.5V10.5" stroke="currentColor" strokeWidth="1.2"/>
                            </svg>
                            {t("tools.copyJsonConfig")}
                          </button>
                        </div>
                      </div>
                    </details>
                  )}
                </>
              ) : (
                // Fallback: manual ENV editing if no schema
                <div className="field-item">
                  <label>
                    ENV
                    <button onClick={() => {
                      const newEnv = Array.isArray(currentMcpServers?.env)
                        ? [...currentMcpServers.env]
                        : []
                      let index = 0
                      while(newEnv.some(([key]) => key === `key${index}`)) {
                        index++
                      }
                      const nextKey = `key${index}`
                      newEnv.push([nextKey, "", false] as [string, unknown, boolean])
                      handleEnvChange(newEnv)
                    }}>
                      + {t("tools.addEnv")}
                    </button>
                  </label>
                  <div className={`field-item-array ${(currentMcpServers?.env && currentMcpServers.env.length > 0) ? "no-border" : ""}`}>
                    {(currentMcpServers?.env && currentMcpServers.env.length > 0) && currentMcpServers?.env.map(([envKey, envValue, isError]: [string, unknown, boolean], index: number) => (
                        <div key={index} className={`field-item-array-item ${isError ? "error" : ""}`}>
                          <div className="key-input-wrapper">
                            <input
                              disabled={!!envKey && envKey !== "key" && !envKey.startsWith("key")}
                              className="env-key"
                              type="text"
                              placeholder={t("tools.envKey")}
                              value={envKey}
                              onChange={(e) => {
                                const newEnv = [...(currentMcpServers.env || [])]
                                newEnv[index][0] = e.target.value
                                newEnv[index][2] = false
                                handleEnvChange(newEnv)
                              }}
                            />
                            {isError ? (
                              <Tooltip content={t("tools.inputKeyError", { name: "ENV" })} side="left">
                                <div
                                  className="key-input-error"
                                  onClick={(e) => {
                                    const input = e.currentTarget.parentElement?.parentElement?.querySelector("input")
                                    if (input) {
                                      input.focus()
                                    }
                                  }}
                                />
                              </Tooltip>
                            ) : null}
                          </div>
                          <input
                            className="env-value"
                            type="text"
                            placeholder={t("tools.envValue")}
                            value={envValue as string}
                            onChange={(e) => {
                              const newEnv = [...(currentMcpServers.env || [])]
                              newEnv[index][1] = e.target.value
                              newEnv[index][2] = false
                              handleEnvChange(newEnv)
                            }}
                          />
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 18 18"
                            width="22"
                            height="22"
                            className="field-item-array-item-clear"
                            onClick={() => {
                              const newEnv = (currentMcpServers.env || []).filter((_, i) => i !== index)
                              handleEnvChange(newEnv)
                            }}
                          >
                            <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                          </svg>
                        </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Custom MCP: Full configuration UI */}
              {/* Name */}
              <div className="field-item">
                <label>Name</label>
                <input
                  placeholder={t("tools.namePlaceholder")}
                  type="text"
                  value={currentMcp.name}
                  onChange={(e) => handleCustomChange("name", e.target.value)}
                />
              </div>
              
              {/* Command is hidden in browser deployments because stdio tools are local-process based. */}
              {!isWeb && (!currentMcpServers.transport || currentMcpServers.transport === "stdio") && (
                <div className="field-item">
                  <label>Command</label>
                  <input
                    placeholder={t("tools.commandPlaceholder")}
                    type="text"
                    value={currentMcpServers?.command || ""}
                    onChange={(e) => handleCustomChange("command", e.target.value)}
                  />
                </div>
              )}
              
              {/* Transport — web mode only allows HTTP-based transports (no stdio) */}
              <div className="field-item">
                <label>Transport</label>
                <Select
                  options={FieldType.transport.options
                    .filter((option) => !isWeb || option !== "stdio")
                    .map((option) => ({
                      value: option,
                      label: (
                        <div className="model-select-label" key={option}>
                          <span className="model-select-label-text">
                            {option}
                          </span>
                        </div>
                      )
                    }))
                  }
                  placeholder={t("tools.transportPlaceholder")}
                  value={currentMcpServers.transport ?? (isWeb ? "streamable" : FieldType.transport.options[0])}
                  onSelect={(value) => handleCustomChange("transport", value)}
                />
              </div>
              
              {/* URL - only for sse/streamable/websocket transports */}
              {(currentMcpServers.transport === "sse" || currentMcpServers.transport === "streamable" || currentMcpServers.transport === "websocket") && (
                <div className="field-item">
                  <label>URL</label>
                  <input
                    placeholder={t("tools.urlPlaceholder")}
                    type="text"
                    value={currentMcpServers?.url || ""}
                    onChange={(e) => handleCustomChange("url", e.target.value)}
                  />
                </div>
              )}
              
              {/* 认证方式 — 仅 http 类 transport（sse/streamable/websocket）；自动生成 headers */}
              {(currentMcpServers.transport === "sse" || currentMcpServers.transport === "streamable" || currentMcpServers.transport === "websocket") && (
                <>
                  <div className="field-item">
                    <label>{t("tools.auth.label", "认证方式")}</label>
                    <Select
                      options={[
                        { value: "none", label: (<div className="model-select-label"><span className="model-select-label-text">{t("tools.auth.none", "无")}</span></div>) },
                        { value: "bearer", label: (<div className="model-select-label"><span className="model-select-label-text">Bearer Token</span></div>) },
                        { value: "basic", label: (<div className="model-select-label"><span className="model-select-label-text">Basic Auth</span></div>) },
                        { value: "custom", label: (<div className="model-select-label"><span className="model-select-label-text">{t("tools.auth.custom", "自定义 Header")}</span></div>) },
                      ]}
                      value={authMethod}
                      onSelect={(value) => { setAuthMethod(value); writeAuthHeaders(value, authToken, authUser, authPass, authHeaderName, authHeaderValue) }}
                    />
                  </div>

                  {authMethod === "bearer" && (
                    <div className="field-item">
                      <label>Token</label>
                      <input
                        type="password"
                        placeholder={t("tools.auth.tokenPlaceholder", "粘贴 Token（自动加 Bearer 前缀）")}
                        value={authToken}
                        onChange={(e) => { setAuthToken(e.target.value); writeAuthHeaders("bearer", e.target.value, authUser, authPass, authHeaderName, authHeaderValue) }}
                      />
                    </div>
                  )}

                  {authMethod === "basic" && (
                    <>
                      <div className="field-item">
                        <label>{t("tools.auth.username", "用户名")}</label>
                        <input type="text" value={authUser}
                          onChange={(e) => { setAuthUser(e.target.value); writeAuthHeaders("basic", authToken, e.target.value, authPass, authHeaderName, authHeaderValue) }} />
                      </div>
                      <div className="field-item">
                        <label>{t("tools.auth.password", "密码")}</label>
                        <input type="password" value={authPass}
                          onChange={(e) => { setAuthPass(e.target.value); writeAuthHeaders("basic", authToken, authUser, e.target.value, authHeaderName, authHeaderValue) }} />
                      </div>
                    </>
                  )}

                  {authMethod === "custom" && (
                    <>
                      <div className="field-item">
                        <label>{t("tools.auth.headerName", "Header 名")}</label>
                        <input type="text" placeholder="X-API-Key" value={authHeaderName}
                          onChange={(e) => { setAuthHeaderName(e.target.value); writeAuthHeaders("custom", authToken, authUser, authPass, e.target.value, authHeaderValue) }} />
                      </div>
                      <div className="field-item">
                        <label>{t("tools.auth.headerValue", "Header 值")}</label>
                        <input type="password" value={authHeaderValue}
                          onChange={(e) => { setAuthHeaderValue(e.target.value); writeAuthHeaders("custom", authToken, authUser, authPass, authHeaderName, e.target.value) }} />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ENV - always use key-value for custom MCP */}
              <div className="field-item">
                <label>
                  ENV
                  <button onClick={() => {
                    const newEnv = Array.isArray(currentMcpServers?.env)
                      ? [...currentMcpServers.env]
                      : []
                    let index = 0
                    while(newEnv.some(([key]) => key === `key${index}`)) {
                      index++
                    }
                    const nextKey = `key${index}`
                    newEnv.push([nextKey, "", false] as [string, unknown, boolean])
                    handleEnvChange(newEnv)
                  }}>
                    + {t("tools.addEnv")}
                  </button>
                </label>
                <div className={`field-item-array ${(currentMcpServers?.env && currentMcpServers.env.length > 0) ? "no-border" : ""}`}>
                  {(currentMcpServers?.env && currentMcpServers.env.length > 0) && currentMcpServers?.env.map(([envKey, envValue, isError]: [string, unknown, boolean], index: number) => (
                      <div key={index} className={`field-item-array-item ${isError ? "error" : ""}`}>
                        <div className="key-input-wrapper">
                          <input
                            className="env-key"
                            type="text"
                            placeholder={t("tools.envKey")}
                            value={envKey}
                            onChange={(e) => {
                              const newEnv = [...(currentMcpServers.env || [])]
                              newEnv[index][0] = e.target.value
                              newEnv[index][2] = false
                              handleEnvChange(newEnv)
                            }}
                          />
                          {isError ? (
                            <Tooltip content={t("tools.inputKeyError", { name: "ENV" })} side="left">
                              <div
                                className="key-input-error"
                                onClick={(e) => {
                                  const input = e.currentTarget.parentElement?.parentElement?.querySelector("input")
                                  if (input) {
                                    input.focus()
                                  }
                                }}
                              />
                            </Tooltip>
                          ) : null}
                        </div>
                        <input
                          className="env-value"
                          type="text"
                          placeholder={t("tools.envValue")}
                          value={envValue as string}
                          onChange={(e) => {
                            const newEnv = [...(currentMcpServers.env || [])]
                            newEnv[index][1] = e.target.value
                            newEnv[index][2] = false
                            handleEnvChange(newEnv)
                          }}
                        />
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 18 18"
                          width="22"
                          height="22"
                          className="field-item-array-item-clear"
                          onClick={() => {
                            const newEnv = (currentMcpServers.env || []).filter((_, i) => i !== index)
                            handleEnvChange(newEnv)
                          }}
                        >
                          <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                        </svg>
                      </div>
                  ))}
                </div>
              </div>
              
              {/* Initial Timeout (s) */}
              <div className={`field-item ${isValidRange(currentMcpServers, "initialTimeout")?.isError ? "error" : ""}`}>
                <div className="field-item-title">
                  <label>Initial Timeout (s)</label>
                  <Tooltip content={t("tools.initialTimeoutAlt")} side="bottom" align="start" maxWidth={402}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
                      <path d="M8.73 6.64V12H7.85V6.64H8.73ZM8.3 4.63C8.43333 4.63 8.55 4.67667 8.65 4.77C8.75667 4.85667 8.81 4.99667 8.81 5.19C8.81 5.37667 8.75667 5.51667 8.65 5.61C8.55 5.70333 8.43333 5.75 8.3 5.75C8.15333 5.75 8.03 5.70333 7.93 5.61C7.83 5.51667 7.78 5.37667 7.78 5.19C7.78 4.99667 7.83 4.85667 7.93 4.77C8.03 4.67667 8.15333 4.63 8.3 4.63Z" fill="currentColor"/>
                    </svg>
                  </Tooltip>
                </div>
                <div className="key-input-wrapper">
                  <input
                    placeholder={t("tools.initialTimeoutPlaceholder")}
                    type="number"
                    value={currentMcpServers.initialTimeout}
                    onChange={(e) => handleCustomChange("initialTimeout", parseFloat(e.target.value))}
                  />
                  {isValidRange(currentMcpServers, "initialTimeout")?.isError ? (
                    <Tooltip content={t("tools.initialTimeoutError")} side="left">
                      <div
                        className="key-input-error"
                        onClick={(e) => {
                          const input = e.currentTarget.parentElement?.parentElement?.querySelector("input")
                          if (input) {
                            input.focus()
                          }
                        }}
                      />
                    </Tooltip>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }, [customList, tmpCustom, currentIndex, type, envConfig, currentMcpServers])

  const JSONEditor = useMemo(() => {
    const copyJson = () => {
      navigator.clipboard.writeText(customList[currentIndex]?.jsonString)
      showToast({
        message: t("tools.jsonCopied"),
        type: "success"
      })
    }

    const downloadJson = () => {
      const blob = new Blob([customList[currentIndex]?.jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${customList[currentIndex]?.name?.length > 0 ? "mcpServers-"+customList[currentIndex]?.name : "mcpServers"}.json`
      a.click()
    }

    const inputTheme = EditorView.theme({
      ".cm-content": {
        color: "var(--text)",
        paddingBottom: "10px",
      },
      ".cm-lineNumbers": {
        color: "var(--text)",
      },
      ".cm-gutters": {
        paddingBottom: "10px",
      }
    })

    const createJsonLinter = () => {
      return linter((view) => {
        const doc = view.state.doc.toString()
        if (!doc.trim())
          return []

        return jsonLinterError(doc, customList, tmpCustom, currentIndex, view)
      })
    }

    const handleJsonChangeCustom = async (value: string) => {
      let newType = type
      try {
        let newJson = jsonlint.parse(value)
        if(Object.keys(newJson)[0] !== "mcpServers") {
          newJson = { mcpServers: newJson }
        }
        const newMcpServers = newJson.mcpServers
        const newMcpNames = Object.keys(newMcpServers)
        if(newType.includes("add")) {
          try {
            if(newMcpNames.length > 1 && type === "add") {
              newType = "add-json"
            } else if(newMcpNames.length < 2 && type === "add-json") {
              newType = "add"
            }
          } catch(_e) {
            newType = "add"
          }
        }
        setType(newType)
        if(newType === "add-json") {
          const newTmpCustom = emptyCustom()
          newTmpCustom.jsonString = value
          handleError(newTmpCustom as customListProps, customList)
        } else if(newType === "add") {
          for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
            if("min" in FieldType[fieldKey] && !(fieldKey in newMcpServers[newMcpNames[0]])) {
              newMcpServers[newMcpNames[0]][fieldKey] = FieldType[fieldKey].min
            }
          }
          // If the only error is NameExist, syncing data between the field and the JSON editor should still be allowed.
          // Because when the NameExist error is fixed, it can’t decide which data should be recovered and which should be overwritten.
          const jsonError = jsonLinterError(value, customList, tmpCustom, currentIndex)
          const allowSync = jsonError.length === 0 || (jsonError.length === 1 && jsonError[0].errorType === "NameExist")
          const newTmpCustom = {
            jsonString: value,
            name: allowSync ? (newMcpNames[0] ?? "") : tmpCustom.name,
            mcpServers: allowSync ? encodeMcpServers(newMcpServers[newMcpNames[0]]) : tmpCustom.mcpServers
          }
          handleError(newTmpCustom as customListProps, customList)
        } else {
          const jsonError = jsonLinterError(value, customList, tmpCustom, currentIndex)
          const allowSync = jsonError.length === 0 || (jsonError.length === 1 && jsonError[0].errorType === "NameExist")
          const newCustomList = [...customList]
          newCustomList[currentIndex] = {
            ...newCustomList[currentIndex],
            jsonString: value,
            name: newMcpNames[0],
            mcpServers: allowSync ? encodeMcpServers(newMcpServers[newMcpNames[0]]) : newCustomList[currentIndex].mcpServers
          }
          handleError(tmpCustom as customListProps, newCustomList)
        }
      } catch(_e) {
        console.log("error:", _e)
        if(newType === "add-json") {
          newType = "add"
        }
        setType(newType)
        if(newType === "add") {
          let newTmpCustom
          if(value.trim() === "") {
            newTmpCustom = emptyCustom()
            newTmpCustom.jsonString = value
          } else {
            newTmpCustom = {
              ...tmpCustom,
              jsonString: value,
            }
          }
          handleError(newTmpCustom as customListProps, customList)
        } else {
          const newCustomList = [...customList]
          newCustomList[currentIndex] = {
            ...newCustomList[currentIndex],
            jsonString: value
          }
          handleError(tmpCustom, newCustomList)
        }
      }
    }

    const logTime = (timestamp: string) => {
      const date = new Date(timestamp)
      return date.toLocaleString("en-US")
    }

    return (
      <div className={`tool-edit-json-editor ${type} ${(toolLog && toolLog.length > 0) ? "submitting" : ""}`}>
        <div className="tool-edit-title">
          JSON
          <div className="tool-edit-desc">
            {t("tools.jsonDesc")}
          </div>
        </div>
        <CodeMirror
          minWidth={(type === "edit-json" || type === "add-json") ? "670px" : "400px"}
          placeholder={"{\n \"mcpServers\":{}\n}"}
          theme={theme === "system" ? systemTheme : theme}
          value={type.includes("add") ? tmpCustom.jsonString : customList[currentIndex]?.jsonString}
          extensions={[
            json(),
            lintGutter(),
            createJsonLinter(),
            inputTheme
          ]}
          onChange={(value) => {
            let newJsonString = value
            if(!value.trim().startsWith("{") && value.trim().length > 0) {
              newJsonString = `{\n ${value}\n}`
            }
            handleJsonChangeCustom(newJsonString)
          }}
        />
        <div className="tool-edit-json-editor-copy">
          <Tooltip
            content={t("tools.jsonCopy")}
            side="bottom"
          >
            <div onClick={copyJson}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Tooltip>
          <Tooltip
            content={t("tools.jsonDownload")}
            side="bottom"
          >
            <div onClick={downloadJson}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 1.81836L10 12.7275" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M6.33105 9.12305L9.99973 12.7917L13.6684 9.12305" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2.72754 13.6367V16.2731C2.72754 16.8254 3.17526 17.2731 3.72754 17.2731H16.273C16.8253 17.2731 17.273 16.8254 17.273 16.2731V13.6367" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Tooltip>
        </div>
        {toolLog && toolLog.length > 0 &&
          <div className="tool-edit-json-editor-log">
            <div className="tool-edit-json-editor-log-title">
              {t("tools.logTitle")}
              <div className="tool-edit-json-editor-log-title-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="17" viewBox="0 0 14 17" fill="none">
                  <path d="M0.502643 8.22159C0.502643 8.49773 0.726501 8.72159 1.00264 8.72159C1.27879 8.72159 1.50264 8.49773 1.50264 8.22159L0.502643 8.22159ZM12.9297 6.58454L11.8635 0.910342L7.48259 4.67079L12.9297 6.58454ZM1.00264 8.22159L1.50264 8.22159C1.50264 5.37117 3.81769 2.875 6.61537 2.875L6.61537 2.375L6.61537 1.875C3.21341 1.875 0.502643 4.87236 0.502643 8.22159L1.00264 8.22159ZM6.61537 2.375L6.61537 2.875C7.89483 2.875 8.9093 3.12599 9.75157 3.60453L9.99857 3.1698L10.2456 2.73507C9.22264 2.15388 8.02979 1.875 6.61537 1.875L6.61537 2.375Z" fill="currentColor"/>
                  <path d="M13.427 8.77841C13.427 8.50227 13.2032 8.27841 12.927 8.27841C12.6509 8.27841 12.427 8.50227 12.427 8.77841L13.427 8.77841ZM1 10.4155L2.06619 16.0897L6.4471 12.3292L1 10.4155ZM12.927 8.77841L12.427 8.77841C12.427 11.6288 10.112 14.125 7.31432 14.125L7.31432 14.625L7.31432 15.125C10.7163 15.125 13.427 12.1276 13.427 8.77841L12.927 8.77841ZM7.31432 14.625L7.31432 14.125C6.03486 14.125 5.02039 13.874 4.17811 13.3955L3.93112 13.8302L3.68412 14.2649C4.70705 14.8461 5.8999 15.125 7.31432 15.125L7.31432 14.625Z" fill="currentColor"/>
                </svg>
                {t("tools.logProcessing")}
              </div>
            </div>
            <div className="tool-edit-json-editor-log-content" ref={logContentRef}>
              {toolLog?.map((log, index) => (
                <div key={index}>
                  <div className="log-entry">
                    <span className="timestamp">[{logTime(log.timestamp)}]</span>
                    <span className="debug-label">[{log.event}]</span>
                    <span className="log-content">{log.body}</span>
                  </div>
                </div>
              ))}
              <div className="log-dots"></div>
            </div>
          </div>
        }
      </div>
    )
  }, [theme, systemTheme, customList, tmpCustom, currentIndex, type, toolLog, isSubmitting])

  const customTitle = (type: string) => {
    switch(type) {
      case "edit":
        return t("tools.custom.titleEdit", { tool: customList[currentIndex]?.name })
      case "add":
        case "add-json":
        return t("tools.custom.titleAdd")
      case "edit-json":
        return t("tools.custom.titleEditJson")
    }
  }

  return (
    <PopupConfirm
      overlay
      className={`tool-edit-popup-container ${type}`}
      onConfirm={handleSubmit}
      onCancel={onCancel}
      disabled={isFormatError || isRangeError || tmpCustom.isError?.isError || tmpCustom.isRangeError?.isError || customList.some(custom => custom.isError?.isError || custom.isRangeError?.isError) || isSubmitting}
      loading={isSubmitting}
      zIndex={1000}
      listenHotkey={false}
      confirmText={t("tools.save")}
      footerHint={ type.startsWith("edit") &&
        <div className="tool-edit-popup-footer-hint">
          {onDelete && !isSubmitting &&
            <Button
              className="tool-edit-delete"
              color="white"
              size="fit"
              padding="n"
              onClick={() => onDelete(customList[currentIndex]?.name)}
            >
              {t("tools.delete")}
            </Button>
          }
        </div>
      }
    >
      <div className="tool-edit-popup-header">
        <Button className="header-close" size="round" border="none" onClick={onCancel}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"></path>
          </svg>
        </Button>
        {t("tools.custom.headerBtn")}
      </div>
      <div className="tool-edit-popup">
        {CustomList}
        <div className="tool-edit-popup-content">
          <div className="tool-edit-header">
            <span>{customTitle(type)}</span>
            <Tooltip content={t("tools.toogleToolAlt")} side="bottom" disabled={type !== "edit"}>
              <div className="tool-edit-header-actions">
                {type === "edit" &&
                  <Switch
                    checked={customList[currentIndex]?.mcpServers.enabled || false}
                    onChange={() => handleCustomChange("enabled", !customList[currentIndex]?.mcpServers.enabled)}
                  />}
              </div>
            </Tooltip>
          </div>
          <div className="tool-edit-content">
            {Field}
            {/* JSON Editor - only show for custom MCP (not OAP) or explicit JSON mode */}
            {(() => {
              const currentMcpServers = type.includes("add") ? tmpCustom.mcpServers : customList[currentIndex]?.mcpServers;
              const isOap = currentMcpServers?.extraData?.oap;
              const showJsonEditor = !isOap || type.includes("json");
              return showJsonEditor ? JSONEditor : null;
            })()}
          </div>
        </div>
      </div>
    </PopupConfirm>
  )
})

export default React.memo(CustomEdit)