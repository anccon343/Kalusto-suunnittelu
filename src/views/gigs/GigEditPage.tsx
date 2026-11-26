/**
 * Keikka: create (/keikat/uusi) and edit (/keikat/:gigId/muokkaa). The form keeps the
 * stored gig it was opened with as the baseline for conflict detection on save
 * (plan 2.2 principle 4), so live updates of the same gig never overwrite the form.
 */
import { useParams } from 'react-router'
import { useAppData } from '../../app/appData'
import { GigEditor } from './GigEditor'
import { GigNotFound } from './GigNotFound'

export default function GigEditPage() {
  const { gigId } = useParams()
  const app = useAppData()
  if (gigId === undefined) return <GigEditor key="new" />
  const gig = app.gigsById.get(gigId)
  if (!gig) return <GigNotFound />
  return <GigEditor key={gigId} baseline={gig} />
}
