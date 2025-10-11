# Setup Checklist

Use this checklist to complete your portal setup.

## ✅ Database Setup

- [ ] Run `supabase-schema.sql` in Supabase SQL Editor
- [ ] Verify all tables created (check with `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)
- [ ] Create your first organization
- [ ] Add sample KPI data for testing

## ✅ Environment Configuration

- [ ] Get Resend API key from [resend.com/api-keys](https://resend.com/api-keys)
- [ ] Update `RESEND_API_KEY` in `.env.local`
- [ ] Update `EMAIL_FROM` with your company name
- [ ] Update `EMAIL_REPLY_TO` with your support email
- [ ] (Optional) Add and verify your domain in Resend

## ✅ User Setup

- [ ] Create first user in Supabase Authentication
- [ ] Link user to organization in `org_memberships` table
- [ ] Set user role to 'owner'
- [ ] Test login at `/login`

## ✅ Testing

- [ ] Can login successfully
- [ ] Member portal shows KPI data
- [ ] Click a metric card - chart modal opens
- [ ] Admin portal loads correctly
- [ ] Generate test invoice
- [ ] Verify email sent (check inbox and Resend logs)
- [ ] Invoice appears in member portal
- [ ] Test on mobile device (responsive design)

## ✅ Customization

- [ ] Update company name in email template (`src/lib/email/resend.ts`)
- [ ] Customize portal headers with your branding
- [ ] Update color scheme if desired
- [ ] Adjust plan percentages if needed

## ✅ Production Preparation

- [ ] Push code to GitHub
- [ ] Set up Vercel/Netlify account
- [ ] Add production environment variables
- [ ] Update `NEXT_PUBLIC_SITE_URL` to production URL
- [ ] Verify domain in Resend for production emails
- [ ] Enable Supabase backups
- [ ] Test production deployment

## ✅ Ongoing Operations

- [ ] Add historical KPI data for past months
- [ ] Generate invoices monthly
- [ ] Monitor email delivery
- [ ] Review audit logs periodically
- [ ] Back up database regularly

## 🎯 Next Steps After Setup

1. **Import Your Data**
   - Add your actual properties
   - Import historical KPIs
   - Set correct pricing plans

2. **Invite Your Clients**
   - Use admin portal to invite users
   - Send them login instructions
   - Set appropriate roles

3. **Monthly Workflow**
   - Update KPIs for the month
   - Generate invoices
   - Emails sent automatically
   - Track payments

4. **Monitor & Maintain**
   - Check audit logs for changes
   - Monitor email delivery rates
   - Review client portal usage
   - Keep database backed up

## 📞 Need Help?

- **Database issues**: Check Supabase logs
- **Email problems**: Check Resend dashboard
- **Authentication issues**: Verify org_memberships table
- **Chart not loading**: Check browser console

Refer to `SETUP.md` for detailed troubleshooting.

---

**Pro Tip**: Start with sample data first, then replace with real data once everything works!
