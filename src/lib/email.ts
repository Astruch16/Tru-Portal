import { Resend } from 'resend';
import {
  memberInvitationEmail,
  newBookingEmail,
  newLedgerEntryEmail,
  newInvoiceEmail,
  newReceiptEmail,
} from './email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'TruHost <noreply@yourdomain.com>';

export async function sendMemberInvitationEmail(data: {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  inviterName: string;
  orgId: string;
}) {
  const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/portal/${data.orgId}`;

  const emailContent = memberInvitationEmail({
    recipientName: data.recipientName,
    organizationName: data.organizationName,
    inviterName: data.inviterName,
    loginUrl,
  });

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.recipientEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    });
    console.log('✓ Member invitation email sent to:', data.recipientEmail);
  } catch (error) {
    console.error('Failed to send member invitation email:', error);
    throw error;
  }
}

export async function sendNewBookingEmail(data: {
  recipientEmails: string[];
  recipientName: string;
  propertyName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  orgId: string;
}) {
  const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/portal/${data.orgId}`;

  const emailContent = newBookingEmail({
    recipientName: data.recipientName,
    propertyName: data.propertyName,
    guestName: data.guestName,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    nights: data.nights,
    portalUrl,
  });

  try {
    for (const email of data.recipientEmails) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
      });
      console.log('✓ New booking email sent to:', email);
    }
  } catch (error) {
    console.error('Failed to send new booking email:', error);
    throw error;
  }
}

export async function sendNewLedgerEntryEmail(data: {
  recipientEmails: string[];
  recipientName: string;
  type: 'revenue' | 'expense';
  propertyName: string;
  amount: string;
  date: string;
  description?: string;
  orgId: string;
}) {
  const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/portal/${data.orgId}`;

  const emailContent = newLedgerEntryEmail({
    recipientName: data.recipientName,
    type: data.type,
    propertyName: data.propertyName,
    amount: data.amount,
    date: data.date,
    description: data.description,
    portalUrl,
  });

  try {
    for (const email of data.recipientEmails) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
      });
      console.log(`✓ New ${data.type} email sent to:`, email);
    }
  } catch (error) {
    console.error('Failed to send ledger entry email:', error);
    throw error;
  }
}

export async function sendNewInvoiceEmail(data: {
  recipientEmails: string[];
  recipientName: string;
  organizationName: string;
  invoiceNumber: string;
  billMonth: string;
  amountDue: string;
  status: string;
  orgId: string;
}) {
  const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/portal/${data.orgId}`;

  const emailContent = newInvoiceEmail({
    recipientName: data.recipientName,
    organizationName: data.organizationName,
    invoiceNumber: data.invoiceNumber,
    billMonth: data.billMonth,
    amountDue: data.amountDue,
    status: data.status,
    portalUrl,
  });

  try {
    for (const email of data.recipientEmails) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
      });
      console.log('✓ New invoice email sent to:', email);
    }
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    throw error;
  }
}

export async function sendNewReceiptEmail(data: {
  recipientEmails: string[];
  recipientName: string;
  propertyName: string;
  category: string;
  month: string;
  fileName: string;
  note?: string;
  orgId: string;
}) {
  const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/portal/${data.orgId}`;

  const emailContent = newReceiptEmail({
    recipientName: data.recipientName,
    propertyName: data.propertyName,
    category: data.category,
    month: data.month,
    fileName: data.fileName,
    note: data.note,
    portalUrl,
  });

  try {
    for (const email of data.recipientEmails) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
      });
      console.log('✓ New receipt email sent to:', email);
    }
  } catch (error) {
    console.error('Failed to send receipt email:', error);
    throw error;
  }
}

// Helper function to get all member emails for an organization
export async function getOrgMemberEmails(orgId: string): Promise<Array<{ email: string; name: string }>> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // Get all org members
  const { data: memberships } = await admin
    .from('org_memberships')
    .select('user_id')
    .eq('org_id', orgId);

  if (!memberships || memberships.length === 0) {
    return [];
  }

  // Get user emails from auth.users
  const { data: users } = await admin.auth.admin.listUsers();

  const memberEmails = users.users
    .filter(user => memberships.some(m => m.user_id === user.id))
    .map(user => ({
      email: user.email!,
      name: user.user_metadata?.full_name || user.email!.split('@')[0],
    }));

  return memberEmails;
}
