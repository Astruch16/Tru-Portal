import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET() {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    console.log('Testing email with Resend...');
    console.log('API Key exists:', !!process.env.RESEND_API_KEY);
    console.log('EMAIL_FROM:', process.env.EMAIL_FROM);

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'TruHost <onboarding@resend.dev>',
      to: 'info@truhost.ca',
      subject: 'Test Email from TruHost',
      html: '<h1>Test Email</h1><p>If you receive this, Resend is working!</p>',
    });

    console.log('Email send result:', result);

    return NextResponse.json({
      success: true,
      result,
      message: 'Check your email and Resend dashboard!'
    });
  } catch (error) {
    console.error('Email test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
