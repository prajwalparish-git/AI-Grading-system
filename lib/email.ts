import { Resend } from 'resend'

let resend: Resend | null = null
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY)
}
const fromEmail = process.env.EMAIL_FROM || 'admissions@example.com'

export async function sendOtpEmail(to: string, otp: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping OTP email. OTP was:', otp)
    return { success: true }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Coding Club Admissions <${fromEmail}>`,
      to,
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2>Coding Club Admissions</h2>
          <p>Your verification code is:</p>
          <h1 style="letter-spacing: 0.25em; font-size: 32px;">${otp}</h1>
          <p>This code will expire in ${process.env.OTP_EXPIRY_MINUTES || '10'} minutes.</p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send OTP email:', error)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (err) {
    console.error('Error sending OTP email:', err)
    return { success: false, error: err }
  }
}

export async function sendCredentialsEmail(to: string, emailId: string, passwordHashRaw: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping credentials email.')
    return { success: true }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Coding Club Admissions <${fromEmail}>`,
      to,
      subject: 'Your Application Credentials',
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2>Coding Club Admissions</h2>
          <p>Your application projects have been successfully submitted.</p>
          <p>You can use the following credentials to log in to the portal and track your application or edit your projects before the deadline:</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Email / User ID:</strong> ${emailId}</p>
            <p style="margin: 8px 0 0 0;"><strong>Password:</strong> ${passwordHashRaw}</p>
          </div>
          <p>Please keep this information secure.</p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send credentials email:', error)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (err) {
    console.error('Error sending credentials email:', err)
    return { success: false, error: err }
  }
}
