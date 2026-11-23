import { useState } from 'react'
import { signInWithGoogle, signOut, type SignInResult } from './data/auth'
import { firebase } from './data/firebase'
import { AuthorContext, useAuthState, useLiveData } from './data/hooks'
import { fi } from './fi'

export default function App() {
  const auth = useAuthState()
  const { usingEmulators } = firebase()

  return (
    <main className="app">
      <header className="app-header">
        <h1>{fi.appName}</h1>
        {usingEmulators && <p className="badge">{fi.emulators}</p>}
      </header>
      {auth.status === 'loading' && <p role="status">{fi.loading}</p>}
      {auth.status === 'signed-out' && <SignIn />}
      {auth.status === 'not-allowed' && (
        <SignedInMessage message={fi.auth.notAllowed(auth.email)} />
      )}
      {auth.status === 'error' && <SignedInMessage message={fi.auth.error} />}
      {auth.status === 'allowed' && (
        <AuthorContext value={auth.email}>
          <Home name={auth.name} />
        </AuthorContext>
      )}
    </main>
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
    <section>
      <p>{fi.auth.intro}</p>
      <button type="button" onClick={() => void handleClick()} disabled={busy}>
        {fi.auth.signIn}
      </button>
      {message && <p role="alert">{message}</p>}
    </section>
  )
}

function SignedInMessage({ message }: { message: string }) {
  return (
    <section>
      <p role="alert">{message}</p>
      <SignOutButton />
    </section>
  )
}

function SignOutButton() {
  return (
    <button type="button" onClick={() => void signOut(firebase().auth)}>
      {fi.auth.signOut}
    </button>
  )
}

function Home({ name }: { name: string }) {
  const data = useLiveData()
  return (
    <section>
      <p>{fi.auth.signedInAs(name)}</p>
      {data.status === 'loading' && <p role="status">{fi.loading}</p>}
      {data.status === 'error' && <p role="alert">{fi.data.error}</p>}
      {data.status === 'ready' && (
        <>
          <p>{fi.data.summary(data.items.length, data.gigs.length)}</p>
          <p>{fi.data.underConstruction}</p>
        </>
      )}
      {data.issues.length > 0 && <p role="alert">{fi.data.issues(data.issues.length)}</p>}
      <SignOutButton />
    </section>
  )
}
