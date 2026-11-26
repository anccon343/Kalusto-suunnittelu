/**
 * App layout: header, side navigation on wide screens, bottom navigation on phones
 * (plan section 3: Tänään · Kalenteri · Kalusto · Taulu · Lisää).
 */
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Button,
  Group,
  Menu,
  NavLink as MantineNavLink,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconBox,
  IconCalendar,
  IconDots,
  IconLayoutGrid,
  IconLogout,
  IconPlus,
  IconSettings,
  IconSun,
  IconTruck,
  type Icon,
} from '@tabler/icons-react'
import { Suspense } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { fi } from '../fi'
import { useAppData } from './appData'
import { FullPageLoader } from './AuthGate'
import classes from './Shell.module.css'

interface NavItem {
  to: string
  label: string
  icon: Icon
}

const PRIMARY: NavItem[] = [
  { to: '/', label: fi.nav.today, icon: IconSun },
  { to: '/kalenteri', label: fi.nav.calendar, icon: IconCalendar },
  { to: '/kalusto', label: fi.nav.equipment, icon: IconBox },
  { to: '/taulu', label: fi.nav.board, icon: IconLayoutGrid },
]

const SECONDARY: NavItem[] = [
  { to: '/roudaukset', label: fi.nav.moves, icon: IconTruck },
  { to: '/asetukset', label: fi.nav.settings, icon: IconSettings },
]

const isActive = (pathname: string, to: string) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)

export function Shell() {
  const app = useAppData()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const wide = useMediaQuery('(min-width: 48em)', true)

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: true } }}
      {...(wide ? {} : { footer: { height: 64 } })}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Title order={1} size="h3">
              {fi.appName}
            </Title>
            {app.usingEmulators && (
              <Badge variant="outline" color="orange">
                {fi.emulators}
              </Badge>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Button
              size="xs"
              leftSection={<IconPlus size={16} />}
              onClick={() => void navigate('/keikat/uusi')}
            >
              {fi.nav.newGig}
            </Button>
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg" aria-label={app.authorName}>
                  <Text fw={600} size="sm">
                    {initials(app.authorName)}
                  </Text>
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{fi.auth.signedInAs(app.authorName)}</Menu.Label>
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  onClick={() => void app.signOut()}
                >
                  {fi.auth.signOut}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <Stack gap={2}>
          {[...PRIMARY, ...SECONDARY].map((item) => (
            <MantineNavLink
              key={item.to}
              component={NavLink}
              to={item.to}
              label={item.label}
              leftSection={<item.icon size={20} />}
              active={isActive(pathname, item.to)}
            />
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        {app.data.status === 'error' && (
          <Alert color="red" mb="md">
            {fi.data.error}
          </Alert>
        )}
        {app.data.issues.length > 0 && (
          <Alert color="orange" mb="md">
            {fi.data.issues(app.data.issues.length)}
          </Alert>
        )}
        {app.data.status === 'loading' ? (
          <FullPageLoader />
        ) : (
          <Suspense fallback={<FullPageLoader />}>
            <Outlet />
          </Suspense>
        )}
      </AppShell.Main>

      {!wide && (
        <AppShell.Footer>
          <nav aria-label="Päävalikko" className={classes.bottomNav}>
            {PRIMARY.map((item) => (
              <UnstyledButton
                key={item.to}
                component={NavLink}
                to={item.to}
                className={classes.bottomItem}
                data-active={isActive(pathname, item.to) || undefined}
              >
                <item.icon size={22} />
                <span>{item.label}</span>
              </UnstyledButton>
            ))}
            <Menu position="top-end">
              <Menu.Target>
                <UnstyledButton
                  className={classes.bottomItem}
                  data-active={SECONDARY.some((s) => isActive(pathname, s.to)) || undefined}
                >
                  <IconDots size={22} />
                  <span>{fi.nav.more}</span>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                {SECONDARY.map((item) => (
                  <Menu.Item
                    key={item.to}
                    leftSection={<item.icon size={18} />}
                    onClick={() => void navigate(item.to)}
                  >
                    {item.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </nav>
        </AppShell.Footer>
      )}
    </AppShell>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (
    parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}` : name.slice(0, 2)
  ).toUpperCase()
}
