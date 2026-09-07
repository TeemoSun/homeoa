import { Button } from '@heroui/react'

// 轻量分页器：与 HeroUI 表格搭配使用
export default function TablePager({
  page,
  pageSize,
  total,
  loading = false,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  loading?: boolean
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  return (
    <div className="flex items-center justify-end gap-3 pt-3 text-[13px] text-black/50">
      <span>
        共 {total} 条 · 第 {page}/{totalPages} 页
      </span>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          isDisabled={page <= 1 || loading}
          onPress={() => onPageChange(page - 1)}
        >
          上一页
        </Button>
        <Button
          size="sm"
          variant="outline"
          isDisabled={page >= totalPages || loading}
          onPress={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  )
}
