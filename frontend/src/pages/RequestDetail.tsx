import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  Label,
  Modal,
  Spinner,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import { api, errMsg, fmtAmount, fmtTime } from '../api/client'
import type { RequestItem, RequestLog, RequestType } from '../api/types'
import { ACTION_TEXT } from '../api/types'
import DynamicForm from '../components/DynamicForm'
import StatusTag from '../components/StatusTag'
import { useAuth } from '../store/auth'

const LOG_COLOR: Record<RequestLog['action'], string> = {
  submit: '#3b82f6',
  resubmit: '#06b6d4',
  approve: '#10b981',
  reject: '#ef4444',
  return: '#f59e0b',
  withdraw: '#9ca3af',
  comment: '#a855f7',
}

function InfoItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-full' : undefined}>
      <div className="text-xs text-black/40">{label}</div>
      <div className="mt-0.5 text-sm font-medium break-words whitespace-pre-wrap">{value}</div>
    </div>
  )
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
      toast.danger(errMsg(e))
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
      toast.warning(`${action === 'reject' ? '拒绝' : '退回'}时必须填写意见`)
      return
    }
    setActing(true)
    try {
      await api.post(`/requests/${id}/${action}`, { comment: comment.trim() })
      toast.success('操作成功')
      setModal(null)
      setComment('')
      void load()
    } catch (e) {
      toast.danger(errMsg(e))
    } finally {
      setActing(false)
    }
  }

  const withdraw = async () => {
    setActing(true)
    try {
      await api.post(`/requests/${id}/withdraw`)
      toast.success('已撤回')
      void load()
    } catch (e) {
      toast.danger(errMsg(e))
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
      toast.danger(errMsg(e))
    } finally {
      setActing(false)
    }
  }

  const resubmit = async (values: Record<string, unknown>) => {
    setActing(true)
    try {
      await api.post(`/requests/${id}/resubmit`, { form_data: values })
      toast.success('已重新提交')
      setResubmitOpen(false)
      void load()
    } catch (e) {
      toast.danger(errMsg(e))
    } finally {
      setActing(false)
    }
  }

  if (loading && !request) {
    return (
      <div className="flex justify-center pt-24">
        <Spinner size="lg" />
      </div>
    )
  }
  if (!request) return null

  const t: RequestType | undefined = request.type
  const formData = (request.form_data ?? {}) as Record<string, unknown>

  return (
    <div className="page max-w-[880px]">
      <h2 className="page-title flex items-center gap-3">
        {request.title} <StatusTag status={request.status} />
      </h2>

      <Card className="glass mb-4 rounded-2xl shadow-sm">
        <Card.Header className="pb-1">
          <Card.Title>申请信息</Card.Title>
        </Card.Header>
        <Card.Content className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 pt-2 sm:grid-cols-3">
          <InfoItem label="申请类型" value={t?.name ?? '-'} />
          <InfoItem label="预估金额" value={fmtAmount(request.amount)} />
          <InfoItem label="发起人" value={request.submitter?.display_name ?? '-'} />
          <InfoItem label="提交时间" value={fmtTime(request.created_at)} />
          <InfoItem label="审批人" value={request.approver?.display_name ?? '待定'} />
          <InfoItem label="决定时间" value={fmtTime(request.decided_at)} />
          <InfoItem label="审批意见" value={request.decision_comment || '-'} wide />
          {(t?.form_schema?.fields ?? []).map((f) => {
            const raw = formData[f.name]
            return (
              <InfoItem
                key={f.name}
                label={f.label}
                value={raw === undefined || raw === null || raw === '' ? '-' : String(raw)}
              />
            )
          })}
        </Card.Content>
      </Card>

      <Card className="glass mb-4 rounded-2xl shadow-sm">
        <Card.Header className="pb-1">
          <Card.Title>流转记录</Card.Title>
        </Card.Header>
        <Card.Content className="p-5 pt-2">
          {logs.length === 0 ? (
            <p className="text-sm text-black/40">暂无记录</p>
          ) : (
            <ol className="relative ml-1.5 space-y-5 border-l-2 border-black/10 pl-5">
              {logs.map((l) => (
                <li key={l.id} className="relative">
                  <span
                    className="absolute top-[5px] -left-[26.5px] size-3 rounded-full ring-4 ring-white/80"
                    style={{ backgroundColor: LOG_COLOR[l.action] }}
                  />
                  <div className="text-sm font-semibold">
                    {ACTION_TEXT[l.action]}
                    <span className="ml-2 text-xs font-normal text-black/40">
                      {l.actor?.display_name ?? '未知'} · {fmtTime(l.created_at)}
                    </span>
                  </div>
                  {l.comment && <div className="mt-1 text-sm break-words text-black/65">{l.comment}</div>}
                </li>
              ))}
            </ol>
          )}
        </Card.Content>
      </Card>

      <Card className="glass rounded-2xl shadow-sm">
        <Card.Header className="pb-1">
          <Card.Title>操作</Card.Title>
        </Card.Header>
        <Card.Content className="p-5 pt-2">
          <div className="mb-4 flex flex-wrap gap-2">
            {canDecide && request.status === 'pending' && (
              <>
                <Button variant="primary" onPress={() => setModal('approve')}>
                  通过
                </Button>
                <Button variant="danger" onPress={() => setModal('reject')}>
                  拒绝
                </Button>
                <Button variant="outline" onPress={() => setModal('return')}>
                  退回修改
                </Button>
              </>
            )}
            {isSubmitter && request.status === 'pending' && (
              <Button variant="danger-soft" isPending={acting} onPress={() => void withdraw()}>
                撤回申请
              </Button>
            )}
            {isSubmitter && request.status === 'returned' && (
              <Button variant="primary" onPress={() => setResubmitOpen(true)}>
                修改后重新提交
              </Button>
            )}
          </div>
          <TextField value={newComment} onChange={setNewComment} className="flex flex-col gap-1.5">
            <Label>评论</Label>
            <TextArea
              placeholder="添加评论（对方会收到邮件通知）"
              className="min-h-16"
              maxLength={500}
            />
          </TextField>
          <Button variant="primary" isPending={acting} className="mt-3" onPress={() => void sendComment()}>
            发表评论
          </Button>
        </Card.Content>
      </Card>

      {/* 审批操作弹窗 */}
      <Modal.Root
        isOpen={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null)
        }}
      >
        <Modal.Backdrop variant="blur" />
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                {modal === 'approve' ? '通过申请' : modal === 'reject' ? '拒绝申请' : '退回修改'}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-2">
              <p className="text-sm text-black/50">
                {modal === 'approve' ? '审批意见（选填）' : '必须填写意见'}
              </p>
              <TextField value={comment} onChange={setComment} className="flex flex-col gap-1.5">
                <Label>审批意见</Label>
                <TextArea placeholder="请填写审批意见" className="min-h-24" maxLength={500} />
              </TextField>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button variant="ghost" onPress={() => setModal(null)}>
                取消
              </Button>
              <Button
                variant={modal === 'approve' ? 'primary' : 'danger'}
                isPending={acting}
                onPress={() => {
                  if (modal) void decide(modal)
                }}
              >
                确认
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Root>

      {/* 修改后重新提交弹窗 */}
      <Modal.Root isOpen={resubmitOpen} onOpenChange={setResubmitOpen}>
        <Modal.Backdrop variant="blur" />
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>修改并重新提交</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {t?.form_schema && (
                <DynamicForm
                  key={request.id}
                  fields={t.form_schema.fields}
                  initValues={formData}
                  submitText="重新提交"
                  submitting={acting}
                  onSubmit={(values) => void resubmit(values)}
                />
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Root>
    </div>
  )
}
