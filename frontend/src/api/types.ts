// 与后端 API 对齐的类型定义

export interface User {
  id: number
  username: string
  display_name: string
  email: string
  role: 'admin' | 'member'
  mail_enabled: boolean
  created_at?: string
}

export interface FormField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date'
  required: boolean
  placeholder?: string
}

export interface FormSchema {
  fields: FormField[]
}

export interface ApproverBrief {
  id: number
  username: string
  display_name: string
}

export interface RequestType {
  id: number
  code: string
  name: string
  icon: string
  form_schema: FormSchema
  approver_id: number | null
  approver?: ApproverBrief
  enabled: boolean
  created_at?: string
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'withdrawn'

export interface RequestItem {
  id: number
  type_id: number
  type?: RequestType
  title: string
  amount: number | null
  form_data: Record<string, unknown>
  status: RequestStatus
  submitter_id: number
  submitter?: ApproverBrief
  approver_id: number | null
  approver?: ApproverBrief
  decision_comment: string
  decided_at: string | null
  created_at: string
  updated_at: string
}

export interface RequestLog {
  id: number
  request_id: number
  actor_id: number
  actor?: ApproverBrief
  action: 'submit' | 'resubmit' | 'approve' | 'reject' | 'return' | 'withdraw' | 'comment'
  comment: string
  created_at: string
}

export interface MailLog {
  id: number
  request_id: number | null
  to_email: string
  subject: string
  status: 'sent' | 'failed' | 'skipped'
  error: string
  created_at: string
}

export interface PageData<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}

export interface DashboardStats {
  todo_count: number
  todo_list: RequestItem[]
  status_count: Record<RequestStatus, number>
  month_submitted: number
  month_amount: number
}

export const STATUS_TEXT: Record<RequestStatus, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  returned: '已退回',
  withdrawn: '已撤回',
}

export const ACTION_TEXT: Record<RequestLog['action'], string> = {
  submit: '提交申请',
  resubmit: '重新提交',
  approve: '审批通过',
  reject: '审批拒绝',
  return: '退回修改',
  withdraw: '撤回申请',
  comment: '评论',
}
