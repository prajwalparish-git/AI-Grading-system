import { Resend } from 'resend'

let resend: Resend | null = null
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY)
}
const fromEmail = process.env.EMAIL_FROM || 'admissions@codingclub.com'

const emailContainer = (content: string) => `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4f4f5">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <tr>
            <td bgcolor="#2563eb" align="center" style="padding: 30px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Coding Club Admissions</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
              ${content}
            </td>
          </tr>
          <tr>
            <td bgcolor="#f8fafc" style="padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Coding Club. All rights reserved.<br/>
                This is an automated message, please do not reply directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

export async function sendVerificationCode(to: string, code: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping OTP email. OTP was:', code)
    return { success: true }
  }

  const content = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Verify Your Identity</h2>
    <p>We received a request to log into the application portal. Your verification code is:</p>
    <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
      <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0f172a;">${code}</span>
    </div>
    <p style="margin-bottom: 0;">This code is valid for <strong>${process.env.OTP_EXPIRY_MINUTES || '10'} minutes</strong>. If you did not request this, please ignore this email.</p>
  `

  try {
    const { data, error } = await resend.emails.send({
      from: `Coding Club Admissions <${fromEmail}>`,
      to,
      subject: 'Your Verification Code',
      html: emailContainer(content),
    })
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err }
  }
}

export async function sendAdminInvite(to: string, tempPasswordRaw: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping admin invite. Password:', tempPasswordRaw)
    return { success: true }
  }

  const content = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Admin Invitation</h2>
    <p>You have been invited to manage the Coding Club Admissions system as an administrator.</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;"><strong>Email (User ID):</strong></p>
      <p style="margin: 0 0 16px 0; color: #0f172a; font-size: 16px;">${to}</p>
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;"><strong>Temporary Password:</strong></p>
      <p style="margin: 0; color: #0f172a; font-size: 16px; font-family: monospace;">${tempPasswordRaw}</p>
    </div>
    <p>Please log in immediately and update your password securely via the dashboard profile settings.</p>
  `

  try {
    const { data, error } = await resend.emails.send({
      from: `Coding Club Admissions <${fromEmail}>`,
      to,
      subject: 'Admin Invitation to Coding Club',
      html: emailContainer(content),
    })
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err }
  }
}

export async function sendStudentCredentials(to: string, emailId: string, passwordRaw: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping student credentials. Password:', passwordRaw)
    return { success: true }
  }

  const content = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Application Created Successfully</h2>
    <p>Your application account has been set up. You can now log into the student portal to submit your project repositories and track your application status.</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;"><strong>Portal User ID:</strong></p>
      <p style="margin: 0 0 16px 0; color: #0f172a; font-size: 16px;">${emailId}</p>
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;"><strong>Generated Password:</strong></p>
      <p style="margin: 0; color: #0f172a; font-size: 18px; font-family: monospace; background-color: #e2e8f0; padding: 4px 8px; border-radius: 4px; display: inline-block;">${passwordRaw}</p>
    </div>
    <p>We recommend changing your password right after logging in. Best of luck with your application!</p>
  `

  try {
    const { data, error } = await resend.emails.send({
      from: `Coding Club Admissions <${fromEmail}>`,
      to,
      subject: 'Your Application Portal Credentials',
      html: emailContainer(content),
    })
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err }
  }
}

export async function sendMessageToDeveloper(fromStudentEmail: string, usn: string, message: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping message to dev.')
    return { success: true }
  }

  const content = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Platform Support Request</h2>
    <p>A candidate has submitted a message from the portal.</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Candidate USN:</strong> ${usn}</p>
      <p style="margin: 0 0 16px 0;"><strong>Reply-To:</strong> <a href="mailto:${fromStudentEmail}">${fromStudentEmail}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
      <p style="margin: 0; white-space: pre-wrap; color: #334155; font-family: monospace; font-size: 14px;">${message}</p>
    </div>
  `

  try {
    const { data, error } = await resend.emails.send({
      from: `Coding Club Admissions <${fromEmail}>`,
      to: process.env.DEVELOPER_EMAIL || 'admin@example.com',
      replyTo: fromStudentEmail,
      subject: `Support Request [USN: ${usn}]`,
      html: emailContainer(content),
    })
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err }
  }
}

export async function sendResultNotification(to: string, resultDetails: string) {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping result notification.')
    return { success: true }
  }

  const content = `
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Evaluation Complete</h2>
    <p>Your application evaluation has been completed by our team.</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <div style="margin: 0; white-space: pre-wrap; font-size: 15px; color: #334155;">
        ${resultDetails}
      </div>
    </div>
    <p>Log in to your student dashboard to view full details and any follow-up questions from the team.</p>
  `

  try {
    const { data, error } = await resend.emails.send({
      from: `Coding Club Admissions <${fromEmail}>`,
      to,
      subject: 'Application Evaluation Status Updated',
      html: emailContainer(content),
    })
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err }
  }
}
