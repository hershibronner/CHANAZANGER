# Mamanew website (Vercel)

- `index.html`: the website, with booking under **Book a class**.
- `admin.html`: Chana's admin, at **yoursite.vercel.app/admin.html** (also linked as "Admin" in the footer).
- `api/index.js`: the server code that saves bookings, messages and settings.

## Setup on Vercel (one time, about 5 minutes)

### 1. Deploy the files
Put this folder in your GitHub repo, the one Vercel already deploys from, replacing the old site files. Vercel redeploys automatically.
(Or, from this folder: `npx vercel --prod`.)

You don't need to change any build settings. Leave the framework as **Other** with no build command. `vercel.json` handles the rest.

### 2. Connect a database (free)
Vercel → your project → **Storage** tab → **Create Database** → choose **Upstash for Redis** (free plan) → **Connect** it to this project.
Vercel adds the connection settings for you automatically (`KV_REST_API_URL` and `KV_REST_API_TOKEN`).

### 3. Set the admin password
Vercel → your project → **Settings → Environment Variables → Add**:
- Key: `ADMIN_PASSWORD`
- Value: the password Chana will use

### 4. Redeploy
**Deployments** → the latest one → **⋯ → Redeploy**, so the new settings take effect.

Then open `yoursite.vercel.app/admin.html` and log in.

## What the admin does
- **Group classes:** post dates, set the number of spots (default 5), and see who signed up. Mark who has paid, add someone manually, close registration, or hide a class.
- **Private times:** add the dates and times you're available. Moms pick one on the site's calendar and it's held for them.
- **Messages:** everything sent through the website's contact form.
- **Payments:** paste Stripe, Square or PayPal payment links and set prices.

To change the password, edit `ADMIN_PASSWORD` in Vercel and redeploy.

## Freebies (free downloads)
The **Freebies** section offers the Birth Affirmation Cards and the Hospital Bag Checklist (PDFs are in the `freebies/` folder).
When a mom enters her email, the download opens right away and she's saved under **Subscribers** in the admin, along with whether she joined the newsletter. Use **Copy newsletter emails** to paste the list into Mailchimp, Flodesk, or any email tool.

**Optional: also email the download automatically**
1. Create a free account at resend.com and verify your domain (for example mamanew.com).
2. In Vercel → Settings → Environment Variables, add:
   - `RESEND_API_KEY`: your Resend API key
   - `MAIL_FROM`: e.g. `Chana at Mamanew <hello@mamanew.com>`
3. Redeploy. From then on, each mom also gets a friendly email with her download link.

To add a new freebie later, put the PDF in `freebies/`, add it to `FREEBIES` in `shared/core.mjs`, and add a card in the Freebies section of `index.html`.

## Preview mode
Opened anywhere other than the live site (your computer, a preview link), the pages run on sample data saved in that browser only. The preview admin password is `demo`.
