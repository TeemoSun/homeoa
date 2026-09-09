import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Spinner, Table } from '@heroui/react'
import { api, fmtAmount, fmtTime } from '../api/client'
import type { DashboardStats, RequestItem } from '../api/types'
import StatusTag from '../components/StatusTag'
import { useAuth } from '../store/auth'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<DashboardStats>('/dashboard/stats')
      .then(({ data }) => setStats(data), () => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { title: '待我审批', value: stats?.todo_count ?? '-', color: '#f59e0b' },
    { title: '本月发起', value: stats?.month_submitted ?? '-', color: '#3b82f6' },
    { title: '本月金额', value: stats ? fmtAmount(stats.month_amount) : '-', color: '#10b981' },
    { title: '待审批中', value: stats?.status_count?.pending ?? '-', color: '#f59e0b' },
    { title: '已通过', value: stats?.status_count?.approved ?? '-', color: '#10b981' },
    { title: '已拒绝', value: stats?.status_count?.rejected ?? '-', color: '#ef4444' },
  ]

  const todoList = stats?.todo_list ?? []

  return (
    <div className="page">
      <h2 className="page-title">
        你好，{user?.display_name}
        {user?.role === 'admin' ? '（管理员）' : ''}
      </h2>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.title} className="glass min-w-0 rounded-2xl shadow-sm">
            <Card.Content className="min-w-0 overflow-hidden p-4">
              <div className="text-[13px] text-black/45">{c.title}</div>
              <div
                className="mt-1 text-[17px] leading-tight font-bold break-all sm:text-[22px] sm:break-normal"
                style={{ color: c.color }}
              >
                {loading ? <Spinner size="sm" /> : c.value}
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>

      <Card className="glass rounded-2xl shadow-sm">
        <Card.Header className="pb-0">
          <Card.Title>待办（等待我审批）</Card.Title>
        </Card.Header>
        <Card.Content className="overflow-x-auto px-0 pb-2">
          <Table.Root className="w-full">
            <Table.ScrollContainer className="px-2">
              <Table.Content
                aria-label="待办列表"
                onRowAction={(key) => navigate(`/requests/${String(key)}`)}
              >
                <Table.Header>
                  <Table.Column isRowHeader id="title">
                    标题
                  </Table.Column>
                  <Table.Column id="type">类型</Table.Column>
                  <Table.Column id="amount">金额</Table.Column>
                  <Table.Column id="submitter">发起人</Table.Column>
                  <Table.Column id="created_at">提交时间</Table.Column>
                  <Table.Column id="status">状态</Table.Column>
                </Table.Header>
                <Table.Body
                  items={todoList}
                  renderEmptyState={() =>
                    loading ? (
                      <div className="flex justify-center py-6">
                        <Spinner size="md" />
                      </div>
                    ) : (
                      <EmptyTodo />
                    )
                  }
                >
                  {(item: RequestItem) => (
                    <Table.Row id={item.id} className="cursor-pointer">
                      <Table.Cell>{item.title}</Table.Cell>
                      <Table.Cell>{item.type?.name ?? '-'}</Table.Cell>
                      <Table.Cell>{fmtAmount(item.amount)}</Table.Cell>
                      <Table.Cell>{item.submitter?.display_name ?? '-'}</Table.Cell>
                      <Table.Cell>{fmtTime(item.created_at)}</Table.Cell>
                      <Table.Cell>
                        <StatusTag status={item.status} />
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table.Root>
        </Card.Content>
      </Card>

      <p className="mt-4 text-[13px] text-black/45">
        提示：在「发起请求」提交预算申请，审批人将收到邮件通知；审批结果会邮件回复给提交人。
      </p>
    </div>
  )
}

function EmptyTodo() {
  return <div className="py-12 text-center text-sm text-black/40">暂无待办 🎉</div>
}
