# Short Term Rental Portal - Setup Guide

Complete setup guide for your member and admin portal for short-term rental property management.

## 🚀 Features

- ✅ **Secure Authentication** - Login system with role-based access control
- ✅ **Admin Portal** - Manage properties, generate invoices, update KPIs, invite users
- ✅ **Member Portal** - View revenue metrics, download invoices, track performance
- ✅ **Email Notifications** - Automatic invoice emails to clients
- ✅ **Historical Charts** - Interactive data visualization for 12-month trends
- ✅ **Row-Level Security** - Supabase RLS policies protect all data
- ✅ **Audit Trails** - Track all changes to sensitive data
- ✅ **Mobile Responsive** - Works perfectly on all devices

## 📋 Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- A Resend account for emails (free tier works)
- A domain for sending emails (optional but recommended)

## 🛠️ Step 1: Supabase Database Setup

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to initialize
3. Note your **Project URL** and **anon public key** from Settings > API

### 1.2 Run the Database Schema

1. Open the SQL Editor in your Supabase dashboard
2. Copy the entire contents of `supabase-schema.sql` in this repo
3. Paste and run it in the SQL Editor
4. This creates all tables, RLS policies, functions, triggers, and indexes

### 1.3 Verify the Setup

Run this query to verify tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- audit_logs
- bookings
- invoices
- invoice_payments
- kpis
- ledger_entries
- org_memberships
- organizations
- plans
- profiles
- properties

### 1.4 Create Your First Organization (Sample Data)

```sql
-- Insert a test organization
INSERT INTO organizations (id, name) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Test Property LLC');

-- Create a plan for this org
INSERT INTO plans (org_id, tier, percent, effective_date) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'elevate', 18, '2025-01-01');

-- Add sample KPIs for current month
INSERT INTO kpis (
  org_id, month, gross_revenue_cents, expenses_cents,
  net_revenue_cents, nights_booked, properties,
  occupancy_rate, vacancy_rate
) VALUES
  (
    '550e8400-e29b-41d4-a716-446655440000',
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    1500000, 300000, 1200000, 45, 2, 0.85, 0.15
  );
```

## 🔐 Step 2: Resend Email Setup

### 2.1 Create Resend Account

1. Go to [resend.com](https://resend.com) and sign up
2. Verify your account
3. Get your API key from the dashboard

### 2.2 (Optional) Add Your Domain

For production, add your domain:
1. Go to Domains in Resend dashboard
2. Add your domain (e.g., `yourdomain.com`)
3. Add the DNS records they provide
4. Verify the domain

For testing, you can use `onboarding@resend.dev` as the sender.

## ⚙️ Step 3: Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Site URL (for emails and redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Resend Email
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Your Rental Company <noreply@yourdomain.com>
EMAIL_REPLY_TO=support@yourdomain.com
```

**Important**: Never commit `.env.local` to git! It's already in `.gitignore`.

### Finding Your Supabase Keys:

1. **Project URL**: Settings > API > Project URL
2. **Anon Key**: Settings > API > Project API keys > `anon` `public`
3. **Service Role Key**: Settings > API > Project API keys > `service_role` (⚠️ Keep secret!)

## 📦 Step 4: Install Dependencies

```bash
npm install
```

This installs:
- Next.js 15
- React 19
- Supabase client libraries
- Resend for emails
- Recharts for data visualization
- TypeScript and Tailwind CSS

## 🚀 Step 5: Run the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 👥 Step 6: Create Your First User

### Option A: Using Supabase Dashboard

1. Go to Authentication > Users in Supabase
2. Click "Add user" > "Create new user"
3. Enter email and password
4. The user is auto-confirmed

### Option B: Using the Admin API Endpoint

Once you have at least one user, you can use the admin portal to invite others.

### Link User to Organization

```sql
-- Link your user to the test organization
INSERT INTO org_memberships (user_id, org_id, role)
VALUES (
  'YOUR_USER_ID_FROM_SUPABASE_AUTH',
  '550e8400-e29b-41d4-a716-446655440000',
  'owner'
);
```

To find your user ID:
1. Go to Authentication > Users in Supabase
2. Click on your user
3. Copy the UUID from the ID field

## 🎯 Step 7: Test the Portal

### Member Portal

1. Visit [http://localhost:3000/login](http://localhost:3000/login)
2. Login with your credentials
3. You'll be redirected to `/portal/550e8400-e29b-41d4-a716-446655440000`
4. You should see:
   - KPI cards (gross revenue, expenses, etc.)
   - Click any metric to see historical charts
   - Invoices section (empty initially)

### Admin Portal

1. Visit [http://localhost:3000/admin/550e8400-e29b-41d4-a716-446655440000](http://localhost:3000/admin/550e8400-e29b-41d4-a716-446655440000)
2. You can:
   - Invite new members
   - Change the plan (Launch/Elevate/Maximize)
   - Generate invoices for any month
   - Record payments

### Generate Your First Invoice

1. In the admin portal, under "Generate invoice"
2. Select current month (YYYY-MM format)
3. Click "Generate"
4. An invoice will be created and an email sent to the org owner
5. Check the invoices section in the member portal

## 🎨 Customization

### Update Company Branding

Edit these files to customize your branding:

1. **Email Template**: `src/lib/email/resend.ts`
   - Update colors in the gradient
   - Change company name
   - Modify email copy

2. **Portal Headers**:
   - Member: `src/components/portal/PortalClient.tsx`
   - Admin: `src/app/admin/[orgid]/page.tsx`

### Change Color Scheme

Current colors use purple gradient (`#667eea` to `#764ba2`). To change:

1. Search for `667eea` and `764ba2` in the codebase
2. Replace with your brand colors
3. Update chart colors in `src/components/portal/MetricChart.tsx`

## 📊 Adding Data

### Method 1: Through Admin Portal (Recommended)

1. Create ledger entries at `/admin/{orgId}/entries`
2. These roll up into KPIs automatically
3. Generate invoices monthly

### Method 2: Direct SQL (For Bulk Import)

```sql
-- Add KPIs for multiple months
INSERT INTO kpis (org_id, month, gross_revenue_cents, expenses_cents, net_revenue_cents, nights_booked, properties, occupancy_rate, vacancy_rate)
VALUES
  ('YOUR_ORG_ID', '2025-08-01', 1400000, 280000, 1120000, 42, 2, 0.80, 0.20),
  ('YOUR_ORG_ID', '2025-09-01', 1500000, 300000, 1200000, 45, 2, 0.85, 0.15),
  ('YOUR_ORG_ID', '2025-10-01', 1600000, 320000, 1280000, 48, 2, 0.90, 0.10);
```

## 🔒 Security Checklist

- ✅ RLS policies enabled on all tables
- ✅ Service role key kept secret (never exposed to client)
- ✅ Authentication required for all portal routes
- ✅ Audit logs track all data changes
- ✅ Role-based access (owner/manager/member)
- ✅ Users can only access their organization's data

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables from `.env.local`
5. Deploy!

**Important**: Update `NEXT_PUBLIC_SITE_URL` to your production domain:
```
NEXT_PUBLIC_SITE_URL=https://yourapp.vercel.app
```

### Other Platforms

The app works on any platform that supports Next.js:
- Netlify
- Railway
- Render
- AWS Amplify

## 📱 Mobile Testing

The portal is fully responsive. Test on:
- iPhone (Safari)
- Android (Chrome)
- Tablet devices

## 🐛 Troubleshooting

### "Supabase env missing" Error
- Check that `.env.local` exists and has correct keys
- Restart the dev server after adding env vars

### RLS Policy Denies Access
- Verify user is linked to an org in `org_memberships` table
- Check the user's role (owner/manager/member)
- Ensure RLS policies are enabled

### Email Not Sending
- Verify `RESEND_API_KEY` is correct
- Check Resend dashboard for error logs
- For production, ensure your domain is verified

### Charts Not Loading
- Open browser console for errors
- Verify historical KPI data exists in database
- Check that `api/orgs/{orgid}/kpis/history` endpoint works

## 📚 API Routes

### Public Endpoints
- `GET /api/kpis?org={uuid}&month={YYYY-MM}` - Get KPIs for org/month

### Protected Endpoints (Require Auth)
- `GET /api/orgs/{orgid}/kpis/history?months=12` - Historical KPIs
- `POST /api/orgs/{orgid}/invoices/generate` - Generate invoice
- `GET /api/orgs/{orgid}/invoices/list` - List invoices
- `GET /api/invoices/{id}/pdf` - Download invoice PDF
- `POST /api/invoices/{id}/payments` - Record payment

### Admin Endpoints
- `POST /api/admin/users/create` - Invite new user
- `POST /api/orgs/{orgid}/plan` - Update org plan

## 🎓 Next Steps

1. **Add More Properties**: Insert into `properties` table
2. **Import Historical Data**: Bulk insert KPIs for past months
3. **Customize Email**: Update branding in email template
4. **Add Analytics**: Consider adding Google Analytics
5. **Set Up Backups**: Enable Supabase automatic backups
6. **Add Payment Integration**: Stripe for online payments (future)

## 💡 Tips

- Use the `?month=YYYY-MM` query parameter to view different months
- Audit logs are automatically created for all changes
- Invoices are idempotent - generating twice returns same invoice
- Charts show up to 12 months of history
- Mobile users see card-based invoice layout

## 🆘 Support

If you need help:
1. Check browser console for errors
2. Check Supabase logs (Dashboard > Logs)
3. Verify environment variables
4. Ensure database schema ran successfully

## 📄 License

This project is for your business use. Customize as needed!

---

**Built with**: Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase, Resend, Recharts
