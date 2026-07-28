import { redirect } from 'next/navigation'

/**
 * /results — redirect to /submit if accessed without an applicant ID.
 * The actual results page lives at /results/[id].
 */
export default function ResultsIndexPage() {
  redirect('/submit')
}
