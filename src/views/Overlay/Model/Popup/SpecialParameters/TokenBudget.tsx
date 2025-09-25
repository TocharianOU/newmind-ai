import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import WrappedInput from "../../../../../components/WrappedInput"
import { Parameter } from "../../../../../helper/modelParameterUtils"
import Switch from "../../../../../components/Switch"

const TokenBudgetParameter = ({
  min,
  max,
  parameters,
  setParameters,
}: {
  min: number
  max: number
  parameters: Parameter[]
  setParameters: (parameters: Parameter[]) => void
}) => {
  // last saving format is -- thinking: {"type": "enabled", "budget_tokens": 10_000}
  const { t } = useTranslation()
  const [tokenBudget, setTokenBudget] = useState<number>(0)
  const [isTokenBudgetEnabled, setIsTokenBudgetEnabled] = useState<boolean>(false)

  useEffect(() => {
    const parameter = parameters.find((p) => p.name === "budget_tokens" && p.isSpecific)
    if (parameter) {
      setTokenBudget(Number(parameter.value))
      setIsTokenBudgetEnabled(!!parameter.isTokenBudget)
    }
  }, [parameters])

  const enableTokenBudgetChange = (e: React.ChangeEvent<HTMLInputElement>, value: boolean) => {
    const updatedParameters = [...parameters]
    const parameter = updatedParameters.find((p) => p.name === "budget_tokens" && p.isSpecific)
    if (parameter) {
      parameter.isTokenBudget = value
    } else {
      updatedParameters.push({
        name: "budget_tokens",
        type: "int",
        value: Number(e.target.value),
        isSpecific: true,
        isTokenBudget: value,
      })
    }
    setParameters(updatedParameters)
  }

  const handleTokenBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedParameters = [...parameters]
    const parameter = updatedParameters.find((p) => p.name === "budget_tokens" && p.isSpecific)
    if(isTokenBudgetEnabled){
      if (parameter) {
        parameter.value = Number(e.target.value)
      } else {
        updatedParameters.push({
          name: "budget_tokens",
          type: "int",
          value: Number(e.target.value),
          isSpecific: true,
          isTokenBudget: false,
        })
      }
      setParameters(updatedParameters)
    }
  }

  return (
    <div className="special-parameter start">
      <div className="content">
        <div className="title">
          <label>Token Budget</label>
          <div className="description">{t("models.tokenBudgetDescription", { min, max })}</div>
        </div>
        <div className="body token-budget-body">
          <div className="token-budget-switch">
            <Switch
              size="medium"
              checked={isTokenBudgetEnabled}
              onChange={(e) => {
                enableTokenBudgetChange(e, !isTokenBudgetEnabled)
              }}
            />
          </div>
          <div className="token-budget-input">
            <div className="token-budget-value align-top">
              <WrappedInput
                type="number"
                value={tokenBudget}
                onChange={(e) => handleTokenBudgetChange(e)}
                disabled={!isTokenBudgetEnabled}
              />
            </div>
            <div className="token-budget-slider">
              <input
                type="range"
                min={min}
                max={max}
                step="1"
                value={tokenBudget}
                onChange={(e) => handleTokenBudgetChange(e)}
                className="slider"
              />
              <div className="range-values">
                <span>{min}</span>
                <span>{max}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TokenBudgetParameter
