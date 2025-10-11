# Portal Redesign & New Features - Implementation Plan

## ✅ Completed
- Database schema with RLS
- Email notifications
- Historical charts
- Mobile responsive design
- shadcn/ui dependencies installed
- Color scheme updated (soft whites & greens)
- Button component created

## 🚀 What's Next

### 1. User Creation (ALREADY EXISTS!)
**Good news**: Your admin portal already has user creation!

In `/admin/[orgid]` there's an "Invite member" section where you can:
- Enter email
- Set temporary password
- Assign role (owner/manager/member)
- Create user instantly without going to Supabase

### 2. Complete shadcn/ui Component Library
Create these components in `src/components/ui/`:

- `card.tsx` - For metric cards
- `avatar.tsx` - For profile pictures
- `input.tsx` - Form inputs
- `label.tsx` - Form labels
- `select.tsx` - Dropdowns
- `dialog.tsx` - Modals
- `separator.tsx` - Dividers
- `badge.tsx` - Status badges

### 3. Profile Section for Members
Create `/portal/[orgid]/profile` page with:

#### Features:
- **Avatar Upload** - Upload to Supabase Storage
- **Username** - Editable display name
- **Current Plan** - Display tier (Launch/Elevate/Maximize)
- **Properties List** - Show Airbnb names assigned by admin

#### Database Changes Needed:
```sql
-- Add username to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Create user_properties junction table
CREATE TABLE IF NOT EXISTS user_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  airbnb_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

-- Enable RLS
ALTER TABLE user_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their properties"
  ON user_properties FOR SELECT
  USING (auth.uid() = user_id);
```

### 4. Admin Property Assignment
Update admin portal to assign properties to users:

#### Add New Section:
```typescript
// In admin portal, add:
<div>
  <h2>Assign Properties to Users</h2>
  <select>{/* Select user */}</select>
  <select>{/* Select property */}</select>
  <input placeholder="Airbnb listing name" />
  <button>Assign Property</button>
</div>
```

#### API Endpoint:
Create `/api/admin/user-properties/assign/route.ts`

### 5. Redesign Member Portal
Use the new shadcn components:

```tsx
// Example structure
<div className="min-h-screen bg-background">
  <header className="border-b border-border bg-card">
    <div className="container mx-auto px-4 py-4">
      <h1 className="text-2xl font-bold text-foreground">Member Portal</h1>
    </div>
  </header>

  <main className="container mx-auto px-4 py-8">
    <Card>
      <CardHeader>
        <CardTitle>Gross Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-primary">$15,000</p>
      </CardContent>
    </Card>
  </main>
</div>
```

### 6. Redesign Admin Portal
Same shadcn theme with primary green accent.

### 7. Avatar Upload to Supabase Storage

#### Setup:
1. Create storage bucket in Supabase: `avatars`
2. Set public access
3. Create upload API:

```typescript
// /api/profile/avatar/route.ts
export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('avatar') as File

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(`${userId}/${Date.now()}.${ext}`, file)

  // Update profile with avatar_url
  await supabase
    .from('profiles')
    .update({ avatar_url: data.path })
    .eq('id', userId)
}
```

## 📁 Files to Create

1. **shadcn Components** (8 files)
   - `src/components/ui/card.tsx`
   - `src/components/ui/avatar.tsx`
   - `src/components/ui/input.tsx`
   - `src/components/ui/label.tsx`
   - `src/components/ui/select.tsx`
   - `src/components/ui/dialog.tsx`
   - `src/components/ui/separator.tsx`
   - `src/components/ui/badge.tsx`

2. **Profile Pages**
   - `src/app/portal/[orgid]/profile/page.tsx` - Profile view/edit
   - `src/components/profile/AvatarUpload.tsx` - Avatar component
   - `src/components/profile/ProfileForm.tsx` - Edit form

3. **API Routes**
   - `src/app/api/profile/avatar/route.ts` - Avatar upload
   - `src/app/api/profile/update/route.ts` - Update profile
   - `src/app/api/admin/user-properties/assign/route.ts` - Assign properties
   - `src/app/api/admin/user-properties/list/route.ts` - List assignments

4. **Database Migration**
   - `supabase-profile-migration.sql` - Add username & user_properties table

5. **Redesigned Portals**
   - Update `src/components/portal/PortalClient.tsx` with shadcn
   - Update `src/app/admin/[orgid]/page.tsx` with shadcn

## 🎨 Design System

### Colors (Already Set!)
- **Primary Green**: `#4a7c59`
- **Secondary**: `#e8f5e9`
- **Background**: `#fafdf9` (soft off-white)
- **Card**: `#ffffff`
- **Border**: `#d4e7d7`

### Typography
- Use `font-sans` (Geist Sans)
- Headings: `font-bold`
- Body: `font-normal`

### Spacing
- Container: `max-w-7xl mx-auto px-4`
- Sections: `py-8`
- Cards: `p-6`

## 🔄 Priority Order

1. ✅ **Database migration** - Add username & user_properties
2. ✅ **Create shadcn components** - Build UI library
3. ✅ **Profile page** - Member can view/edit profile
4. ✅ **Avatar upload** - Implement file upload
5. ✅ **Admin property assignment** - Admin assigns properties
6. ✅ **Redesign member portal** - Apply new design
7. ✅ **Redesign admin portal** - Apply new design

## 💡 Quick Wins

The user creation already works! Just use the "Invite member" section in the admin portal.

For the redesign, you can start by copying the shadcn component code from [ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components) and adapting it to your needs.

## 🆘 Need Help?

Ask me to:
1. Create any specific component
2. Build the profile page
3. Implement avatar upload
4. Create the database migration
5. Redesign specific pages

Let me know what you'd like to tackle first!
