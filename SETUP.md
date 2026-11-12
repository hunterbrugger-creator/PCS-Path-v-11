# Setting up the PCS Path backend

PCS Path runs in two modes:

- **Demo mode** (what you get with no setup). Everything works, with fictional
  people, and data is saved only in the browser you are using. Good for showing
  people the idea.
- **Live mode.** Real accounts, a real database, and changes that everyone sees
  across phones and computers. It uses **Supabase**, a hosted Postgres
  database with sign-in built in. The free tier is plenty for a pilot.

Plan on about 20 minutes for the steps below.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> and sign up. GitHub sign-in is fine.
2. Click **New project**. Name it `pcs-path`, choose a strong database password
   (save it in your password manager), and pick the region closest to your users.
3. Wait a minute or two while it starts up.

## 2. Create the database

1. In the project, open **SQL Editor** → **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo, copy all of it,
   paste it in, and click **Run**. It should finish with "Success. No rows returned".

This creates every table, the security rules that decide who can see and change
what, and a starter list of bases. RAF Mildenhall is the only base switched on.

## 3. Turn on sign-in

1. Open **Authentication** → **URL Configuration**.
2. Set **Site URL** to where the app will live, for example
   `https://hunterbrugger-creator.github.io/PCS-Path-v-11/` (see step 6).
3. Under **Redirect URLs**, add that same address. If you will also test on your
   own computer, add `http://localhost:8765/` as well.
4. Open **Authentication** → **Providers** → **Email**. It is on by default.
   - **Confirm email** is on by default, so new users must tap a link in an email
     before they can sign in. Some `.mil` inboxes filter these emails. For a small
     pilot you can switch it off. MPF approval still controls who gets a checklist.

## 4. Connect the app

1. Open **Project Settings** → **API** (also listed as **API Keys**).
2. Copy the **Project URL** and the **anon / publishable** key.
3. Paste both into [`config.js`](config.js):

   ```js
   window.PCS_CONFIG = {
     supabaseUrl: 'https://abcdefgh.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...'
   };
   ```

The anon key is designed to be public. The security rules from step 2 protect the
data. **Never** paste the `service_role` / secret key into the app.

## 5. Make yourself the first admin

1. Open the app and choose **Create an account**. Sign up with your own email,
   and pick your base, which must be one that is switched on.
2. Back in Supabase, open **SQL Editor** → **New query** and run this, using your email:

   ```sql
   update public.profiles
   set roles = array['global','mpf','member'], status = 'active'
   where email = 'your.email@example.com';
   ```

3. In the app, tap **Check again**. You now have Member, Base MPF and Global admin.
4. As **Base MPF** → **Master list**, tap **Load starter checklist**. It loads the
   RAF Mildenhall checklist, offices, reminder rules and tips for your base. Edit
   anything that differs at your base.
5. As **Global admin** → **Bases**, switch on any other bases that should accept
   sign-ups, or add new ones.

After that, everything happens in the app:

- **Sign-ups.** New members appear under **Base MPF → Profiles** to approve.
- **Staff roles.** Give people Office worker, Office lead, Counselor, Commander or
  Sponsor roles under **Base MPF → Users**, and link workers and leads to their office.
- **Role requests.** People can also ask for a role from their Profile tab, and the
  request lands with the MPF.

## 6. Put the app online with GitHub Pages (free)

1. On GitHub, open the repo → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*,
   **Branch** to `main`, and the folder to `/ (root)`. Click **Save**.
3. After a minute the address appears at the top of that page, for example
   `https://hunterbrugger-creator.github.io/PCS-Path-v-11/`.

On a phone, open that address and choose **Add to Home Screen**. The app then
opens like a normal app and keeps working offline with the last data it loaded.

## Running it on your own computer

From the repo folder:

```bash
ruby -run -e httpd . -p 8765
```

Then open <http://localhost:8765>.

---

## What runs where

| Piece | Where it lives |
| --- | --- |
| Screens, logic, offline support | `index.html`, `app.js`, `sw.js` (GitHub Pages) |
| Talking to the database, offline queue | `store.js` |
| Starter checklist and demo people | `seed.js` |
| Accounts, data, security rules | Supabase (`supabase/schema.sql`) |

## Before real Airmen use it

The free Supabase plan is fine for a pilot with test data or a few volunteers.
Before a whole base uses it, talk to your wing **Privacy Office** and
**Cybersecurity / ISSM**. A system holding Air Force members' information on a
commercial cloud usually needs DoD cloud authorization and a privacy review. The
app does not ask for DoD ID numbers or SSNs, so don't add fields for them.

## Not built yet

- **Reminders come only inside the app.** They are created when a member opens it.
  Email or push reminders would need a scheduled Supabase Edge Function.
- **No document uploads yet.** The Documents tab is a checklist. Real uploads
  would use Supabase Storage.
- **Live updates arrive when you reopen or switch back to the app**, not instantly.
  Supabase Realtime could make them instant.
