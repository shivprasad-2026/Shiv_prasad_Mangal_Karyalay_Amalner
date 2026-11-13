# Shivprasad Mangal Karyalay — Firebase Auth + Firestore Live Sync + Cloudinary

## What this build does
- Admin can sign in from any laptop or mobile using the same Firebase Authentication email/password account.
- Firebase Authentication keeps the signed-in session on that browser/device.
- Only the configured Admin UID can edit or upload content.
- Photos upload to Cloudinary `image/upload`; videos and audio upload to Cloudinary `video/upload`.
- Cloudinary secure URLs and venue content are saved in Firestore document `venue/content`.
- Firestore `onSnapshot()` updates every open website in real time without manual refresh.
- Customers can submit reviews for Admin approval. Private submissions are stored in `reviews`; only approved, mobile-number-free copies are published to `publicReviews`.
- Admin review actions (approve, reject, edit, delete) are realtime and restricted by Firestore Rules to the configured Admin UID.
- Existing website layout, Marathi content, CSS theme, gallery categories and sections are retained.

## 1) Cloudinary setup (required before uploads)
1. Open Cloudinary Console → Settings → Upload → Upload presets.
2. Create or select an upload preset and set Signing Mode to **Unsigned**.
3. Make sure the preset permits unsigned image and video uploads.
4. Copy the exact preset name.
5. In `app.js`, replace `PASTE_UNSIGNED_UPLOAD_PRESET_NAME` in `CLOUDINARY_UPLOAD_PRESET` with that exact name.
6. The cloud name is already set to `pax1kv7j`.

Do not put Cloudinary API Secret in browser JavaScript. Unsigned uploads are protected by Cloudinary preset restrictions and account upload limits; for a production site, consider a signed-upload backend.

## 2) Firebase Authentication setup (required for Admin Login)
1. Firebase Console → Authentication → Get started.
2. Sign-in method → enable **Email/Password**.
3. Ensure the existing Admin Authentication user is the account with UID:
   `xum1AX3wZcW69Hf7fSNhh2KL0hN2`
4. Use that account's email and password on every device. Do not create a different account unless you also change `ADMIN_UID` in `app.js` and Firestore Rules.
5. Each device/browser signs in once; the session is remembered on that device. Login is not automatically shared between devices.

## 3) Firestore Rules (publish these)
Firebase Console → Firestore Database → Rules. Replace the rules with the complete contents of [`firestore.rules`](./firestore.rules), then click **Publish**.

The rules let unauthenticated customers create only validated `pending` documents in `reviews`. Only the specified signed-in Admin UID can read/manage submissions or write approved copies to `publicReviews`. Public clients can read only approved `publicReviews` documents; those copies do not contain mobile numbers. The `venue/content` behavior remains public-read/Admin-write. Do not use open `allow read, write: if true` rules.

## 4) Customer Reviews
1. Publish the Firestore Rules above before testing submissions.
2. Open the public site's **Write a Review** form and submit a name, 1–5 star rating, and message. A mobile number is optional.
3. Sign in with the authorized Admin account and open **Manage Reviews**.
4. Approve a review to publish it, or reject, edit, or delete it. Only approved reviews appear publicly. Approval and edits synchronize through Firestore in real time.
5. Test from a separate browser/device: submit as a visitor, verify pending reviews are not public, then approve as Admin and verify the public card, average, and count update.

## 5) Run / deploy
- Serve `index.html` from a web server (for example VS Code Live Server); do not open it as `file://`.
- Deploy the full `Shiv` folder to the same hosting service as the existing website.
- After deployment, test Admin Login, image upload, video upload, Save, and a second device/browser to confirm live sync.

## Important notes
- The app code is prepared for the Admin UID above, but Firebase Console configuration (Email/Password provider, existing account, Firestore Rules) and Cloudinary unsigned preset must be completed by the project owner.
- This code cannot verify your Firebase/Cloudinary console settings or perform a live upload from this environment.
- Existing audio-file upload uses Cloudinary's video resource type; a public HTTPS audio URL can also be used.
