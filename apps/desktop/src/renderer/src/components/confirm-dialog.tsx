import type { ReactNode } from 'react'
import { useI18n } from '../lib/use-i18n'
import { Button, Modal } from './ui'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  loading,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
  loading?: boolean
}): ReactNode {
  const { t } = useI18n()
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <p className="text-[13px] leading-relaxed text-muted">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel ?? t('common.confirm')}
        </Button>
      </div>
    </Modal>
  )
}
