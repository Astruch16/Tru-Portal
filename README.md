# Short-Term Rental Management Portal

A professional **member and admin portal** for managing short-term rental properties. Built with Next.js 15, React 19, TypeScript, Supabase, and Resend.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-green)

## ✨ Features

### 🏠 Member Portal
- **Dashboard** with real-time KPIs (gross revenue, net revenue, expenses, occupancy rates)
- **Interactive Charts** - Click any metric to see 12-month historical trends
- **Invoice Management** - View, download, and track invoices
- **Mobile Responsive** - Perfect experience on all devices
- **Secure Access** - Row-level security ensures users only see their data

### 🛠️ Admin Portal
- **Invoice Generation** - Create invoices with automatic email notifications
- **User Management** - Invite clients and assign roles (owner/manager/member)
- **Plan Management** - Set pricing tiers (Launch 12%, Elevate 18%, Maximize 22%)
- **Payment Tracking** - Record and manage payments
- **Data Entry** - Update KPIs and manage properties

### 🔐 Security & Compliance
- **Row-Level Security (RLS)** - Supabase policies protect all data
- **Audit Trails** - Automatic logging of all data changes
- **Role-Based Access** - Owner, Manager, and Member permissions
- **Authenticated Routes** - Middleware protects all portal pages

### 📧 Email Notifications
- **Automatic Invoices** - Beautiful HTML emails sent when invoices are generated
- **Branded Templates** - Professional design with your company colors
- **PDF Attachments** - Direct links to invoice PDFs

### 📊 Data Visualization
- **Recharts Integration** - Beautiful, responsive line charts
- **12-Month History** - Track trends over time
- **Summary Statistics** - Latest, average, highest, and lowest values
- **Click-to-View** - Modal charts for deep dives

## 🚀 Quick Start

**See [QUICK-START.md](./QUICK-START.md) for a 10-minute setup guide.**

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)
- Resend account for emails (free tier works)

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <your-repo>
   cd my-portal
   npm install
   ```

2. **Set up Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - Run `supabase-schema.sql` in the SQL Editor
   - Copy your project URL and keys

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your keys
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Visit** [http://localhost:3000](http://localhost:3000)

For detailed setup instructions, see [SETUP.md](./SETUP.md)

## 📁 Project Structure

```
my-portal/
├── src/
│   ├── app/
│   │   ├── admin/[orgid]/          # Admin portal pages
│   │   ├── portal/[orgid]/         # Member portal pages
│   │   ├── api/                    # API routes
│   │   │   ├── orgs/[orgid]/       # Org-specific endpoints
│   │   │   └── invoices/           # Invoice endpoints
│   │   ├── login/                  # Authentication
│   │   └── layout.tsx
│   ├── components/
│   │   └── portal/
│   │       ├── MetricChart.tsx     # Interactive charts
│   │       └── PortalClient.tsx    # Member portal UI
│   ├── lib/
│   │   ├── email/
│   │   │   └── resend.ts           # Email service
│   │   └── supabase/               # Supabase clients
│   └── middleware.ts               # Auth protection
├── supabase-schema.sql             # Complete database schema
├── SETUP.md                        # Detailed setup guide
├── QUICK-START.md                  # 10-minute quick start
└── .env.local                      # Environment variables
```

## 🗄️ Database Schema

The schema includes:
- **organizations** - Your clients/properties
- **org_memberships** - User-to-org relationships with roles
- **kpis** - Monthly performance metrics
- **invoices** - Client invoices with status tracking
- **plans** - Pricing tier configuration
- **audit_logs** - Change tracking for compliance
- **properties**, **bookings**, **ledger_entries** - Detailed data

All tables protected with Row-Level Security policies.

## 🎨 Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Email**: Resend
- **Charts**: Recharts
- **Deployment**: Vercel (recommended)

## 📸 Screenshots

### Member Portal
- Clean dashboard with KPI cards
- Click any metric to see historical chart
- Mobile-optimized invoice table

### Admin Portal
- Invoice generation with email notifications
- User invitation system
- Plan management interface

## 🔧 Configuration

### Email Customization
Edit `src/lib/email/resend.ts` to customize:
- Company name and branding
- Email template colors
- Email copy and messaging

### Branding
Update these files for custom branding:
- `src/components/portal/PortalClient.tsx` - Member portal header
- `src/app/admin/[orgid]/page.tsx` - Admin portal header
- `src/components/portal/MetricChart.tsx` - Chart colors

### Plans/Tiers
Default tiers in database:
- **Launch**: 12% management fee
- **Elevate**: 18% management fee
- **Maximize**: 22% management fee

Update in admin portal or directly in database.

## 🚢 Deployment

### Vercel (Recommended)
```bash
# Connect to GitHub
git remote add origin <your-repo>
git push -u origin main

# Deploy on Vercel
# 1. Import repository
# 2. Add environment variables from .env.local
# 3. Update NEXT_PUBLIC_SITE_URL to production URL
# 4. Deploy!
```

Also works on: Netlify, Railway, Render, AWS Amplify

## 📚 API Documentation

### Public Endpoints
- `GET /api/kpis?org={uuid}&month={YYYY-MM}`

### Protected Endpoints
- `GET /api/orgs/{orgid}/kpis/history?months=12`
- `POST /api/orgs/{orgid}/invoices/generate`
- `GET /api/orgs/{orgid}/invoices/list`
- `GET /api/invoices/{id}/pdf`

See [SETUP.md](./SETUP.md#-api-routes) for complete API documentation.

## 🐛 Troubleshooting

**Can't login?**
- Verify user exists in Supabase Auth
- Check org_memberships table links user to org

**No data showing?**
- Add sample data (see QUICK-START.md)
- Check browser console for errors

**Emails not sending?**
- Verify RESEND_API_KEY is correct
- Check Resend dashboard for error logs

See [SETUP.md](./SETUP.md#-troubleshooting) for more help.

## 🤝 Contributing

This is a private business tool. Customize as needed for your rental company!

## 📄 License

Proprietary - For your business use only.

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend as a service
- [Resend](https://resend.com/) - Email API
- [Recharts](https://recharts.org/) - Data visualization
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

**Ready to get started?** Follow the [QUICK-START.md](./QUICK-START.md) guide!
