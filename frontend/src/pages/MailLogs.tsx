import { useCallback, useEffect, useState } from 'react'
import { Table, Tag, Toast } from '@douyinfe/semi-ui'
import { api, errMsg, fmtTime } from '../api/client'
import type { MailLog, PageData } from '../api/types'

const STATUS_TAG: Record<MailLog['status'], { color: 'green' | 'red' | 'grey'; text: string }> = {
  sent: { color: 'green', text: '已发送' },
  failed: { color: 'red', text: '失败' },
  skipped: { color: 'grey', text: '跳过' },
}

export default function MailLogs() {
  const [data, setData] = useState<PageData<MailLog> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (targetPage: number) => {
    setLoading(true)
    try {
      const { data } = await api.get<PageData<MailLog>>('/mail-logs', {
        params: { page: targetPage, page_size: 20 },
      })
      setData(data)
      setPage(targetPage)
    } catch (e) {
      Toast.error(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(1)
  }, [load])

  return (
    <div className="page">
      <h2 className="page-title">邮件发送日志</h2>
      <Table
        loading={loading}
        empty="暂无邮件记录"
        dataSource={data?.list ?? []}
        rowKey="id"
        pagination={{
          currentPage: page,
          pageSize: 20,
          total: data?.total ?? 0,
          onPageChange: (p) => void load(p),
        }}
        columns={[
          {
            title: '收件人',
            dataIndex: 'to_email',
            width: 240,
          },
          { title: '主题', dataIndex: 'subject' },
          {
            title: '状态',
            dataIndex: 'status',
            width: 90,
            render: (v: MailLog['status']) => (
              <Tag color={STATUS_TAG[v].color}>{STATUS_TAG[v].text}</Tag>
            ),
          },
          {
            title: '说明',
            dataIndex: 'error',
            render: (v: string) => v || '-',
          },
          {
            title: '时间',
            dataIndex: 'created_at',
            width: 170,
            render: (v: string) => fmtTime(v),
          },
        ]}
      />
    </div>
  )
}
