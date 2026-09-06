import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  Descriptions,
  Modal,
  Spin,
  TextArea,
  Timeline,
  Toast,
} from '@douyinfe/semi-ui'
import { api, errMsg, fmtAmount, fmtTime } from '../api/client'
import type { RequestItem, RequestLog, RequestType } from '../api/types'
import { ACTION_TEXT } from '../api/types'
import DynamicForm from '../components/DynamicForm'
import StatusTag from '../components/StatusTag'
import { useAuth } from '../store/auth'

const LOG_COLOR: Record<RequestLog['action'], string> = {
  submit: 'blue',
  resubmit: 'cyan',
  approve: 'green',
  reject: 'red',
  return: 'orange',
  withdraw: 'grey',
  comment: 'purple',
}

export default function RequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [request, setRequest] = useState<RequestItem | null>(null)
  const [logs, setLogs] = useState<RequestLog[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'approve' | 'reject' | 'return' | null>(null)
  const [comment, setComment] = useState('')
  const [acting, setActing] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [resubmitOpen, setResubmitOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<{ request: RequestItem; logs: RequestLog[] }>(`/requests/${id}`)
      setRequest(data.request)
      setLogs(data.logs)
    } catch (e) {
      Toast.error(errMsg(e))
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void load()
  }, [load])

  const canDecide = useMemo(() => {
    if (!request || !user) return false
    if (user.role === 'admin') return true
    return request.type?.approver_id === user.id
  }, [request, user])

  const isSubmitter = request?.submitter_id === user?.id

  const decide = async (action: 'approve' | 'reject' | 'return') => {
    if ((action === 'reject' || action === 'return') && !comment.trim()) {
      Toast.warning(`${action === 'reject' ? '拒绝' : '退回'}时必须填写意见`)
      return
    }
    setActing(true)
    try {
      await api.post(`/requests/${id}/${action}`, { comment: comment.trim() })
      Toast.success('操作成功')
      setModal(null)
      setComment('')
      void load()
    } catch (e) {
      Toast.error(errMsg(e))
    } finally {
      setActing(false)
    }
  }

  const withdraw = async () => {
    setActing(true)
    try {
      await api.post(`/requests/${id}/withdraw`)
      Toast.success('已撤回')
      void load()
    } catch (e) {
      Toast.error(errMsg(e))
    } finally {
      setActing(false)
    }
  }

  const sendComment = async () => {
    if (!newComment.trim()) return
    setActing(true)
    try {
      await api.post(`/requests/${id}/comment`, { comment: newComment.trim() })
      setNewComment('')
      void load()
    } catch (e) {
      Toast.error(errMsg(e))
    } finally {
      setActing(false)
    }
  }

  const resubmit = async (values: Record<string, unknown>) => {
    setActing(true)
    try {
      await api.post(`/requests/${id}/resubmit`, { form_data: values })
      Toast.success('已重新提交')
      setResubmitOpen(false)
      void load()
    } catch (e) {
      Toast.error(errMsg(e))
    } finally {
      setActing(false)
    }
  }

  if (loading && !request) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!request) return null

  const t: RequestType | undefined = request.type
  const formData = (request.form_data ?? {}) as Record<string, unknown>

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {request.title} <StatusTag status={request.status} />
      </h2>

      <Card title="申请信息" style={{ marginBottom: 16 }}>
        <Descriptions
          row
          size="medium"
          data={[
            { key: '申请类型', value: t?.name ?? '-' },
            { key: '预估金额', value: fmtAmount(request.amount) },
            { key: '发起人', value: request.submitter?.display_name ?? '-' },
            { key: '提交时间', value: fmtTime(request.created_at) },
            { key: '审批人', value: request.approver?.display_name ?? '待定' },
            { key: '决定时间', value: fmtTime(request.decided_at) },
          ]}
        />
        <Descriptions
          size="medium"
          layout="vertical"
          data={[{ key: '审批意见', value: request.decision_comment || '-' }]}
          style={{ marginTop: 8 }}
        />
        {t && (
          <Descriptions
            size="medium"
            layout="vertical"
            data={t.form_schema.fields.map((f) => ({
              key: f.label,
              value: formData[f.name] === undefined || formData[f.name] === '' ? '-' : String(formData[f.name]),
            }))}
            style={{ marginTop: 8 }}
          />
        )}
      </Card>

      <Card title="流转记录" style={{ marginBottom: 16 }}>
        <Timeline mode="left">
          {logs.map((l) => (
            <Timeline.Item key={l.id} color={LOG_COLOR[l.action]}>
              <div>
                <b>{ACTION_TEXT[l.action]}</b>
                <span style={{ color: 'var(--semi-color-text-2)', marginLeft: 8 }}>
                  {l.actor?.display_name ?? '未知'} · {fmtTime(l.created_at)}
                </span>
              </div>
              {l.comment && (
                <div style={{ color: 'var(--semi-color-text-1)', marginTop: 2 }}>{l.comment}</div>
              )}
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      <Card title="操作">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {canDecide && request.status === 'pending' && (
            <>
              <Button type="primary" theme="solid" onClick={() => setModal('approve')}>
                通过
              </Button>
              <Button type="danger" theme="solid" onClick={() => setModal('reject')}>
                拒绝
              </Button>
              <Button type="warning" onClick={() => setModal('return')}>
                退回修改
              </Button>
            </>
          )}
          {isSubmitter && request.status === 'pending' && (
            <Button type="danger" loading={acting} onClick={() => void withdraw()}>
              撤回申请
            </Button>
          )}
          {isSubmitter && request.status === 'returned' && (
            <Button type="primary" theme="solid" onClick={() => setResubmitOpen(true)}>
              修改后重新提交
            </Button>
          )}
        </div>
        <TextArea
          value={newComment}
          onChange={setNewComment}
          placeholder="添加评论（对方会收到邮件通知）"
          autosize={{ minRows: 2, maxRows: 4 }}
          maxCount={500}
          style={{ marginBottom: 8 }}
        />
        <Button type="primary" loading={acting} onClick={() => void sendComment()}>
          发表评论
        </Button>
      </Card>

      <Modal
        title={
          modal === 'approve' ? '通过申请' : modal === 'reject' ? '拒绝申请' : '退回修改'
        }
        visible={modal !== null}
        onCancel={() => setModal(null)}
        onOk={() => {
          if (modal) void decide(modal)
        }}
        okText="确认"
        cancelText="取消"
        confirmLoading={acting}
        okButtonProps={{ type: modal === 'approve' ? 'primary' : 'danger' }}
      >
        <p style={{ color: 'var(--semi-color-text-2)' }}>
          {modal === 'approve' ? '审批意见（选填）' : '必须填写意见'}
        </p>
        <TextArea
          value={comment}
          onChange={setComment}
          placeholder="请填写审批意见"
          autosize={{ minRows: 3, maxRows: 6 }}
          maxCount={500}
        />
      </Modal>

      <Modal
        title="修改并重新提交"
        visible={resubmitOpen}
        onCancel={() => setResubmitOpen(false)}
        footer={null}
        width={520}
      >
        {t && (
          <DynamicForm
            fields={t.form_schema.fields}
            initValues={formData}
            submitText="重新提交"
            submitting={acting}
            onSubmit={(values) => void resubmit(values)}
          />
        )}
      </Modal>
    </div>
  )
}
