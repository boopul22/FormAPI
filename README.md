# Netlify Serverless Form API

A lightweight, production-ready Netlify Function for handling multiple form submissions via a single API endpoint.

## 📁 Project Structure

```
Form_api/
├── netlify/
│   └── functions/
│       └── submit-form.js    # Main serverless function
├── netlify.toml              # Netlify configuration
├── package.json              # Dependencies & scripts
└── README.md                 # This file
```

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev
```

The function will be available at:
- `http://localhost:8888/.netlify/functions/submit-form`
- `http://localhost:8888/api/submit-form` (via redirect)

### Deploy to Netlify

```bash
# Connect to Netlify
npx netlify init

# Deploy
npx netlify deploy --prod
```

## 📝 API Usage

### Endpoint

```
POST /api/submit-form
Content-Type: application/json
```

### Request Body

```json
{
  "form_id": "contact",
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello!",
  "_honey": "",
  "_timestamp": "1704067200000"
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "message": "contact form submitted successfully"
}
```

**Error (400/405/500):**
```json
{
  "success": false,
  "error": "Missing required field: email"
}
```

---

## 📋 Example Payloads

### Contact Form
```json
{
  "form_id": "contact",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "message": "I'd like to learn more about your services.",
  "phone": "+1-555-123-4567",
  "company": "Acme Inc"
}
```

### Newsletter Subscription
```json
{
  "form_id": "newsletter",
  "email": "subscriber@example.com",
  "name": "Newsletter Fan",
  "preferences": "weekly"
}
```

### Quote Request
```json
{
  "form_id": "quote",
  "name": "Business User",
  "email": "business@example.com",
  "service_type": "consulting",
  "budget": "$5000-$10000",
  "phone": "+1-555-987-6543",
  "company": "StartupCo",
  "details": "Need help with digital transformation",
  "timeline": "Q1 2024"
}
```

### Callback Request
```json
{
  "form_id": "callback",
  "name": "Urgent Customer",
  "phone": "+1-555-111-2222",
  "preferred_time": "Morning",
  "notes": "Regarding order #12345"
}
```

---

## ➕ Adding a New Form

To add a new form, edit `netlify/functions/submit-form.js` and add a new entry to `FORM_CONFIGS`:

```javascript
const FORM_CONFIGS = {
  // ... existing forms ...

  // NEW FORM
  feedback: {
    requiredFields: ['email', 'rating', 'comments'],
    optionalFields: ['name', 'would_recommend'],
    onSuccess: async (data) => {
      // Custom handling for this form
      console.log('[Feedback] New feedback received:', data);
      
      // Examples of what you can do:
      // await sendEmail({ to: 'feedback@yoursite.com', ... });
      // await triggerWebhook('https://hooks.slack.com/...', data);
      // await appendToGoogleSheet(data);
    }
  }
};
```

That's it! No new function needed. The API will now accept:

```json
{
  "form_id": "feedback",
  "email": "user@example.com",
  "rating": 5,
  "comments": "Great service!"
}
```

---

## 🔒 Security Features

### 1. Honeypot Field
Add a hidden field to your HTML form:

```html
<input type="text" name="_honey" style="display: none;" tabindex="-1" autocomplete="off">
```

Bots fill this field; humans don't. Bot submissions are silently accepted (to not alert the bot) but not processed.

### 2. Timestamp Check
Add a timestamp when the form loads:

```html
<input type="hidden" name="_timestamp" id="form-timestamp">
<script>
  document.getElementById('form-timestamp').value = Date.now();
</script>
```

Submissions under 2 seconds are rejected (likely bots).

### 3. Input Sanitization
All text inputs are sanitized to prevent XSS attacks.

### 4. Field Validation
- Required field checks
- Email format validation
- Phone format validation
- Extensible for custom validators

---

## 🔌 Extension Examples

### Send Email (using Nodemailer)

```javascript
// Add to submit-form.js
const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, body }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: '"Form API" <noreply@yoursite.com>',
    to,
    subject,
    text: JSON.stringify(body, null, 2)
  });
}
```

### Trigger Webhook

```javascript
async function triggerWebhook(url, data) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}
```

### Save to CSV (using external service like Airtable/Google Sheets)

```javascript
async function saveToAirtable(data) {
  await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE}/Submissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.AIRTABLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: data })
  });
}
```

---

## 🌐 Frontend Integration Example

```html
<form id="contact-form">
  <input type="text" name="name" required placeholder="Your Name">
  <input type="email" name="email" required placeholder="Email">
  <textarea name="message" required placeholder="Message"></textarea>
  
  <!-- Honeypot (hidden) -->
  <input type="text" name="_honey" style="display: none;" tabindex="-1">
  <input type="hidden" name="_timestamp" id="timestamp">
  
  <button type="submit">Send</button>
</form>

<script>
  document.getElementById('timestamp').value = Date.now();
  
  document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.form_id = 'contact';
    
    try {
      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('Thank you! Your message has been sent.');
        e.target.reset();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
  });
</script>
```

---

## 📄 Environment Variables (Optional)

Set these in Netlify Dashboard → Site Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server for email |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `AIRTABLE_KEY` | Airtable API key |
| `AIRTABLE_BASE` | Airtable base ID |
| `SLACK_WEBHOOK` | Slack webhook URL |

---

## ✅ Production Checklist

- [ ] Configure CORS origin in `submit-form.js` (replace `*` with your domain)
- [ ] Set up environment variables for any integrations
- [ ] Add rate limiting if needed (Netlify offers this via their plans)
- [ ] Implement actual email/webhook/storage handlers
- [ ] Add logging to external service if needed
