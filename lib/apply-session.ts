import * as jose from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(process.env.OTP_PEPPER || 'default-secret-fallback')

export async function getApplySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('apply_session')?.value
  
  if (!token) return null

  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    return payload as { usn: string, application_id: string }
  } catch (err) {
    return null
  }
}
