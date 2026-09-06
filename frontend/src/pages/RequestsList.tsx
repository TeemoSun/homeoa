import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popconfirm, Table, Toast } from '@douyinfe/semi-ui'
import { api, errMsg, fmtAmount, fmtTime } from '../api/client'
import type { PageData, RequestItem } from '../api/types'
import StatusTag from '../components/StatusTag'

const SCOPE_TITLE = {
  mine: '我的请求',
  pending: '待我审批',
  all: '请求管理（全部）',
} as const

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
          params: { scope, page: targetPage, page_size: 15 },
        })
        setData(data)
        setPage(targetPage)
      } catch (e) {
        Toast.error(errMsg(e))
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
      Toast.success('已撤回')
      void load(page)
    } catch (e) {
      Toast.error(errMsg(e))
    }
  }

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      render: (v: string, r: RequestItem) => (
        <a
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/requests/${r.id}`)
          }}
        >
          {v}
        </a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 110,
      render: (v: { name: string } | undefined) => v?.name ?? '-',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 110,
      render: (v: number | null) => fmtAmount(v),
    },
    ...(scope !== 'mine'
      ? [
          {
            title: '发起人',
            dataIndex: 'submitter',
            width: 110,
            render: (v: { display_name: string } | undefined) => v?.display_name ?? '-',
          },
        ]
      : []),
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: RequestItem['status']) => <StatusTag status={v} />,
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      width: 170,
      render: (v: string) => fmtTime(v),
    },
    {
      title: '操作',
      dataIndex: 'op',
      width: 110,
      render: (_: unknown, r: RequestItem) => (
        <span onClick={(e) => e.stopPropagation()}>
          {scope === 'mine' && r.status === 'pending' ? (
            <Popconfirm title="确定撤回该申请吗？" onConfirm={() => void withdraw(r.id)}>
              <Button size="small" type="danger">
                撤回
              </Button>
            </Popconfirm>
          ) : (
            <Button size="small" onClick={() => navigate(`/requests/${r.id}`)}>
              查看
            </Button>
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="page">
      <h2 className="page-title">{SCOPE_TITLE[scope]}</h2>
      <Table
        loading={loading}
        empty={scope === 'pending' ? '太好了，没有待你审批的申请' : '暂无数据'}
        dataSource={data?.list ?? []}
        rowKey="id"
        onRow={(record) => ({
          style: { cursor: 'pointer' },
          onClick: () => navigate(`/requests/${(record as { id: number }).id}`),
        })}
        pagination={{
          currentPage: page,
          pageSize: 15,
          total: data?.total ?? 0,
          onPageChange: (p) => void load(p),
        }}
        columns={columns}
      />
    </div>
  )
}
