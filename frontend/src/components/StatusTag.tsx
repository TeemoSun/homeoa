import { Tag } from '@douyinfe/semi-ui'
import type { RequestStatus } from '../api/types'
import { STATUS_TEXT } from '../api/types'

const COLOR: Record<RequestStatus, 'orange' | 'green' | 'red' | 'blue' | 'grey'> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  returned: 'blue',
  withdrawn: 'grey',
}

export default function StatusTag({ status }: { status: RequestStatus }) {
  return <Tag color={COLOR[status]}>{STATUS_TEXT[status]}</Tag>
}
