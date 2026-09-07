import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Modal, Popconfirm, Switch, Table, Tag, Toast } from '@douyinfe/semi-ui'
import { api, errMsg, fmtDate } from '../api/client'
import type { User } from '../api/types'
import { useAuth } from '../store/auth'

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<{ list: User[] }>('/users')
      setUsers(data.list)
    } catch (e) {
      Toast.error(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (values: Record<string, unknown>) => {
    try {
      if (editing === 'new') {
        await api.post('/users', values)
        Toast.success('成员已创建')
      } else if (editing) {
        await api.put(`/users/${editing.id}`, values)
        Toast.success('已保存')
      }
      setEditing(null)
      void load()
    } catch (e) {
      Toast.error(errMsg(e))
    }
  }

  const resetPassword = async (values: { password: string }) => {
    if (!resetting) return
    try {
      await api.put(`/users/${resetting.id}`, { password: values.password })
      Toast.success(`已重置 ${resetting.display_name} 的密码`)
      setResetting(null)
    } catch (e) {
      Toast.error(errMsg(e))
    }
  }

  const remove = async (u: User) => {
    try {
      await api.delete(`/users/${u.id}`)
      Toast.success('已删除')
      void load()
    } catch (e) {
      Toast.error(errMsg(e))
    }
  }

  const toggleMail = async (u: User, enabled: boolean) => {
    try {
      await api.put(`/users/${u.id}`, { mail_enabled: enabled })
      void load()
    } catch (e) {
      Toast.error(errMsg(e))
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">成员管理</h2>
        <Button type="primary" theme="solid" onClick={() => setEditing('new')}>
          新建成员
        </Button>
      </div>
      <Table
        loading={loading}
        dataSource={users}
        rowKey="id"
        pagination={false}
        scroll={{ x: 750 }}
        columns={[
          { title: '用户名', dataIndex: 'username' },
          { title: '姓名', dataIndex: 'display_name' },
          { title: '邮箱', dataIndex: 'email', render: (v: string) => v || '-' },
          {
            title: '角色',
            dataIndex: 'role',
            width: 100,
            render: (v: User['role']) =>
              v === 'admin' ? <Tag color="red">管理员</Tag> : <Tag color="blue">成员</Tag>,
          },
          {
            title: '邮件通知',
            dataIndex: 'mail_enabled',
            width: 110,
            render: (v: boolean, r: User) => (
              <Switch checked={v} onChange={(checked) => void toggleMail(r, checked)} size="small" />
            ),
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            width: 120,
            render: (v: string) => fmtDate(v),
          },
          {
            title: '操作',
            dataIndex: 'op',
            width: 220,
            render: (_: unknown, r: User) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Button size="small" style={{ marginRight: 8 }} onClick={() => setEditing(r)}>
                  编辑
                </Button>
                <Button size="small" style={{ marginRight: 8 }} onClick={() => setResetting(r)}>
                  重置密码
                </Button>
                {r.id !== me?.id && (
                  <Popconfirm title={`确定删除 ${r.display_name} 吗？`} onConfirm={() => void remove(r)}>
                    <Button size="small" type="danger">
                      删除
                    </Button>
                  </Popconfirm>
                )}
              </span>
            ),
          },
        ]}
      />

      <Modal
        title={editing === 'new' ? '新建成员' : editing ? `编辑 ${editing.display_name}` : ''}
        visible={editing !== null}
        onCancel={() => setEditing(null)}
        footer={null}
        width={480}
      >
        {editing !== null && (
          <Form
            key={editing === 'new' ? 'new' : editing.id}
            initValues={
              editing === 'new'
                ? { role: 'member' }
                : {
                    display_name: editing.display_name,
                    email: editing.email,
                    role: editing.role,
                    mail_enabled: editing.mail_enabled,
                  }
            }
            onSubmit={(values) => void save(values as Record<string, unknown>)}
            labelPosition="top"
          >
            {editing === 'new' && (
              <Form.Input
                field="username"
                label="用户名（登录用）"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { pattern: /^[a-zA-Z0-9_]{2,32}$/, message: '字母、数字、下划线，2-32 位' },
                ]}
              />
            )}
            {editing === 'new' && (
              <Form.Input
                field="password"
                label="初始密码"
                mode="password"
                rules={[
                  { required: true, message: '请输入初始密码' },
                  { min: 8, message: '至少 8 位' },
                ]}
              />
            )}
            <Form.Input
              field="display_name"
              label="姓名"
              rules={[{ required: true, message: '请输入姓名' }]}
            />
            <Form.Input
              field="email"
              label="邮箱（接收通知）"
              rules={[{ type: 'email', message: '邮箱格式不正确' }]}
              showClear
            />
            <Form.Select field="role" label="角色" style={{ width: 200 }}>
              <Form.Select.Option value="member">成员</Form.Select.Option>
              <Form.Select.Option value="admin">管理员</Form.Select.Option>
            </Form.Select>
            {editing !== 'new' && (
              <Form.Checkbox field="mail_enabled" noLabel>
                接收邮件通知
              </Form.Checkbox>
            )}
            <Button htmlType="submit" type="primary" theme="solid" block style={{ marginTop: 8 }}>
              保存
            </Button>
          </Form>
        )}
      </Modal>

      <Modal
        title={resetting ? `重置 ${resetting.display_name} 的密码` : ''}
        visible={resetting !== null}
        onCancel={() => setResetting(null)}
        footer={null}
        width={420}
      >
        <Form onSubmit={(values) => void resetPassword(values as { password: string })} labelPosition="top">
          <Form.Input
            field="password"
            label="新密码"
            mode="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '至少 8 位' },
            ]}
          />
          <Button htmlType="submit" type="primary" theme="solid" block style={{ marginTop: 8 }}>
            重置
          </Button>
        </Form>
      </Modal>
    </div>
  )
}
