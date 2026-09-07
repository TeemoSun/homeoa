import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Button,
  Card,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  Select,
  SelectIndicator,
  SelectValue,
  Chip,
  Spinner,
  Table,
  TextField,
  toast,
} from '@heroui/react'
import { api, errMsg, fmtDate } from '../api/client'
import type { User } from '../api/types'
import { useAuth } from '../store/auth'
import ConfirmButton from '../components/ConfirmButton'
import { CheckOption, ToggleSwitch } from '../components/FieldControls'
import { compose, minLength, optionalEmail, pattern, required } from '../utils/validators'

type Editing = User | 'new' | null

function RoleSelect({ value, onChange }: { value: User['role']; onChange: (v: User['role']) => void }) {
  return (
    <Select.Root
      aria-label="角色"
      selectedKey={value}
      onSelectionChange={(key) => onChange((key as User['role'] | null) ?? 'member')}
      className="max-w-52"
    >
      <Select.Trigger>
        <SelectValue>
          {(v) => (v.isPlaceholder ? <span className="opacity-50">成员</span> : v.selectedText)}
        </SelectValue>
        <SelectIndicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label="角色">
          <ListBoxItem id="member" textValue="成员">
            成员
          </ListBoxItem>
          <ListBoxItem id="admin" textValue="管理员">
            管理员
          </ListBoxItem>
        </ListBox>
      </Select.Popover>
    </Select.Root>
  )
}

function UserForm({
  initial,
  isNew,
  submitting,
  onSubmit,
}: {
  initial: User | null
  isNew: boolean
  submitting: boolean
  onSubmit: (values: Record<string, unknown>) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [role, setRole] = useState<User['role']>(initial?.role ?? 'member')
  const [mailEnabled, setMailEnabled] = useState(initial?.mail_enabled ?? true)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const values: Record<string, unknown> = {
      display_name: displayName.trim(),
      email: email.trim(),
      role,
    }
    if (isNew) {
      values.username = username.trim()
      values.password = password
    } else {
      values.mail_enabled = mailEnabled
    }
    onSubmit(values)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {isNew && (
        <>
          <TextField
            value={username}
            onChange={setUsername}
            isRequired
            validate={compose(
              required('请输入用户名'),
              pattern(/^[a-zA-Z0-9_]{2,32}$/, '字母、数字、下划线，2-32 位'),
            )}
            className="flex flex-col gap-1.5"
          >
            <Label>用户名（登录用）</Label>
            <Input type="text" autoComplete="off" />
            <FieldError />
          </TextField>
          <TextField
            value={password}
            onChange={setPassword}
            isRequired
            validate={compose(required('请输入初始密码'), minLength(8, '至少 8 位'))}
            className="flex flex-col gap-1.5"
          >
            <Label>初始密码</Label>
            <Input type="password" autoComplete="new-password" />
            <FieldError />
          </TextField>
        </>
      )}
      <TextField
        value={displayName}
        onChange={setDisplayName}
        isRequired
        validate={required('请输入姓名')}
        className="flex flex-col gap-1.5"
      >
        <Label>姓名</Label>
        <Input type="text" />
        <FieldError />
      </TextField>
      <TextField
        value={email}
        onChange={setEmail}
        validate={optionalEmail()}
        className="flex flex-col gap-1.5"
      >
        <Label>邮箱（接收通知）</Label>
        <Input type="email" />
        <FieldError />
      </TextField>
      <div className="flex flex-col gap-1.5">
        <Label>角色</Label>
        <RoleSelect value={role} onChange={setRole} />
      </div>
      {!isNew && (
        <CheckOption isSelected={mailEnabled} onChange={setMailEnabled}>
          接收邮件通知
        </CheckOption>
      )}
      <Button type="submit" isPending={submitting} fullWidth className="mt-1">
        保存
      </Button>
    </form>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)
  const [resetting, setResetting] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<{ list: User[] }>('/users')
      setUsers(data.list)
    } catch (e) {
      toast.danger(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing === 'new') {
        await api.post('/users', values)
        toast.success('成员已创建')
      } else if (editing) {
        await api.put(`/users/${editing.id}`, values)
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

  const resetPassword = async () => {
    if (!resetting) return
    setSaving(true)
    try {
      await api.put(`/users/${resetting.id}`, { password: newPassword })
      toast.success(`已重置 ${resetting.display_name} 的密码`)
      setResetting(null)
      setNewPassword('')
    } catch (e) {
      toast.danger(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (u: User) => {
    try {
      await api.delete(`/users/${u.id}`)
      toast.success('已删除')
      void load()
    } catch (e) {
      toast.danger(errMsg(e))
    }
  }

  const toggleMail = async (u: User, enabled: boolean) => {
    try {
      await api.put(`/users/${u.id}`, { mail_enabled: enabled })
      void load()
    } catch (e) {
      toast.danger(errMsg(e))
    }
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between">
        <h2 className="page-title">成员管理</h2>
        <Button variant="primary" onPress={() => setEditing('new')}>
          新建成员
        </Button>
      </div>

      <Card className="glass overflow-hidden rounded-2xl shadow-sm">
        {loading && users.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table.Root className="w-full">
              <Table.ScrollContainer>
                <Table.Content aria-label="成员列表">
                  <Table.Header>
                    <Table.Column isRowHeader>用户名</Table.Column>
                    <Table.Column id="display_name">姓名</Table.Column>
                    <Table.Column id="email">邮箱</Table.Column>
                    <Table.Column id="role">角色</Table.Column>
                    <Table.Column id="mail">邮件通知</Table.Column>
                    <Table.Column id="created_at">创建时间</Table.Column>
                    <Table.Column id="op">操作</Table.Column>
                  </Table.Header>
                  <Table.Body
                    items={users}
                    renderEmptyState={() => (
                      <div className="py-12 text-center text-sm text-black/40">暂无成员</div>
                    )}
                  >
                    {(item: User) => (
                      <Table.Row id={item.id}>
                        <Table.Cell>{item.username}</Table.Cell>
                        <Table.Cell>{item.display_name}</Table.Cell>
                        <Table.Cell>{item.email || '-'}</Table.Cell>
                        <Table.Cell>
                          {item.role === 'admin' ? (
                            <Chip color="danger" variant="soft" size="sm">
                              管理员
                            </Chip>
                          ) : (
                            <Chip color="accent" variant="soft" size="sm">
                              成员
                            </Chip>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <ToggleSwitch
                            isSelected={item.mail_enabled}
                            onChange={(checked) => void toggleMail(item, checked)}
                            ariaLabel={`邮件通知：${item.display_name}`}
                          />
                        </Table.Cell>
                        <Table.Cell>{fmtDate(item.created_at)}</Table.Cell>
                        <Table.Cell>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" onPress={() => setEditing(item)}>
                              编辑
                            </Button>
                            <Button size="sm" variant="outline" onPress={() => setResetting(item)}>
                              重置密码
                            </Button>
                            {item.id !== me?.id && (
                              <ConfirmButton
                                label="删除"
                                title={`确定删除 ${item.display_name} 吗？`}
                                confirmText="删除"
                                onConfirm={() => void remove(item)}
                              />
                            )}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table.Root>
          </div>
        )}
      </Card>

      {/* 新建 / 编辑成员弹窗 */}
      <Modal.Root
        isOpen={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <Modal.Backdrop variant="blur" />
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                {editing === 'new' ? '新建成员' : editing ? `编辑 ${editing.display_name}` : ''}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {editing !== null && (
                <UserForm
                  key={editing === 'new' ? 'new' : editing.id}
                  initial={editing === 'new' ? null : editing}
                  isNew={editing === 'new'}
                  submitting={saving}
                  onSubmit={(values) => void save(values)}
                />
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Root>

      {/* 重置密码弹窗 */}
      <Modal.Root
        isOpen={resetting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetting(null)
            setNewPassword('')
          }
        }}
      >
        <Modal.Backdrop variant="blur" />
        <Modal.Container size="xs">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{resetting ? `重置 ${resetting.display_name} 的密码` : ''}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void resetPassword()
                }}
                className="flex flex-col gap-4"
              >
                <TextField
                  value={newPassword}
                  onChange={setNewPassword}
                  isRequired
                  validate={compose(required('请输入新密码'), minLength(8, '至少 8 位'))}
                  className="flex flex-col gap-1.5"
                >
                  <Label>新密码</Label>
                  <Input type="password" autoComplete="new-password" />
                  <FieldError />
                </TextField>
                <Button type="submit" isPending={saving} fullWidth>
                  重置
                </Button>
              </form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Root>
    </div>
  )
}
