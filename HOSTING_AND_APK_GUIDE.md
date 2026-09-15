# 🚀 Free Hosting & Mobile APK Generation Guide

This guide details how to host **The Artisan Drop** 100% freely online and provide a direct downloadable **Android APK** or installable app for your users.

---

## 1. 🌐 100% Free Cloud Hosting (Recommended: Render.com)

[Render.com](https://render.com) offers a **Free Web Service** tier that runs Python Flask web apps with automatic HTTPS (`https://your-app-name.onrender.com`).

### Everything has already been pre-configured in your project:
- ✅ `requirements.txt`: Includes `gunicorn` and `dnspython` for production.
- ✅ `Procfile`: Ready (`web: gunicorn app:app`).
- ✅ `render.yaml`: Ready for instant blueprint setup.

### Step-by-Step Instructions to Deploy to Render:

1. **Push your code to GitHub**:
   - Create a free GitHub repository (public or private).
   - In your project directory:
     ```powershell
     git init
     git add .
     git commit -m "Complete Artisan Bakery app"
     git remote add origin https://github.com/your-username/your-repo-name.git
     git push -u origin main
     ```

2. **Deploy on Render**:
   - Go to [https://render.com](https://render.com) and create a free account (Sign in with GitHub).
   - Click **New +** &rarr; **Web Service**.
   - Select your GitHub repository.
   - Configure the following settings:
     - **Name**: `artisan-bakery` (or your preferred name)
     - **Environment**: `Python 3`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `gunicorn app:app`
     - **Instance Type**: **Free**
   - Click **Advanced** &rarr; **Add Environment Variables**:
     | Key | Value |
     | :--- | :--- |
     | `MONGODB_URI` | *Your MongoDB Atlas connection string from `.env`* |
     | `ADMIN_EMAIL` | `reddirohitabc@gmail.com` |
     | `GMAIL_USER` | `reddirohitabc@gmail.com` |
     | `GMAIL_APP_PASS` | `ywuw dajc wxeu qgel` |
     | `SECRET_KEY` | `bakery_secret_key_2026` |
     | `PORT` | `10000` |
   - Click **Deploy Web Service**!
   - In 2–3 minutes, your store will be live on a public URL like:
     **`https://artisan-bakery.onrender.com`** with free SSL!

---

## 2. 📱 How to Get the Downloadable Android APK

You have **two great methods** to provide the app to mobile users:

### Method A: Free APK Builder via PWABuilder (Recommended)
Once your app is hosted live (e.g. `https://artisan-bakery.onrender.com`):
1. We have already added:
   - `static/manifest.json` (defines app icons, name, theme colors)
   - `static/sw.js` (Service Worker for standalone mobile experience)
2. Visit **[https://www.pwabuilder.com](https://www.pwabuilder.com)** (100% Free tool built by Microsoft).
3. Paste your live Render URL (e.g. `https://artisan-bakery.onrender.com`) and click **Start**.
4. Click **Package for Stores** &rarr; select **Android**.
5. Click **Generate Package / Download APK**.
6. PWABuilder will automatically compile and give you a signed `.apk` file (`artisan-bakery.apk`)!
7. You can host this file right in `static/downloads/artisan-bakery.apk` and give anyone a direct download link, or upload it to Google Drive / GitHub Releases!

### Method B: Instant Install on Android (PWA - No App Store Required)
When anyone opens your live store on their Android phone in Chrome:
1. Chrome displays an **"Install App"** / **"Add to Home screen"** prompt.
2. It installs straight to their phone like a native app with the croissant logo and opens in full screen without the browser address bar!

---

## 3. 🛠️ Search Bar Autofill Fix

We have resolved the issue where your phone number was appearing automatically in the search bar:
- Added `autocomplete="off"`, `autocorrect="off"`, `autocapitalize="off"`, and `spellcheck="false"`.
- Explicitly reset the search query and input value on page load.
- Added an instant clear button (`✕`) inside the search bar.
