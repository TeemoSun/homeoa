import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Select, Spin, Toast } from '@douyinfe/semi-ui'
import { api, errMsg } from '../api/client'
import type { RequestType } from '../api/types'
import DynamicForm from '../components/DynamicForm'

export default function NewRequest() {
  const navigate = useNavigate()
  const [types, setTypes] = useState<RequestType[] | null>(null)
  const [typeId, setTypeId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get<{ list: RequestType[] }>('/request-types').then(
      ({ data }) => {
        const enabled = data.list.filter((t) => t.enabled)
        setTypes(enabled)
        // 只有一个启用类型时直接选中，跳过类型选择
        if (enabled.length === 1) setTypeId(enabled[0].id)
      },
      (e) => Toast.error(errMsg(e)),
    )
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
      Toast.success('提交成功，已通知审批人')
      navigate(`/requests/${data.id}`)
    } catch (e) {
      Toast.error(errMsg(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (types === null) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h2 className="page-title">发起请求</h2>
      <Card>
        {types.length === 0 ? (
          <p style={{ color: 'var(--semi-color-text-2)' }}>暂无可用的请求类型，请联系管理员在「类型管理」中开启。</p>
        ) : (
          <>
            {types.length > 1 && (
              <Select
                placeholder="选择请求类型"
                style={{ width: 280, marginBottom: 20 }}
                value={typeId ?? undefined}
                onChange={(v) => setTypeId(Number(v))}
                optionList={types.map((t) => ({ value: t.id, label: t.name }))}
              />
            )}
            {current ? (
              <DynamicForm
                fields={current.form_schema.fields}
                submitText="提交申请"
                submitting={submitting}
                onSubmit={handleSubmit}
              />
            ) : (
              <p style={{ color: 'var(--semi-color-text-2)' }}>请先选择请求类型。</p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
