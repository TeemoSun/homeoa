import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Table, toast } from '@heroui/react'
import { api, errMsg, fmtAmount, fmtTime } from '../api/client'
import type { PageData, RequestItem } from '../api/types'
import ConfirmButton from '../components/ConfirmButton'
import StatusTag from '../components/StatusTag'
import TablePager from '../components/TablePager'

const SCOPE_TITLE = {
  mine: '我的请求',
  pending: '待我审批',
  all: '请求管理（全部）',
} as const

const PAGE_SIZE = 15

export default function RequestsList({ scope }: { scope: 'mine' | 'pending' | 'all' }) {
  const navigate = useNavigate()
  const [data, setData] = useState<PageData<RequestItem> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      try {
        const { data } = await api.get<PageData<RequestItem>>('/requests', {
          params: { scope, page: targetPage, page_size: PAGE_SIZE },
        })
        setData(data)
        setPage(targetPage)
      } catch (e) {
        toast.danger(errMsg(e))
      } finally {
        setLoading(false)
      }
    },
    [scope],
  )

  useEffect(() => {
    void load(1)
  }, [load])

  const withdraw = async (id: number) => {
    try {
      await api.post(`/requests/${id}/withdraw`)
      toast.success('已撤回')
      void load(page)
    } catch (e) {
      toast.danger(errMsg(e))
    }
  }

  const list = data?.list ?? []

  return (
    <div className="page">
      <h2 className="page-title">{SCOPE_TITLE[scope]}</h2>
      <Card className="glass overflow-hidden rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <Table.Root className="w-full">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="请求列表"
                onRowAction={(key) => navigate(`/requests/${String(key)}`)}
              >
                <Table.Header>
                  <Table.Column isRowHeader>标题</Table.Column>
                  <Table.Column id="type">类型</Table.Column>
                  <Table.Column id="amount">金额</Table.Column>
                  {scope !== 'mine' && <Table.Column id="submitter">发起人</Table.Column>}
                  <Table.Column id="status">状态</Table.Column>
                  <Table.Column id="created_at">提交时间</Table.Column>
                  <Table.Column id="op">操作</Table.Column>
                </Table.Header>
                <Table.Body
                  items={list}
                  renderEmptyState={() => (
                    <div className="py-12 text-center text-sm text-black/40">
                      {scope === 'pending' ? '太好了，没有待你审批的申请' : '暂无数据'}
                    </div>
                  )}
                >
                  {(item: RequestItem) => (
                    <Table.Row id={item.id} className="cursor-pointer">
                      <Table.Cell>{item.title}</Table.Cell>
                      <Table.Cell>{item.type?.name ?? '-'}</Table.Cell>
                      <Table.Cell>{fmtAmount(item.amount)}</Table.Cell>
                      {scope !== 'mine' && (
                        <Table.Cell>{item.submitter?.display_name ?? '-'}</Table.Cell>
                      )}
                      <Table.Cell>
                        <StatusTag status={item.status} />
                      </Table.Cell>
                      <Table.Cell>{fmtTime(item.created_at)}</Table.Cell>
                      <Table.Cell>
                        {scope === 'mine' && item.status === 'pending' ? (
                          <ConfirmButton
                            label="撤回"
                            title="确定撤回该申请吗？"
                            confirmText="撤回"
                            onConfirm={() => void withdraw(item.id)}
                          />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onPress={() => navigate(`/requests/${item.id}`)}
                          >
                            查看
                          </Button>
                        )}
                      </Table.Cell>
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
