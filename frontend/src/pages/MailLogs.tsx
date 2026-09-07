import { useCallback, useEffect, useState } from 'react'
import { Card, Chip, Table, toast } from '@heroui/react'
import { api, errMsg, fmtTime } from '../api/client'
import type { MailLog, PageData } from '../api/types'
import TablePager from '../components/TablePager'

const STATUS_CHIP: Record<MailLog['status'], { color: 'success' | 'danger' | 'default'; text: string }> = {
  sent: { color: 'success', text: '已发送' },
  failed: { color: 'danger', text: '失败' },
  skipped: { color: 'default', text: '跳过' },
}

const PAGE_SIZE = 20

export default function MailLogs() {
  const [data, setData] = useState<PageData<MailLog> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (targetPage: number) => {
    setLoading(true)
    try {
      const { data } = await api.get<PageData<MailLog>>('/mail-logs', {
        params: { page: targetPage, page_size: PAGE_SIZE },
      })
      setData(data)
      setPage(targetPage)
    } catch (e) {
      toast.danger(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(1)
  }, [load])

  const list = data?.list ?? []

  return (
    <div className="page">
      <h2 className="page-title">邮件发送日志</h2>
      <Card className="glass overflow-hidden rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <Table.Root className="w-full">
            <Table.ScrollContainer>
              <Table.Content aria-label="邮件日志">
                <Table.Header>
                  <Table.Column isRowHeader>收件人</Table.Column>
                  <Table.Column id="subject">主题</Table.Column>
                  <Table.Column id="status">状态</Table.Column>
                  <Table.Column id="error">说明</Table.Column>
                  <Table.Column id="created_at">时间</Table.Column>
                </Table.Header>
                <Table.Body
                  items={list}
                  renderEmptyState={() => (
                    <div className="py-12 text-center text-sm text-black/40">暂无邮件记录</div>
                  )}
                >
                  {(item: MailLog) => (
                    <Table.Row id={item.id}>
                      <Table.Cell>{item.to_email}</Table.Cell>
                      <Table.Cell>{item.subject}</Table.Cell>
                      <Table.Cell>
                        <Chip color={STATUS_CHIP[item.status].color} variant="soft" size="sm">
                          {STATUS_CHIP[item.status].text}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>{item.error || '-'}</Table.Cell>
                      <Table.Cell>{fmtTime(item.created_at)}</Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table.Root>
        </div>
        <div className="px-3 pb-3">
          <TablePager
            page={page}
            pageSize={PAGE_SIZE}
            total={data?.total ?? 0}
            loading={loading}
            onPageChange={(p) => void load(p)}
          />
        </div>
      </Card>
    </div>
  )
}
