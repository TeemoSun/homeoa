import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, ListBox, ListBoxItem, Select, SelectIndicator, SelectValue, Spinner, toast } from '@heroui/react'
import { api, errMsg } from '../api/client'
import type { RequestType } from '../api/types'
import DynamicForm from '../components/DynamicForm'

export default function NewRequest() {
  const navigate = useNavigate()
  const [types, setTypes] = useState<RequestType[] | null>(null)
  const [typeId, setTypeId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api
      .get<{ list: RequestType[] }>('/request-types')
      .then(({ data }) => {
        const enabled = data.list.filter((t) => t.enabled)
        setTypes(enabled)
        // 只有一个启用类型时直接选中，跳过类型选择
        if (enabled.length === 1) setTypeId(enabled[0].id)
      })
      .catch((e) => toast.danger(errMsg(e)))
  }, [])

  const current = useMemo(() => types?.find((t) => t.id === typeId) ?? null, [types, typeId])

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!current) return
    setSubmitting(true)
    try {
      const { data } = await api.post<{ id: number }>('/requests', {
        type_id: current.id,
        form_data: values,
      })
      toast.success('提交成功，已通知审批人')
      navigate(`/requests/${data.id}`)
    } catch (e) {
      toast.danger(errMsg(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page max-w-[720px]">
      <h2 className="page-title">发起请求</h2>
      {types === null ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card className="glass rounded-2xl shadow-sm">
          <Card.Content className="p-6">
            {types.length === 0 ? (
              <p className="text-sm text-black/50">
                暂无可用的请求类型，请联系管理员在「类型管理」中开启。
              </p>
            ) : (
              <>
                {types.length > 1 && (
                  <Select.Root
                    aria-label="选择请求类型"
                    selectedKey={typeId}
                    onSelectionChange={(key) => setTypeId(key === null ? null : Number(key))}
                    className="mb-5 max-w-xs"
                  >
                    <Select.Trigger>
                      <SelectValue>
                        {(v) =>
                          v.isPlaceholder ? (
                            <span className="opacity-50">选择请求类型</span>
                          ) : (
                            v.selectedText
                          )
                        }
                      </SelectValue>
                      <SelectIndicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox aria-label="请求类型">
                        {types.map((t) => (
                          <ListBoxItem key={t.id} id={t.id} textValue={t.name}>
                            {t.name}
                          </ListBoxItem>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select.Root>
                )}
                {current ? (
                  <DynamicForm
                    key={current.id}
                    fields={current.form_schema.fields}
                    submitText="提交申请"
                    submitting={submitting}
                    onSubmit={handleSubmit}
                  />
                ) : (
                  <p className="text-sm text-black/50">请先选择请求类型。</p>
                )}
              </>
            )}
          </Card.Content>
        </Card>
      )}
    </div>
  )
}
