import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Form,
  Modal,
  Popconfirm,
  Switch,
  Table,
  Tag,
  TextArea,
  Toast,
} from '@douyinfe/semi-ui'
import { api, errMsg } from '../api/client'
import type { RequestType, User } from '../api/types'

interface EditingType {
  type: RequestType | 'new'
}

export default function RequestTypes() {
  const [types, setTypes] = useState<RequestType[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [editing, setEditing] = useState<EditingType | null>(null)
  const [schemaText, setSchemaText] = useState('')

  const load = useCallback(async () => {
    try {
      const [t, u] = await Promise.all([
        api.get<{ list: RequestType[] }>('/request-types'),
        api.get<{ list: User[] }>('/users'),
      ])
      setTypes(t.data.list)
      setUsers(u.data.list)
    } catch (e) {
      Toast.error(errMsg(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = (t: RequestType | 'new') => {
    setEditing({ type: t })
    if (t === 'new') {
      setSchemaText(
        JSON.stringify(
          {
            fields: [
              { name: 'item_name', label: '物品名称', type: 'text', required: true },
              { name: 'amount', label: '预估金额（元）', type: 'number', required: true },
              { name: 'reason', label: '理由', type: 'textarea', required: true },
            ],
          },
          null,
          2,
        ),
      )
    } else {
      setSchemaText(JSON.stringify(JSON.parse(JSON.stringify(t.form_schema)), null, 2))
    }
  }

  const save = async (values: Record<string, unknown>) => {
    let schema: unknown
    try {
      schema = JSON.parse(schemaText)
    } catch {
      Toast.error('表单 Schema 不是合法 JSON')
      return
    }
    const body = { ...values, form_schema: schema }
    try {
      if (editing?.type === 'new') {
        await api.post('/request-types', body)
        Toast.success('类型已创建')
      } else if (editing) {
        await api.put(`/request-types/${editing.type.id}`, body)
        Toast.success('已保存')
      }
      setEditing(null)
      void load()
    } catch (e) {
      Toast.error(errMsg(e))
    }
  }

  const toggleEnabled = async (t: RequestType, enabled: boolean) => {
    try {
      await api.put(`/request-types/${t.id}`, {
        code: t.code,
        name: t.name,
        icon: t.icon,
        form_schema: t.form_schema,
        approver_id: t.approver_id,
        enabled,
      })
      void load()
    } catch (e) {
      Toast.error(errMsg(e))
    }
  }

  const remove = async (t: RequestType) => {
    try {
      await api.delete(`/request-types/${t.id}`)
      Toast.success('已删除')
      void load()
    } catch (e) {
      Toast.error(errMsg(e))
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">类型管理</h2>
        <Button type="primary" theme="solid" onClick={() => openEdit('new')}>
          新建类型
        </Button>
      </div>
      <Table
        dataSource={types}
        rowKey="id"
        pagination={false}
        columns={[
          { title: '编码', dataIndex: 'code', width: 120 },
          { title: '名称', dataIndex: 'name' },
          { title: '图标', dataIndex: 'icon', width: 160, render: (v: string) => v || '-' },
          {
            title: '审批人',
            dataIndex: 'approver',
            width: 140,
            render: (v: { display_name: string } | undefined) => v?.display_name ?? '全部管理员',
          },
          {
            title: '启用',
            dataIndex: 'enabled',
            width: 90,
            render: (v: boolean, r: RequestType) => (
              <Switch checked={v} size="small" onChange={(checked) => void toggleEnabled(r, checked)} />
            ),
          },
          {
            title: '操作',
            dataIndex: 'op',
            width: 160,
            render: (_: unknown, r: RequestType) => (
              <>
                <Button size="small" style={{ marginRight: 8 }} onClick={() => openEdit(r)}>
                  编辑
                </Button>
                <Popconfirm title="确定删除该类型吗？" onConfirm={() => void remove(r)}>
                  <Button size="small" type="danger">
                    删除
                  </Button>
                </Popconfirm>
              </>
            ),
          },
        ]}
      />

      <Modal
        title={editing?.type === 'new' ? '新建类型' : '编辑类型'}
        visible={editing !== null}
        onCancel={() => setEditing(null)}
        footer={null}
        width={640}
      >
        {editing && (
          <Form
            key={editing.type === 'new' ? 'new' : editing.type.id}
            initValues={
              editing.type === 'new'
                ? { enabled: true }
                : {
                    code: editing.type.code,
                    name: editing.type.name,
                    icon: editing.type.icon,
                    approver_id: editing.type.approver_id ?? undefined,
                    enabled: editing.type.enabled,
                  }
            }
            onSubmit={(values) => void save(values as Record<string, unknown>)}
            labelPosition="top"
          >
            <Form.Input
              field="code"
              label="类型编码"
              placeholder="如 purchase、repair"
              rules={[
                { required: true, message: '请输入类型编码' },
                { pattern: /^[a-z0-9_-]{2,32}$/, message: '小写字母、数字、中划线、下划线，2-32 位' },
              ]}
            />
            <Form.Input
              field="name"
              label="类型名称"
              rules={[{ required: true, message: '请输入类型名称' }]}
            />
            <Form.Input field="icon" label="图标（Semi 图标名，选填）" placeholder="IconHistogram" />
            <Form.Select
              field="approver_id"
              label="默认审批人（留空 = 全部管理员）"
              style={{ width: 300 }}
              showClear
              optionList={users.map((u) => ({
                value: u.id,
                label: `${u.display_name}（${u.role === 'admin' ? '管理员' : '成员'}）`,
              }))}
            />
            <Form.Checkbox field="enabled">启用该类型</Form.Checkbox>
            <div style={{ marginBottom: 4 }}>
              <Tag type="light" color="blue">
                表单 Schema（JSON）：字段 name/label/type(text|textarea|number|date)/required；name 为
                amount 的数值字段会作为金额统计
              </Tag>
            </div>
            <TextArea
              value={schemaText}
              onChange={setSchemaText}
              autosize={{ minRows: 8, maxRows: 18 }}
              style={{ fontFamily: 'monospace', marginBottom: 12 }}
            />
            <Button htmlType="submit" type="primary" theme="solid" block>
              保存
            </Button>
          </Form>
        )}
      </Modal>
    </div>
  )
}
