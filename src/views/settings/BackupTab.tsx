/** Varmuuskopio: download all data as JSON (plan 6.4). */
import { Alert, Button, Stack, Text, Title } from '@mantine/core'
import { IconAlertTriangle, IconDownload } from '@tabler/icons-react'
import { useState } from 'react'
import { useAppData } from '../../app/appData'
import { formatDateTime } from '../../core/time'
import { recordBackup } from '../../data/writes'
import { notifyError, notifySaved } from '../../ui/errors'
import { backupAge, backupFileName, backupJson } from './backup'
import { downloadTextFile } from './download'
import { t } from './texts'

const tb = t.backup

export function BackupTab() {
  const app = useAppData()
  const [busy, setBusy] = useState(false)
  const last = app.data.settings.lastBackupAt
  const age = backupAge(last, app.now)

  const download = async () => {
    setBusy(true)
    try {
      // Date.now(), not app.now: app.now is refreshed only once a minute.
      const exportedAt = Date.now()
      downloadTextFile(
        backupFileName(exportedAt),
        backupJson(app.data, exportedAt),
        'application/json',
      )
      await recordBackup(app.db, app.author)
      notifySaved(tb.done)
    } catch (e) {
      notifyError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack>
      <Title order={3}>{tb.heading}</Title>
      <Text>{tb.intro}</Text>
      <Text fw={500}>{last === undefined ? tb.never : tb.lastBackup(formatDateTime(last))}</Text>
      {age.kind !== 'ok' && (
        <Alert
          color="orange"
          variant="light"
          title={tb.warningLabel}
          icon={<IconAlertTriangle aria-hidden />}
        >
          {age.kind === 'never' ? tb.neverWarning : tb.staleWarning(age.days)}
        </Alert>
      )}
      <div>
        <Button
          size="md"
          leftSection={<IconDownload size={18} aria-hidden />}
          loading={busy}
          onClick={() => void download()}
        >
          {tb.download}
        </Button>
      </div>
    </Stack>
  )
}
