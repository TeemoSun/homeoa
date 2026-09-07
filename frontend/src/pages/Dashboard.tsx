import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Col, Row, Table, Typography } from '@douyinfe/semi-ui'
import { api, fmtAmount, fmtTime } from '../api/client'
import type { DashboardStats } from '../api/types'
import StatusTag from '../components/StatusTag'
import { useAuth } from '../store/auth'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    api.get<DashboardStats>('/dashboard/stats').then(
      ({ data }) => setStats(data),
      () => setStats(null),
    )
  }, [])

  const cards = [
    { title: '待我审批', value: stats?.todo_count ?? '-', color: '#f59e0b' },
    { title: '本月发起', value: stats?.month_submitted ?? '-', color: '#1677ff' },
    { title: '本月金额', value: stats ? fmtAmount(stats.month_amount) : '-', color: '#10b981' },
    { title: '待审批中', value: stats?.status_count?.pending ?? '-', color: '#f59e0b' },
    { title: '已通过', value: stats?.status_count?.approved ?? '-', color: '#10b981' },
    { title: '已拒绝', value: stats?.status_count?.rejected ?? '-', color: '#ef4444' },
  ]

  return (
    <div className="page">
      <h2 className="page-title">
        你好，{user?.display_name}
        {user?.role === 'admin' ? '（管理员）' : ''}
      </h2>
      <Row gutter={[12, 12]}>
        {cards.map((c) => (
          <Col xs={12} sm={8} md={4} key={c.title} style={{ marginBottom: 12 }}>
            <Card bodyStyle={{ padding: '12px 16px' }}>
              <div style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}>{c.title}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="待办（等待我审批）" bodyStyle={{ padding: 0 }}>
        <Table
          empty="暂无待办"
          dataSource={stats?.todo_list ?? []}
          rowKey="id"
          pagination={false}
          scroll={{ x: 600 }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => navigate(`/requests/${(record as { id: number }).id}`),
          })}
          columns={[
            { title: '标题', dataIndex: 'title' },
            {
              title: '类型',
              dataIndex: 'type',
              render: (v: { name: string } | undefined) => v?.name ?? '-',
            },
            {
              title: '金额',
              dataIndex: 'amount',
              render: (v: number | null) => fmtAmount(v),
            },
            {
              title: '发起人',
              dataIndex: 'submitter',
              render: (v: { display_name: string } | undefined) => v?.display_name ?? '-',
            },
            {
              title: '提交时间',
              dataIndex: 'created_at',
              render: (v: string) => fmtTime(v),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: DashboardStats['todo_list'][number]['status']) => <StatusTag status={v} />,
            },
          ]}
        />
      </Card>
      <Typography.Paragraph type="tertiary" style={{ marginTop: 16 }}>
        提示：在「发起请求」提交预算申请，审批人将收到邮件通知；审批结果会邮件回复给提交人。
      </Typography.Paragraph>
    </div>
  )
}
