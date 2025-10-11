// src/lib/email/resend.ts
import { Resend } from 'resend';

// Initialize Resend client
export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set in environment variables');
  }
  return new Resend(apiKey);
}

// Email configuration
export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'Your Rental Company <noreply@yourdomain.com>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@yourdomain.com',
};

// Type definitions
export interface SendInvoiceEmailParams {
  to: string;
  orgName: string;
  invoiceNumber: string;
  month: string;
  amountDue: string;
  invoiceUrl: string;
  portalUrl: string;
}

/**
 * Send invoice notification email to client
 */
export async function sendInvoiceNotification(params: SendInvoiceEmailParams) {
  const resend = getResendClient();

  const subject = `New Invoice ${params.invoiceNumber} - ${params.month}`;

  const html = generateInvoiceEmailHTML(params);
  const text = generateInvoiceEmailText(params);

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: params.to,
      replyTo: EMAIL_CONFIG.replyTo,
      subject,
      html,
      text,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    throw error;
  }
}

/**
 * Generate HTML email template for invoice
 */
function generateInvoiceEmailHTML(params: SendInvoiceEmailParams): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.invoiceNumber}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">New Invoice Available</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">

    <p style="font-size: 16px; margin-bottom: 20px;">Hello ${params.orgName},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      Your invoice for <strong>${params.month}</strong> is now available in your member portal.
    </p>

    <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Invoice Number:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${params.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Billing Period:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${params.month}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount Due:</td>
          <td style="padding: 8px 0; font-weight: 600; font-size: 18px; color: #667eea; text-align: right;">${params.amountDue}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.portalUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View in Portal</a>
    </div>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${params.invoiceUrl}" style="color: #667eea; text-decoration: none; font-size: 14px;">Download PDF Invoice</a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">
      Questions about your invoice? Reply to this email or contact us at ${EMAIL_CONFIG.replyTo}
    </p>

    <p style="font-size: 14px; color: #6b7280; margin: 0;">
      Thank you for your business!
    </p>

  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Your Rental Company. All rights reserved.</p>
  </div>

</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of email
 */
function generateInvoiceEmailText(params: SendInvoiceEmailParams): string {
  return `
New Invoice Available

Hello ${params.orgName},

Your invoice for ${params.month} is now available in your member portal.

Invoice Details:
- Invoice Number: ${params.invoiceNumber}
- Billing Period: ${params.month}
- Amount Due: ${params.amountDue}

View in Portal: ${params.portalUrl}
Download PDF: ${params.invoiceUrl}

Questions about your invoice? Reply to this email or contact us at ${EMAIL_CONFIG.replyTo}

Thank you for your business!

© ${new Date().getFullYear()} Your Rental Company. All rights reserved.
  `.trim();
}
