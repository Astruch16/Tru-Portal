# Email Notifications - Implementation Guide

## ✅ Completed
1. **Email Templates** - Created branded TruHost email templates (`src/lib/email-templates.ts`)
2. **Email Utility Functions** - Created email sending functions (`src/lib/email.ts`)
3. **Member Invitation Emails** - ✅ Implemented in `src/app/api/admin/users/create/route.ts`
4. **Booking Creation Emails** - ✅ Implemented in `src/app/api/orgs/[orgid]/bookings/route.ts`

## 🔨 Remaining Implementations

### 3. Ledger Entry Emails (Revenue/Expense)
**File**: `src/app/api/orgs/[orgid]/ledger/route.ts`

Add to the POST endpoint after successful insert:

```typescript
import { getOrgMemberEmails, sendNewLedgerEntryEmail } from '@/lib/email';

// After successful ledger entry insert:
try {
  const members = await getOrgMemberEmails(orgId);
  if (members.length > 0) {
    const propertyName = (data.properties as any)?.name || 'Unknown Property';
    const isRevenue = data.amount_cents > 0;

    await sendNewLedgerEntryEmail({
      recipientEmails: members.map(m => m.email),
      recipientName: members[0].name,
      type: isRevenue ? 'revenue' : 'expense',
      propertyName,
      amount: `$${Math.abs(data.amount_cents / 100).toFixed(2)}`,
      date: new Date(data.entry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      description: data.description,
      orgId,
    });
  }
} catch (emailError) {
  console.error('Failed to send ledger entry notification:', emailError);
}
```

### 4. Invoice Emails
**File**: `src/app/api/orgs/[orgid]/invoices/route.ts`

Add to the POST endpoint after successful invoice creation:

```typescript
import { getOrgMemberEmails, sendNewInvoiceEmail } from '@/lib/email';

// After successful invoice insert:
try {
  const members = await getOrgMemberEmails(orgId);
  if (members.length > 0) {
    // Get org name
    const { data: orgData } = await admin.from('organizations').select('name').eq('id', orgId).single();
    const orgName = orgData?.name || 'Your Organization';

    await sendNewInvoiceEmail({
      recipientEmails: members.map(m => m.email),
      recipientName: members[0].name,
      organizationName: orgName,
      invoiceNumber: data.invoice_number || `INV-${data.id.slice(0, 8)}`,
      billMonth: new Date(data.bill_month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      amountDue: `$${(data.amount_due_cents / 100).toFixed(2)}`,
      status: data.status,
      orgId,
    });
  }
} catch (emailError) {
  console.error('Failed to send invoice notification:', emailError);
}
```

### 5. Receipt Upload Emails
**File**: `src/app/api/orgs/[orgid]/receipts/upload/route.ts`

Add after successful receipt upload (around line 120, after database insert):

```typescript
import { getOrgMemberEmails, sendNewReceiptEmail } from '@/lib/email';

// After successful receipt database insert:
try {
  const members = await getOrgMemberEmails(orgId);
  if (members.length > 0) {
    // Get property name
    const { data: propertyData } = await admin.from('properties').select('name').eq('id', propertyId).single();
    const propertyName = propertyData?.name || 'Unknown Property';

    // Format month from receipt_date
    let monthDisplay = 'N/A';
    if (receiptDate) {
      const [year, month] = receiptDate.split('-').map(Number);
      const date = new Date(year, month - 1, 15);
      monthDisplay = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    await sendNewReceiptEmail({
      recipientEmails: members.map(m => m.email),
      recipientName: members[0].name,
      propertyName,
      category: description || 'Uncategorized',
      month: monthDisplay,
      fileName: file.name,
      note: note || undefined,
      orgId,
    });
  }
} catch (emailError) {
  console.error('Failed to send receipt notification:', emailError);
}
```

## Testing Checklist

After implementing all endpoints, test each notification:

- [ ] Create a new member - check invitation email
- [ ] Add a booking - check booking notification
- [ ] Add revenue entry - check revenue notification
- [ ] Add expense entry - check expense notification
- [ ] Create an invoice - check invoice notification
- [ ] Upload a receipt - check receipt notification

## Environment Variables Required

Make sure these are set in `.env.local`:

```
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=TruHost <noreply@yourdomain.com>
EMAIL_REPLY_TO=support@truhost.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # or your production URL
```

## Email Design

All emails use TruHost branding:
- **Primary Color**: #E1ECDB (Sage Green)
- **Accent Color**: #9db896 (Darker Sage)
- **Background**: #F8F6F2 (Warm Off-White)
- **Text**: #2c2c2c (Dark Gray)
- **Logo**: `/truhost-logo.png`

Emails are responsive and mobile-friendly with clean, professional design.
