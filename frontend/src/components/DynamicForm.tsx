import { Button, Form } from '@douyinfe/semi-ui'
import type { FormField } from '../api/types'

export interface DynamicValues {
  [key: string]: unknown
}

// DynamicForm 按类型的 form_schema 渲染表单。values 为受控初始值。
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
  return (
    <Form<DynamicValues>
      initValues={initValues}
      onSubmit={(values) => onSubmit(values ?? {})}
      labelPosition="top"
    >
      {fields.map((f) => {
        const rules = f.required ? [{ required: true, message: `请填写${f.label}` }] : undefined
        if (f.type === 'textarea') {
          return (
            <Form.TextArea
              key={f.name}
              field={f.name}
              label={f.label}
              placeholder={f.placeholder}
              rules={rules}
              autosize={{ minRows: 2, maxRows: 6 }}
              showClear
            />
          )
        }
        if (f.type === 'number') {
          return (
            <Form.InputNumber
              key={f.name}
              field={f.name}
              label={f.label}
              placeholder={f.placeholder}
              rules={rules}
              min={0}
              precision={2}
              style={{ width: '100%', maxWidth: 320 }}
              prefix="¥"
            />
          )
        }
        if (f.type === 'date') {
          return (
            <Form.DatePicker
              key={f.name}
              field={f.name}
              label={f.label}
              placeholder={f.placeholder || '选择日期'}
              rules={rules}
              type="date"
              format="yyyy-MM-dd"
              density="compact"
              style={{ width: '100%', maxWidth: 320 }}
            />
          )
        }
        return (
          <Form.Input
            key={f.name}
            field={f.name}
            label={f.label}
            placeholder={f.placeholder}
            rules={rules}
            showClear
            maxLength={500}
          />
        )
      })}
      <Button htmlType="submit" type="primary" theme="solid" loading={submitting}>
        {submitText}
      </Button>
    </Form>
  )
}
