import { Resend } from 'resend'

let resend: Resend | null = null
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY)
}
const fromEmail = process.env.EMAIL_FROM || 'admissions@example.com'

export async function sendVerificationCode(to: string, code: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping OTP email. OTP was:', code)
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
          <h1 style="letter-spacing: 0.25em; font-size: 32px;">${code}</h1>
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

export async function sendAdminInvite(to: string, tempPasswordRaw: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping admin invite email. Password:', tempPasswordRaw)
    return { success: true }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Coding Club Admissions <${fromEmail}>`,
      to,
      subject: 'Admin Invitation',
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2>Coding Club Admissions - Admin Access</h2>
          <p>You have been invited as an administrator.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${to}</p>
            <p style="margin: 8px 0 0 0;"><strong>Temporary Password:</strong> ${tempPasswordRaw}</p>
          </div>
          <p>Please log in and change your password.</p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send admin invite email:', error)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (err) {
    console.error('Error sending admin invite email:', err)
    return { success: false, error: err }
  }
}

export async function sendStudentCredentials(to: string, emailId: string, passwordRaw: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping student credentials email. Password:', passwordRaw)
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
          <p>Your application account has been successfully created.</p>
          <p>You can use the following credentials to log in to the portal:</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Email / User ID:</strong> ${emailId}</p>
            <p style="margin: 8px 0 0 0;"><strong>Password:</strong> ${passwordRaw}</p>
          </div>
          <p>Please keep this information secure. You can change your password after logging in.</p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send student credentials email:', error)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (err) {
    console.error('Error sending student credentials email:', err)
    return { success: false, error: err }
  }
}

export async function sendMessageToDeveloper(fromStudentEmail: string, usn: string, message: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping message to developer.')
    return { success: true }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Coding Club Admissions <${fromEmail}>`,
      to: process.env.DEVELOPER_EMAIL || 'admin@example.com',
      replyTo: fromStudentEmail,
      subject: `Message from Student (${usn})`,
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2>Message from Student</h2>
          <p><strong>USN:</strong> ${usn}</p>
          <p><strong>Email:</strong> ${fromStudentEmail}</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; white-space: pre-wrap;">
            ${message}
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send message to developer:', error)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (err) {
    console.error('Error sending message to developer:', err)
    return { success: false, error: err }
  }
}

export async function sendResultNotification(to: string, resultDetails: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping result notification.')
    return { success: true }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Coding Club Admissions <${fromEmail}>`,
      to,
      subject: 'Your Application Result',
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2>Coding Club Admissions</h2>
          <p>Your application evaluation is complete.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            ${resultDetails}
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send result notification:', error)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (err) {
    console.error('Error sending result notification:', err)
    return { success: false, error: err }
  }
}
