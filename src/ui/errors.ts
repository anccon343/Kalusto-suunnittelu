/** Maps errors from the data layer and Firebase to Finnish messages. */
import { FirebaseError } from 'firebase/app'
import { notifications } from '@mantine/notifications'
import { ValidationError } from '../data/schemas'
import { ConflictError, InvalidStateError, NotFoundError } from '../data/writes'
import { fi } from '../fi'

export function errorMessage(e: unknown): string {
  if (e instanceof ConflictError) return fi.errors.conflict(e.fields.join(', '))
  if (e instanceof InvalidStateError) return fi.errors.state[e.reason]
  if (e instanceof NotFoundError) return fi.errors.notFound
  if (e instanceof ValidationError) return fi.errors.invalid
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') return fi.errors.permission
    if (e.code === 'unavailable' || e.code === 'deadline-exceeded') return fi.errors.offline
  }
  return fi.errors.unknown
}

/** Shows an error notification; logs the original error for developers. */
export function notifyError(e: unknown): void {
  console.error(e)
  notifications.show({ color: 'red', message: errorMessage(e), autoClose: 8000 })
}

export function notifySaved(message: string = fi.saved): void {
  notifications.show({ color: 'teal', message, autoClose: 2500 })
}
