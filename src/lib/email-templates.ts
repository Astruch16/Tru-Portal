// TruHost Branded Email Templates
// Colors: Sage Green (#E1ECDB, #9db896), Warm Off-White (#F8F6F2), Dark (#2c2c2c)

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #2c2c2c;
`;

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TruHost Notification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F6F2; ${baseStyles}">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #9db896 0%, #E1ECDB 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #2c2c2c; letter-spacing: 1px;">TruHost</h1>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #2c2c2c; font-weight: 500;">Property Management Ltd.</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F6F2; padding: 30px; text-align: center; border-top: 1px solid #E1ECDB;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #5a5a5a;">
                © ${new Date().getFullYear()} TruHost. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #5a5a5a;">
                This is an automated notification from your TruHost portal.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const button = (text: string, url: string) => `
  <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #9db896 0%, #E1ECDB 100%); color: #2c2c2c; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0;">
    ${text}
  </a>
`;

const infoBox = (content: string) => `
  <div style="background-color: #F8F6F2; border-left: 4px solid #9db896; padding: 16px 20px; margin: 20px 0; border-radius: 6px;">
    ${content}
  </div>
`;

// Template: Member Invitation
export function memberInvitationEmail(data: {
  recipientName: string;
  organizationName: string;
  inviterName: string;
  loginUrl: string;
  email: string;
  temporaryPassword: string;
  planTier?: string;
}) {
  const planNames = {
    launch: 'Launch Plan (12%)',
    elevate: 'Elevate Plan (18%)',
    maximize: 'Maximize Plan (22%)',
  };

  const planDisplay = data.planTier && planNames[data.planTier as keyof typeof planNames]
    ? planNames[data.planTier as keyof typeof planNames]
    : null;

  const content = `
    <h1 style="margin: 0 0 20px 0; font-size: 28px; color: #2c2c2c; font-weight: 700;">
      Welcome to TruHost!
    </h1>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      Hi ${data.recipientName},
    </p>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      ${data.inviterName} has invited you to join the TruHost Property Management Portal. Details below as follows:
    </p>
    ${infoBox(`
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #2c2c2c;">
        <strong>📧 Your Login Credentials:</strong>
      </p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;">
        <strong>Email:</strong> ${data.email}
      </p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;">
        <strong>Temporary Password:</strong> <code style="background-color: #e5e5e5; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${data.temporaryPassword}</code>
      </p>
      ${planDisplay ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;">
        <strong>Your Plan:</strong> ${planDisplay}
      </p>` : ''}
      <p style="margin: 12px 0 0 0; font-size: 13px; color: #666; font-style: italic;">
        ⚠️ Please change your password after logging in for the first time. You can do this in your profile settings.
      </p>
    `)}
    <p style="font-size: 16px; color: #2c2c2c; margin: 20px 0 8px 0;">
      <strong>What you can do:</strong>
    </p>
    <p style="font-size: 14px; color: #2c2c2c; margin: 0 0 16px 0; line-height: 1.8;">
      • View performance metrics and KPIs<br>
      • Access invoices and payment history<br>
      • Track revenue and expenses<br>
      • View receipts and documentation<br>
      • Monitor bookings and occupancy
    </p>
    <p style="font-size: 16px; color: #2c2c2c; margin: 20px 0;">
      Click the button below to access your portal:
    </p>
    <div style="text-align: center;">
      ${button('Access Your Portal', data.loginUrl)}
    </div>
    <p style="font-size: 14px; color: #5a5a5a; margin: 24px 0 0 0;">
      If you have any questions, feel free to reach out to your property manager.
    </p>
  `;

  return {
    subject: `You've been invited to ${data.organizationName} on TruHost`,
    html: emailWrapper(content),
  };
}

// Template: New Booking
export function newBookingEmail(data: {
  recipientName: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  portalUrl: string;
}) {
  const content = `
    <h1 style="margin: 0 0 20px 0; font-size: 28px; color: #2c2c2c; font-weight: 700;">
      New Booking Added
    </h1>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      Hi ${data.recipientName},
    </p>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      A new booking has been added to your property.
    </p>
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Property:</strong> ${data.propertyName}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Check-in:</strong> ${data.checkIn}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Check-out:</strong> ${data.checkOut}</p>
      <p style="margin: 0; font-size: 14px; color: #2c2c2c;"><strong>Nights:</strong> ${data.nights}</p>
    `)}
    <p style="font-size: 16px; color: #2c2c2c; margin: 20px 0;">
      View full details in your portal:
    </p>
    <div style="text-align: center;">
      ${button('View Booking', data.portalUrl)}
    </div>
  `;

  return {
    subject: `New Booking: ${data.propertyName}`,
    html: emailWrapper(content),
  };
}

// Template: New Revenue/Expense Entry
export function newLedgerEntryEmail(data: {
  recipientName: string;
  type: 'revenue' | 'expense';
  propertyName: string;
  amount: string;
  date: string;
  description?: string;
  portalUrl: string;
}) {
  const isRevenue = data.type === 'revenue';
  const content = `
    <h1 style="margin: 0 0 20px 0; font-size: 28px; color: #2c2c2c; font-weight: 700;">
      New ${isRevenue ? 'Revenue' : 'Expense'} Entry
    </h1>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      Hi ${data.recipientName},
    </p>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      A new ${isRevenue ? 'revenue' : 'expense'} entry has been added to your property.
    </p>
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Type:</strong> ${isRevenue ? '💰 Revenue' : '💸 Expense'}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Property:</strong> ${data.propertyName}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Amount:</strong> ${data.amount}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Date:</strong> ${data.date}</p>
      ${data.description ? `<p style="margin: 0; font-size: 14px; color: #2c2c2c;"><strong>Description:</strong> ${data.description}</p>` : ''}
    `)}
    <p style="font-size: 16px; color: #2c2c2c; margin: 20px 0;">
      View full details in your portal:
    </p>
    <div style="text-align: center;">
      ${button('View Portal', data.portalUrl)}
    </div>
  `;

  return {
    subject: `New ${isRevenue ? 'Revenue' : 'Expense'}: ${data.propertyName}`,
    html: emailWrapper(content),
  };
}

// Template: New Invoice
export function newInvoiceEmail(data: {
  recipientName: string;
  organizationName: string;
  invoiceNumber: string;
  billMonth: string;
  amountDue: string;
  status: string;
  portalUrl: string;
}) {
  const content = `
    <h1 style="margin: 0 0 20px 0; font-size: 28px; color: #2c2c2c; font-weight: 700;">
      New Invoice Available
    </h1>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      Hi ${data.recipientName},
    </p>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      A new invoice has been added to your TruHost Portal.
    </p>
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Billing Month:</strong> ${data.billMonth}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Amount Due:</strong> ${data.amountDue}</p>
      <p style="margin: 0; font-size: 14px; color: #2c2c2c;"><strong>Status:</strong> ${data.status}</p>
    `)}
    <p style="font-size: 16px; color: #2c2c2c; margin: 20px 0;">
      View and download your invoice:
    </p>
    <div style="text-align: center;">
      ${button('View Invoice', data.portalUrl)}
    </div>
  `;

  return {
    subject: `New Invoice: ${data.invoiceNumber}`,
    html: emailWrapper(content),
  };
}

// Template: Paid Invoice
export function paidInvoiceEmail(data: {
  recipientName: string;
  organizationName: string;
  invoiceNumber: string;
  billMonth: string;
  amountPaid: string;
  portalUrl: string;
}) {
  const content = `
    <h1 style="margin: 0 0 20px 0; font-size: 28px; color: #10b981; font-weight: 700;">
      Invoice Marked as Paid
    </h1>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      Hi ${data.recipientName},
    </p>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      Great news! Your invoice has been marked as paid in your TruHost Portal.
    </p>
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Billing Month:</strong> ${data.billMonth}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Amount Paid:</strong> ${data.amountPaid}</p>
      <p style="margin: 0; font-size: 14px; color: #10b981;"><strong>✓ Status:</strong> Paid</p>
    `)}
    <p style="font-size: 16px; color: #2c2c2c; margin: 20px 0;">
      Thank you for your payment! You can view your invoice details in your portal:
    </p>
    <div style="text-align: center;">
      ${button('View Invoice', data.portalUrl)}
    </div>
  `;

  return {
    subject: `Invoice Paid: ${data.invoiceNumber}`,
    html: emailWrapper(content),
  };
}

// Template: New Receipt
export function newReceiptEmail(data: {
  recipientName: string;
  propertyName: string;
  category: string;
  month: string;
  fileName: string;
  note?: string;
  portalUrl: string;
}) {
  const content = `
    <h1 style="margin: 0 0 20px 0; font-size: 28px; color: #2c2c2c; font-weight: 700;">
      New Receipt Uploaded
    </h1>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      Hi ${data.recipientName},
    </p>
    <p style="font-size: 16px; color: #2c2c2c; margin: 0 0 16px 0;">
      A new receipt has been uploaded for your property.
    </p>
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Property:</strong> ${data.propertyName}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Category:</strong> ${data.category}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>Month:</strong> ${data.month}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #2c2c2c;"><strong>File:</strong> ${data.fileName}</p>
      ${data.note ? `<p style="margin: 0; font-size: 14px; color: #2c2c2c;"><strong>Note:</strong> ${data.note}</p>` : ''}
    `)}
    <p style="font-size: 16px; color: #2c2c2c; margin: 20px 0;">
      View the receipt in your portal:
    </p>
    <div style="text-align: center;">
      ${button('View Receipt', data.portalUrl)}
    </div>
  `;

  return {
    subject: `New Receipt: ${data.propertyName} - ${data.category}`,
    html: emailWrapper(content),
  };
}
