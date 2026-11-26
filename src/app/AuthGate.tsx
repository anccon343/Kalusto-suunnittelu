/** Sign-in screen and allowlist check; renders the app only for allowed users. */
import { Alert, Button, Center, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import { IconBrandGoogle } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { signInWithGoogle, signOut, type SignInResult } from '../data/auth'
import { firebase } from '../data/firebase'
import { useAuthState } from '../data/hooks'
import { fi } from '../fi'
import { AppDataProvider } from './AppData'

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuthState()

  if (auth.status === 'loading') return <FullPageLoader />
  if (auth.status === 'allowed') {
    return (
      <AppDataProvider author={auth.email} authorName={auth.name}>
        {children}
      </AppDataProvider>
    )
  }
  return (
    <Center mih="100dvh" p="md">
      <Paper withBorder p="xl" radius="md" w="100%" maw={420}>
        <Stack>
          <Title order={1}>{fi.appName}</Title>
          {auth.status === 'signed-out' && <SignIn />}
          {auth.status === 'not-allowed' && (
            <>
              <Alert color="orange">{fi.auth.notAllowed(auth.email)}</Alert>
              <SignOutButton />
            </>
          )}
          {auth.status === 'error' && (
            <>
              <Alert color="red">{fi.auth.error}</Alert>
              <SignOutButton />
            </>
          )}
        </Stack>
      </Paper>
    </Center>
  )
}

export function FullPageLoader() {
  return (
    <Center mih="100dvh">
      <Loader aria-label={fi.loading} />
    </Center>
  )
}

function SignIn() {
  const [result, setResult] = useState<SignInResult | null>(null)
  const [busy, setBusy] = useState(false)
  const message =
    result && !result.ok
      ? {
          cancelled: fi.auth.cancelled,
          'popup-blocked': fi.auth.popupBlocked,
          failed: fi.auth.failed,
        }[result.reason]
      : null

  async function handleClick() {
    setBusy(true)
    setResult(await signInWithGoogle(firebase().auth))
    setBusy(false)
  }

  return (
    <>
      <Text c="dimmed">{fi.auth.intro}</Text>
      <Button
        size="md"
        leftSection={<IconBrandGoogle size={20} />}
        onClick={() => void handleClick()}
        loading={busy}
      >
        {fi.auth.signIn}
      </Button>
      {message && (
        <Alert color="orange" role="alert">
          {message}
        </Alert>
      )}
    </>
  )
}

export function SignOutButton() {
  return (
    <Button variant="default" onClick={() => void signOut(firebase().auth)}>
      {fi.auth.signOut}
    </Button>
  )
}
