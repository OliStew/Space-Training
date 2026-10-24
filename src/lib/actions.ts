import { getAuthToken } from 'deepspace'

export async function callAction(name: string, params: Record<string, unknown>) {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })

  return res.json()
}
