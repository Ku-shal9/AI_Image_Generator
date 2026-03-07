# Photo Galli

AI-powered image generator with user authentication, rate limiting, and a retro-themed interface. Users can generate images from text prompts using Hugging Face models (via Netlify Functions) or Puter.ai as a fallback.

---

## Features

- **Image generation**: Text-to-image via Hugging Face (FLUX, SDXL, Stable Diffusion) or Puter.ai
- **Authentication**: User and admin roles, guest mode, sign up, OTP-based password reset via EmailJS
- **Rate limiting**: Per-user generation limits (guest: 2, free: 6, configurable for paid plans)
- **Gallery**: Save generated images, view in Photos page, download, delete
- **Prompt history**: Sidebar with searchable history, click to reuse prompts
- **Admin panel**: User management, rate limit adjustment, prompt/gallery inspection
- **Theme**: Dark/light mode with localStorage persistence
- **Responsive layout**: Mobile-friendly navbar, collapsible sidebar

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Styling | Bootstrap 5 (grid/utilities), custom modular CSS |
| Auth | localStorage-based session, EmailJS for OTP emails |
| Image API | Hugging Face Inference API (via Netlify Function), Puter.ai (fallback) |
| Hosting | Netlify (static site + serverless functions) |

---

## Architecture

### Application Flow

```
                    +------------------+
                    |   Sign-in Page   |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
        [Guest Mode]                 [User/Admin]
              |                             |
              v                             v
    +------------------+          +------------------+
    |  Home (limited)   |          |  Home (full)     |
    +------------------+          +------------------+
              |                             |
              +--------------+--------------+
                             |
                             v
                    +------------------+
                    | Generate Image   |
                    +--------+---------+
                             |
                    +--------+--------+
                    |                 |
              [Netlify]          [Puter.ai]
              (Hugging Face)     (fallback)
```

### Image Generation Flow

```
+----------+     POST prompt,seed      +---------------------+
| Browser  | -----------------------> | Netlify Function    |
| (app.js) |                          | generate-image.js    |
+----------+                          +----------+----------+
      |                                        |
      | (if localhost: skip, use Puter)         | HF_TOKEN from env
      |                                        v
      |                               +---------------------+
      |                               | Hugging Face API    |
      |                               | (FLUX/SDXL/SD v1.5) |
      |                               +----------+----------+
      |                                          |
      | <-------- base64 image ------------------+
      |
      v
+----------+
| Display  |
| Download |
| Save     |
+----------+
```

### Authentication Flow

```
+------------------+
| Sign-in Page     |
+--------+---------+
         |
         +---> [Sign In] ---> validate credentials ---> save session ---> redirect
         |
         +---> [Forgot Password]
                    |
                    v
              +------------------+
              | Enter username   |
              +--------+---------+
                       |
                       v
              +------------------+
              | Generate OTP     |
              | Send via EmailJS |
              +--------+---------+
                       |
                       v
              +------------------+
              | Enter OTP        |
              +--------+---------+
                       |
                       v
              +------------------+
              | New password     |
              | Reset complete   |
              +------------------+
```

### Page Structure

```
index.html (Home)
    |
    +-- Prompt input, generate button, rate limit bar
    +-- Fresh image section (display, download, save to gallery)
    +-- Sidebar (prompt history)

html/
    +-- signin.html    (Sign in, sign up, forgot password, guest mode)
    +-- about.html    (Project info, how it works)
    +-- photos.html   (Gallery grid, modal view, delete)
    +-- pricing.html  (Plan cards, upgrade CTA)
    +-- admin.html    (User table, create user, rate limits, user details)
```

---

## Project Structure

```
AI_Image_Generator/
|-- index.html              # Home page
|-- html/
|   |-- signin.html
|   |-- about.html
|   |-- photos.html
|   |-- pricing.html
|   |-- admin.html
|-- css/
|   |-- style.css           # Main entry (imports all modules)
|   |-- vars.css            # CSS variables, fonts
|   |-- base.css            # Reset, body, light mode
|   |-- navbar.css
|   |-- layout.css
|   |-- sidebar.css
|   |-- cards.css
|   |-- forms.css
|   |-- buttons.css
|   |-- loading.css
|   |-- alerts.css
|   |-- image.css
|   |-- profile.css
|   |-- gallery.css
|   |-- modal.css
|   |-- auth.css
|   |-- about.css
|   |-- admin.css
|   |-- sections.css
|   |-- rate.css
|   |-- utils.css
|   |-- effects.css
|   |-- footer.css
|   |-- payment.css
|   |-- guest.css
|   |-- anims.css
|   |-- sidebar-btns.css
|   |-- responsive.css
|-- js/
|   |-- auth-const.js       # Constants, seed, user CRUD
|   |-- auth-session.js     # Session management
|   |-- auth-guest.js       # Guest mode
|   |-- auth-core.js        # Sign in/out, rate limit, history, gallery
|   |-- auth-theme.js       # Theme toggle
|   |-- auth-nav.js         # Guards, redirects, navbar
|   |-- auth-profile.js     # Profile picture, password change
|   |-- auth-user.js        # Username, email, admin reset
|   |-- auth-otp.js         # OTP, EmailJS
|   |-- auth.js             # Init (seed)
|   |-- app-dom.js          # DOM refs, HF config
|   |-- app-main.js         # Generate, UI, profile modal
|   |-- app.js              # Home page init
|   |-- gallery.js          # Photos page
|   |-- admin.js            # Admin panel
|-- netlify/
|   |-- functions/
|       |-- generate-image.js   # HF proxy (server-side token)
|-- README.md
```

---

## Prerequisites

- Node.js 18+ (for Netlify CLI, optional)
- Netlify account (for deployment)
- Hugging Face account (for HF_TOKEN)
- EmailJS account (for OTP password reset)

---

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd AI_Image_Generator
   ```

2. Open `index.html` in a browser, or serve the folder with any static server (e.g. Live Server, `python -m http.server`).

3. For full image generation locally (Hugging Face), use Netlify Dev:
   ```
   npm install -g netlify-cli
   netlify dev
   ```
   Then open the URL shown (e.g. http://localhost:8888).

---

## Environment Variables

Configure these in the Netlify dashboard (Site settings > Environment variables):

| Variable | Description | Required |
|----------|-------------|----------|
| HF_TOKEN | Hugging Face API token (read) | Yes (for HF generation) |

EmailJS credentials are in `auth-const.js` (service ID, template ID, public key). For production, consider moving these to environment variables.

---

## Deployment (Netlify)

1. Connect the repository to Netlify.
2. Build settings: leave build command empty; publish directory: `.` (or project root).
3. Add `HF_TOKEN` in Environment variables.
4. Deploy.

Netlify auto-detects `netlify/functions/` for serverless functions.

---

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| User | demo | demo123 |

---

## Local vs Production Behavior

- **On Netlify**: Image generation uses the Netlify function, which calls Hugging Face with `HF_TOKEN`. If that fails, Puter.ai is used as fallback.
- **On localhost**: The app skips the Netlify function (it returns 405) and uses Puter.ai directly. To test Hugging Face locally, run `netlify dev`.

---

## Modular Design

- **CSS**: `style.css` imports 26 modular files (vars, base, navbar, layout, sidebar, cards, forms, buttons, etc.). Each file has a short comment describing its scope.
- **JavaScript**: Auth logic is split into 10 modules (`auth-const`, `auth-session`, `auth-guest`, etc.); app logic into 3 (`app-dom`, `app-main`, `app`). Load order is defined in each HTML page.

---

## License

All rights reserved.
