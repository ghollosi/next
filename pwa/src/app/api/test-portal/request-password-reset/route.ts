import { NextRequest, NextResponse } from 'next/server';

// This endpoint notifies the admin that a tester requested password reset
// In a real system, this would send an email to admin or auto-reset
// For now, we just acknowledge the request

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Log the request (in production, this would notify the admin)
    console.log(`Password reset requested for: ${email}`);

    // In a real implementation, this would:
    // 1. Check if email exists in testers
    // 2. Generate new password
    // 3. Send email with new password
    // 4. Update the tester record

    // For now, we just return success
    // Admin can manually regenerate password in admin panel
    return NextResponse.json({
      success: true,
      message: 'Password reset request received',
    });
  } catch (error) {
    console.error('Error processing password reset:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
