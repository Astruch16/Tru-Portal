# Quick Start Guide

Get your portal running in 10 minutes!

## ⚡ Step 1: Database (2 min)

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Open SQL Editor
3. Copy and run `supabase-schema.sql`

## 🔑 Step 2: Environment Variables (1 min)

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=Your Company <noreply@yourdomain.com>
EMAIL_REPLY_TO=support@yourdomain.com
```

Get keys from Supabase: **Settings > API**
Get Resend key from: [resend.com](https://resend.com/api-keys)

## 📦 Step 3: Install & Run (2 min)

```bash
npm install
npm run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

## 👤 Step 4: Create User (2 min)

In Supabase:
1. **Authentication > Users > Add user**
2. Enter email/password
3. Copy the user ID

In SQL Editor:

```sql
-- Create org
INSERT INTO organizations (id, name) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'My Rental Co');

-- Link user to org
INSERT INTO org_memberships (user_id, org_id, role) VALUES
  ('PASTE_YOUR_USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', 'owner');

-- Add plan
INSERT INTO plans (org_id, tier, percent) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'elevate', 18);

-- Add sample data
INSERT INTO kpis (org_id, month, gross_revenue_cents, expenses_cents, net_revenue_cents, nights_booked, properties, occupancy_rate, vacancy_rate)
VALUES ('550e8400-e29b-41d4-a716-446655440000', DATE_TRUNC('month', CURRENT_DATE)::DATE, 1500000, 300000, 1200000, 45, 2, 0.85, 0.15);
```

## ✅ Step 5: Login & Test (3 min)

1. Go to [http://localhost:3000/login](http://localhost:3000/login)
2. Login with your credentials
3. You're in! 🎉

**Member Portal**: View metrics, click cards for charts
**Admin Portal**: [http://localhost:3000/admin/550e8400-e29b-41d4-a716-446655440000](http://localhost:3000/admin/550e8400-e29b-41d4-a716-446655440000)

## 🎯 Common Tasks

### Generate an Invoice
1. Go to Admin Portal
2. Under "Generate invoice", enter month (YYYY-MM)
3. Click "Generate"
4. Email sent automatically!

### View Historical Charts
1. Member portal
2. Click any metric card
3. See 12-month trend

### Add More Data
```sql
-- Add KPIs for past months
INSERT INTO kpis (org_id, month, gross_revenue_cents, expenses_cents, net_revenue_cents, nights_booked, properties, occupancy_rate, vacancy_rate)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', '2025-09-01', 1400000, 280000, 1120000, 42, 2, 0.80, 0.20),
  ('550e8400-e29b-41d4-a716-446655440000', '2025-08-01', 1300000, 260000, 1040000, 40, 2, 0.75, 0.25);
```

### Invite a Member
1. Admin Portal > "Invite member"
2. Enter email, password, role
3. Click "Invite member"
4. They can now login!

## 🚢 Deploy to Production

### Vercel (Easiest)
```bash
# Push to GitHub
git add .
git commit -m "Initial commit"
git push

# Then on vercel.com:
# 1. Import GitHub repo
# 2. Add environment variables
# 3. Deploy!
```

Don't forget to update:
```env
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

## 🆘 Problems?

**Can't login?**
- Check user exists in Supabase Auth
- Check org_memberships links user to org

**No data showing?**
- Run sample SQL queries above
- Check browser console for errors

**Emails not sending?**
- Verify RESEND_API_KEY
- Check Resend dashboard for logs

**Need more help?**
- See full `SETUP.md` guide
- Check browser console
- Check Supabase logs

---

That's it! You're ready to manage your rental properties. 🏡
