import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  Button,
  FieldError,
  Input,
  Label,
  NumberField,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import type { FormField } from '../api/types'

export interface DynamicValues {
  [key: string]: unknown
}

type FieldValue = string | number

// DynamicForm 按类型的 form_schema 渲染表单，内部维护受控值
export default function DynamicForm({
  fields,
  initValues,
  submitText,
  submitting,
  onSubmit,
}: {
  fields: FormField[]
  initValues?: Record<string, unknown>
  submitText: string
  submitting: boolean
  onSubmit: (values: DynamicValues) => void
}) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    const initial: Record<string, FieldValue> = {}
    for (const f of fields) {
      const raw = initValues?.[f.name]
      if (raw !== undefined && raw !== null && raw !== '') {
        initial[f.name] = raw as FieldValue
      }
    }
    return initial
  })

  const set = (key: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    for (const f of fields) {
      if (f.required) {
        const v = values[f.name]
        if (v === undefined || v === null || String(v).trim() === '') {
          toast.warning(`请填写：${f.label}`)
          return
        }
      }
    }
    onSubmit({ ...values })
  }

  const requiredValidate = (f: FormField) => (v: unknown) => {
    if (!f.required) return undefined
    if (typeof v === 'number') return Number.isNaN(v) ? `请填写${f.label}` : undefined
    return v && String(v).trim() !== '' ? undefined : `请填写${f.label}`
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {fields.map((f) => {
        const value = values[f.name]
        const str = value === undefined || typeof value === 'number' ? '' : value
        if (f.type === 'textarea') {
          return (
            <TextField
              key={f.name}
              value={str}
              onChange={(v) => set(f.name, v)}
              isRequired={f.required}
              validate={requiredValidate(f)}
              className="flex flex-col gap-1.5"
            >
              <Label>{f.label}</Label>
              <TextArea placeholder={f.placeholder} className="min-h-20" maxLength={2000} />
              <FieldError />
            </TextField>
          )
        }
        if (f.type === 'number') {
          return (
            <NumberField
              key={f.name}
              minValue={0}
              formatOptions={{
                style: 'currency',
                currency: 'CNY',
                currencyDisplay: 'narrowSymbol',
                maximumFractionDigits: 2,
              }}
              value={typeof value === 'number' ? value : Number.NaN}
              onChange={(v) => set(f.name, Number.isNaN(v) ? '' : v)}
              isRequired={f.required}
              validate={requiredValidate(f)}
              className="flex max-w-80 flex-col gap-1.5"
            >
              <Label>{f.label}</Label>
              <NumberField.Group>
                <NumberField.Input placeholder={f.placeholder} />
              </NumberField.Group>
              <FieldError />
            </NumberField>
          )
        }
        if (f.type === 'date') {
          return (
            <TextField
              key={f.name}
              value={str}
              onChange={(v) => set(f.name, v)}
              isRequired={f.required}
              validate={requiredValidate(f)}
              className="flex max-w-80 flex-col gap-1.5"
            >
              <Label>{f.label}</Label>
              <Input type="date" placeholder={f.placeholder || '选择日期'} />
              <FieldError />
            </TextField>
          )
        }
        return (
          <TextField
            key={f.name}
            value={str}
            onChange={(v) => set(f.name, v)}
            isRequired={f.required}
            validate={requiredValidate(f)}
            className="flex flex-col gap-1.5"
          >
            <Label>{f.label}</Label>
            <Input type="text" placeholder={f.placeholder} maxLength={500} />
            <FieldError />
          </TextField>
        )
      })}
      <div className="pt-1">
        <Button type="submit" isPending={submitting}>
          {submitText}
        </Button>
      </div>
    </form>
  )
}
