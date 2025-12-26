/**
 * A2UI (Agent-to-User Interface) Type Definitions
 * 声明式 UI 规范类型定义
 */

export type FieldType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'section';

export interface A2UIField {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  default?: any;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  fields?: A2UIField[]; // For section/group
  min?: number;
  max?: number;
  step?: number;
  visibleWhen?: {
    field: string;  // 依赖的字段 id
    value: any;     // 当该字段等于此值时显示
  };
}

export interface A2UISubmitButton {
  label: string;
  confirmMessage?: string;
}

export interface A2UISchema {
  type: 'form';
  title: string;
  description?: string;
  fields: A2UIField[];
  submitButton?: A2UISubmitButton;
}

export interface A2UIResponse {
  schema: A2UISchema;
  tool_name: string;
  tool_params_mapping: Record<string, string>;
}

export interface A2UIFormData {
  [key: string]: any;
}

