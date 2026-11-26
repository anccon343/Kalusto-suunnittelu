/** Asetukset: locations, users and backup (plan section 3). */
import { Stack, Tabs, Title } from '@mantine/core'
import { useSearchParams } from 'react-router'
import { BackupTab } from './BackupTab'
import { LocationsTab } from './LocationsTab'
import { t } from './texts'
import { UsersTab } from './UsersTab'

const TABS = ['kohteet', 'kayttajat', 'varmuuskopio'] as const
type Tab = (typeof TABS)[number]

const isTab = (v: string | null): v is Tab => TABS.some((x) => x === v)

export default function SettingsView() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('valilehti')
  const tab: Tab = isTab(raw) ? raw : 'kohteet'

  const select = (v: string | null) => {
    if (!isTab(v)) return
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('valilehti', v)
        return next
      },
      { replace: true },
    )
  }

  return (
    <Stack>
      <Title order={2}>{t.title}</Title>
      <Tabs value={tab} onChange={select} keepMounted={false}>
        <Tabs.List grow>
          <Tabs.Tab value="kohteet" mih={48} px="sm">
            {t.tabs.locations}
          </Tabs.Tab>
          <Tabs.Tab value="kayttajat" mih={48} px="sm">
            {t.tabs.users}
          </Tabs.Tab>
          <Tabs.Tab value="varmuuskopio" mih={48} px="sm">
            {t.tabs.backup}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="kohteet" pt="md">
          <LocationsTab />
        </Tabs.Panel>
        <Tabs.Panel value="kayttajat" pt="md">
          <UsersTab />
        </Tabs.Panel>
        <Tabs.Panel value="varmuuskopio" pt="md">
          <BackupTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
