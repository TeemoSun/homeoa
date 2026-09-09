import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Button,
  Card,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  Select,
  SelectIndicator,
  SelectValue,
  Table,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import { api, errMsg } from '../api/client'
import type { RequestType, User } from '../api/types'
import ConfirmButton from '../components/ConfirmButton'
import { CheckOption, ToggleSwitch } from '../components/FieldControls'
import { compose, pattern, required } from '../utils/validators'

type Editing = RequestType | 'new' | null

function ApproverSelect({
  users,
  value,
  onChange,
}: {
  users: User[]
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <Select.Root
      aria-label="默认审批人"
      selectedKey={value === null ? '0' : String(value)}
      onSelectionChange={(key) => {
        const str = String(key)
        onChange(str === '0' || key === null ? null : Number(str))
      }}
      className="max-w-xs"
    >
      <Select.Trigger>
        <SelectValue>
          {(v) =>
            v.isPlaceholder ? (
              <span className="opacity-50">全部管理员（默认）</span>
            ) : (
              v.selectedText
            )
          }
        </SelectValue>
        <SelectIndicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label="默认审批人">
          <ListBoxItem id="0" textValue="全部管理员">
            全部管理员（默认）
          </ListBoxItem>
          {users.map((u) => (
            <ListBoxItem key={u.id} id={String(u.id)} textValue={u.display_name}>
              {u.display_name}（{u.role === 'admin' ? '管理员' : '成员'}）
            </ListBoxItem>
          ))}
        </ListBox>
      </Select.Popover>
    </Select.Root>
  )
}

function TypeForm({
  initial,
  users,
  schemaText,
  onSchemaTextChange,
  submitting,
  onSubmit,
}: {
  initial: { code: string; name: string; icon: string; approver_id: number | null; enabled: boolean }
  users: User[]
  schemaText: string
  onSchemaTextChange: (v: string) => void
  submitting: boolean
  onSubmit: (values: Record<string, unknown>) => void
}) {
  const [code, setCode] = useState(initial.code)
  const [name, setName] = useState(initial.name)
  const [icon, setIcon] = useState(initial.icon)
  const [approverId, setApproverId] = useState<number | null>(initial.approver_id)
  const [enabled, setEnabled] = useState(initial.enabled)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit({
      code: code.trim(),
      name: name.trim(),
      icon: icon.trim(),
      approver_id: approverId,
      enabled,
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField
        value={code}
        onChange={setCode}
        isRequired
        validate={compose(
          required('请输入类型编码'),
          pattern(/^[a-z0-9_-]{2,32}$/, '小写字母、数字、中划线、下划线，2-32 位'),
        )}
        className="flex flex-col gap-1.5"
      >
        <Label>类型编码</Label>
        <Input type="text" placeholder="如 purchase、repair" autoComplete="off" />
        <FieldError />
      </TextField>
      <TextField
        value={name}
        onChange={setName}
        isRequired
        validate={required('请输入类型名称')}
        className="flex flex-col gap-1.5"
      >
        <Label>类型名称</Label>
        <Input type="text" />
        <FieldError />
      </TextField>
      <TextField value={icon} onChange={setIcon} className="flex flex-col gap-1.5">
        <Label>图标（选填）</Label>
        <Input type="text" placeholder="如 shopping-cart" autoComplete="off" />
        <FieldError />
      </TextField>
      <div className="flex flex-col gap-1.5">
        <Label>默认审批人（留空 = 全部管理员）</Label>
        <ApproverSelect users={users} value={approverId} onChange={setApproverId} />
      </div>
      <CheckOption isSelected={enabled} onChange={setEnabled}>
        启用该类型
      </CheckOption>
      <Chip color="accent" variant="soft" size="sm">
        表单 Schema（JSON）：name/label/type(text|textarea|number|date)/required；name 为 amount
        的数值字段会作为金额统计
      </Chip>
      <TextField
        aria-label="表单 Schema JSON"
        value={schemaText}
        onChange={onSchemaTextChange}
        className="flex flex-col gap-1.5"
      >
        <TextArea className="min-h-56 font-mono text-[13px]" />
      </TextField>
      <Button type="submit" isPending={submitting} fullWidth>
        保存
      </Button>
    </form>
  )
}

export default function RequestTypes() {
  const [types, setTypes] = useState<RequestType[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [editing, setEditing] = useState<Editing>(null)
  const [schemaText, setSchemaText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [t, u] = await Promise.all([
        api.get<{ list: RequestType[] }>('/request-types'),
        api.get<{ list: User[] }>('/users'),
      ])
      setTypes(t.data.list)
      setUsers(u.data.list)
    } catch (e) {
      toast.danger(errMsg(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = (t: RequestType | 'new') => {
    setEditing(t)
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
      setSchemaText(JSON.stringify(t.form_schema, null, 2))
    }
  }

  const save = async (values: Record<string, unknown>) => {
    let schema: unknown
    try {
      schema = JSON.parse(schemaText)
    } catch {
      toast.danger('表单 Schema 不是合法 JSON')
      return
    }
    setSaving(true)
    const body = { ...values, form_schema: schema }
    try {
      if (editing === 'new') {
        await api.post('/request-types', body)
        toast.success('类型已创建')
      } else if (editing) {
        await api.put(`/request-types/${editing.id}`, body)
        toast.success('已保存')
      }
      setEditing(null)
      void load()
    } catch (e) {
      toast.danger(errMsg(e))
    } finally {
      setSaving(false)
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
      toast.danger(errMsg(e))
    }
  }

  const remove = async (t: RequestType) => {
    try {
      await api.delete(`/request-types/${t.id}`)
      toast.success('已删除')
      void load()
    } catch (e) {
      toast.danger(errMsg(e))
    }
  }

  const editingInitial =
    editing === null || editing === 'new'
      ? { code: '', name: '', icon: '', approver_id: null, enabled: true }
      : {
          code: editing.code,
          name: editing.name,
          icon: editing.icon,
          approver_id: editing.approver_id,
          enabled: editing.enabled,
        }

  return (
    <div className="page">
      <div className="flex items-center justify-between">
        <h2 className="page-title">类型管理</h2>
        <Button variant="primary" onPress={() => openEdit('new')}>
          新建类型
        </Button>
      </div>

      <Card className="glass overflow-hidden rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <Table.Root className="w-full">
            <Table.ScrollContainer>
              <Table.Content aria-label="请求类型列表">
                <Table.Header>
                  <Table.Column isRowHeader>编码</Table.Column>
                  <Table.Column id="name">名称</Table.Column>
                  <Table.Column id="icon">图标</Table.Column>
                  <Table.Column id="approver">审批人</Table.Column>
                  <Table.Column id="enabled">启用</Table.Column>
                  <Table.Column id="op">操作</Table.Column>
                </Table.Header>
                <Table.Body
                  items={types}
                  renderEmptyState={() => (
                    <div className="py-12 text-center text-sm text-black/40">暂无类型</div>
                  )}
                >
                  {(item: RequestType) => (
                    <Table.Row id={item.id}>
                      <Table.Cell>{item.code}</Table.Cell>
                      <Table.Cell>{item.name}</Table.Cell>
                      <Table.Cell>{item.icon || '-'}</Table.Cell>
                      <Table.Cell>{item.approver?.display_name ?? '全部管理员'}</Table.Cell>
                      <Table.Cell>
                        <ToggleSwitch
                          isSelected={item.enabled}
                          onChange={(checked) => void toggleEnabled(item, checked)}
                          ariaLabel={`启用：${item.name}`}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" onPress={() => openEdit(item)}>
                            编辑
                          </Button>
                          <ConfirmButton
                            label="删除"
                            title="确定删除该类型吗？"
                            confirmText="删除"
                            onConfirm={() => void remove(item)}
                          />
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table.Root>
        </div>
      </Card>

      <Modal.Root
        isOpen={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <Modal.Backdrop variant="blur" />
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{editing === 'new' ? '新建类型' : '编辑类型'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {editing && (
                <TypeForm
                  key={editing === 'new' ? 'new' : editing.id}
                  initial={editingInitial}
                  users={users}
                  schemaText={schemaText}
                  onSchemaTextChange={setSchemaText}
                  submitting={saving}
                  onSubmit={(values) => void save(values)}
                />
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Root>
    </div>
  )
}
