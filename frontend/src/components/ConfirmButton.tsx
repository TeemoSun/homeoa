import { useState } from 'react'
import { Button, Popover } from '@heroui/react'

// Popconfirm 的替代：点击后弹出小气泡确认（用于删除、撤回等破坏性操作）
export default function ConfirmButton({
  label,
  title,
  confirmText = '确认',
  onConfirm,
}: {
  label: string
  title: string
  confirmText?: string
  onConfirm: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    try {
      setLoading(true)
      await onConfirm()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-block" onClick={(e) => e.stopPropagation()}>
      <Popover.Root isOpen={open} onOpenChange={setOpen}>
        <Popover.Trigger>
          <Button size="sm" variant="danger-soft">
            {label}
          </Button>
        </Popover.Trigger>
        <Popover.Content placement="top">
          <Popover.Dialog aria-label={title}>
            <div className="w-56 space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-black/75">{title}</p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" isDisabled={loading} onPress={() => setOpen(false)}>
                  取消
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isPending={loading}
                  isDisabled={loading}
                  onPress={() => void handleConfirm()}
                >
                  {confirmText}
                </Button>
              </div>
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover.Root>
    </div>
  )
}
