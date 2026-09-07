import { Chip } from '@heroui/react'
import type { RequestStatus } from '../api/types'
import { STATUS_TEXT } from '../api/types'

const COLOR: Record<RequestStatus, 'warning' | 'success' | 'danger' | 'accent' | 'default'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  returned: 'accent',
  withdrawn: 'default',
}

export default function StatusTag({ status }: { status: RequestStatus }) {
  return (
    <Chip color={COLOR[status]} variant="soft" size="sm">
      {STATUS_TEXT[status]}
    </Chip>
  )
}
