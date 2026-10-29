import { LeadDetailClient } from './LeadDetailClient'

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <LeadDetailClient paramsPromise={params} />
}
