import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Prevent self-revocation
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot revoke your own admin access' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // We can remove the admin role by overriding app_metadata
    // or just omitting the role. We'll set it to 'student' or null.
    const { data: targetUser, error: targetError } = await adminClient.auth.admin.getUserById(userId)
    if (targetError || !targetUser.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updatedAppMetadata = { ...targetUser.user.app_metadata }
    delete updatedAppMetadata.role

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: updatedAppMetadata
    })

    if (updateError) {
      console.error('Error revoking admin:', updateError)
      return NextResponse.json({ error: 'Failed to revoke admin role' }, { status: 500 })
    }

    await adminClient.from('audit_log').insert({
      id: crypto.randomUUID(),
      actor_user_id: user.id,
      action: 'revoke_admin',
      payload: { revoked_user_id: userId, revoked_email: targetUser.user.email || null }
    })

    return NextResponse.json({ success: true, message: 'Admin role revoked' })
  } catch (error: any) {
    console.error('Error in POST /api/admin/revoke-admin:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
