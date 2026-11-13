import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, where,
  orderBy, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1V7qffQ9-qfVMlFXECUsy74vC7HnOvRA",
  authDomain: "shivprasad-mangal-karyalay.firebaseapp.com",
  projectId: "shivprasad-mangal-karyalay",
  storageBucket: "shivprasad-mangal-karyalay.appspot.com",
  messagingSenderId: "134205032642",
  appId: "1:134205032642:web:af8623e9aeb3e62b63935b"
};

(() => {
  "use strict";

  // Cloudinary unsigned preset must be created in Cloudinary Console > Settings > Upload.
  const CLOUDINARY_CLOUD_NAME = "pax1kv7j";
  const CLOUDINARY_UPLOAD_PRESET = "shivprasad_upload";
  // Only this Firebase Authentication user is allowed to edit the venue content.
  const ADMIN_UID = "xum1AX3wZcW69Hf7fSNhh2KL0hN2";

  let db = null;
  let auth = null;
  let authPersistenceReady = Promise.resolve();
  let currentAdmin = null;
  let contentRef = null;
  try {
    if (Object.values(firebaseConfig).some(value => !value.trim())) {
      throw new Error("Firebase configuration is incomplete.");
    }
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    contentRef = doc(db, "venue", "content");
    authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch(error => {
      console.warn("Could not set persistent admin sign-in.", error);
    });
  } catch (error) {
    console.warn("Firebase is not configured; showing the initial venue content.", error);
  }
  const categories = {
    stage: "लग्न हॉल व स्टेज",
    dining: "जेवण कक्ष / डायनिंग",
    rooms: "खोल्या / रूम्स",
    parking: "बाहेरील परिसर व पार्किंग",
    other: "इतर"
  };
  let publicReviews = [];
  let adminReviews = [];
  let reviewFilter = "all";
  let editingReviewId = null;
  let stopAdminReviewListener = null;
  const initialData = {
    settings: {
      title: "शिवप्रसाद मंगल कार्यालय - भव्य व अविस्मरणीय लग्न सोहळ्यांचे दालन",
      announcement: "",
      address: "हेडावे रोड, नियर गणपती नगर",
      phone: "+91 9503007852",
      phone2: "+91 9422233236",
      phone3: "+91 9130070011",
      email: "pavankumbhar425@gmail.com",
      music: ""
    },
    imageReplacements: {},
    media: [
      { id: "sample-stage-1", type: "image", category: "stage", alt: "भव्य लग्न हॉल आणि स्टेज", url: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=82", fallback: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=82" },
      { id: "sample-dining-1", type: "image", category: "dining", alt: "सुसज्ज आणि प्रशस्त जेवण कक्ष", url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=82", fallback: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=82" },
      { id: "sample-room-1", type: "image", category: "rooms", alt: "पांढऱ्या चादरीसह प्रशस्त मास्टर बेडरूम", url: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82", fallback: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82" },
      { id: "sample-exterior-1", type: "image", category: "parking", alt: "कार्यालयाचा बाहेरील परिसर", url: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=82", fallback: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=82" },
      { id: "sample-stage-2", type: "image", category: "stage", alt: "मंगल सोहळ्याची सुंदर सजावट", url: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=82" },
      { id: "sample-dining-2", type: "image", category: "dining", alt: "समारंभातील जेवणाची मेजवानी", url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=82" },
      { id: "sample-room-2", type: "image", category: "rooms", alt: "सुसज्ज आणि स्वच्छ रूम", url: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=82" },
      { id: "sample-exterior-2", type: "image", category: "parking", alt: "कार्यक्रमस्थळाचा बाहेरील परिसर", url: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=82" }
    ]
  };

  function normalizeData(parsed) {
    if (!parsed || !parsed.settings || !Array.isArray(parsed.media)) {
      throw new Error("Firestore venue content has an invalid shape.");
    }
    return {
      settings: { ...initialData.settings, ...parsed.settings },
      imageReplacements: parsed.imageReplacements && typeof parsed.imageReplacements === "object"
        ? parsed.imageReplacements
        : {},
      media: parsed.media.filter(item => item && typeof item.url === "string" && categories[item.category])
    };
  }

  let data = structuredClone(initialData);
  const $ = selector => document.querySelector(selector);
  const gallery = $("#galleryGrid");
  let activeFilter = "all";
  let pendingPhotoTarget = null;

  async function saveData() {
    if (!contentRef || !currentAdmin || currentAdmin.uid !== ADMIN_UID) {
      showStatus("बदल सेव्ह करण्यासाठी अधिकृत Admin Login आवश्यक आहे.", true);
      return false;
    }
    try {
      await setDoc(contentRef, { ...data, updatedAt: new Date().toISOString(), updatedBy: currentAdmin.uid });
      return true;
    } catch (error) {
      console.error("Could not save venue content to Firestore.", error);
      showStatus("क्लाउडवर सेव्ह करता आले नाही. Firestore Rules आणि इंटरनेट तपासा.", true);
      return false;
    }
  }

  async function uploadToCloudinary(fileOrBlob, folder, resourceType = "image") {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET ||
        CLOUDINARY_UPLOAD_PRESET === "PASTE_UNSIGNED_UPLOAD_PRESET_NAME") {
      throw new Error("app.js मधील CLOUDINARY_UPLOAD_PRESET मध्ये तुमचा Unsigned preset name टाका.");
    }
    if (!currentAdmin || currentAdmin.uid !== ADMIN_UID) {
      throw new Error("Cloudinary वर अपलोड करण्यासाठी Admin Login आवश्यक आहे.");
    }
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
    const formData = new FormData();
    formData.append("file", fileOrBlob, fileOrBlob.name || `venue-${Date.now()}`);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", folder);
    const response = await fetch(endpoint, { method: "POST", body: formData });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.secure_url) {
      console.error("Cloudinary upload response:", result);
      throw new Error(result.error?.message || `Cloudinary upload अयशस्वी (${response.status}). Upload Preset तपासा.`);
    }
    return result.secure_url;
  }

  function safeExternalUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value, window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function safeMediaUrl(value) {
    const external = safeExternalUrl(value);
    if (external) return external;
    if (/^data:(image\/(?:jpeg|png|gif|webp|avif)|video\/(?:mp4|webm));base64,/i.test(value)) return value;
    return /^(?!\/)[\w.-]+\/?[\w.-]+\.(?:jpe?g|png|gif|webp|avif|mp4|webm)$/i.test(value) ? value : "";
  }

  function safeAudioUrl(value) {
    const external = safeExternalUrl(value);
    if (external) return external;
    return /^data:audio\/(?:mpeg|mp3|ogg|wav|aac|mp4);base64,/i.test(value) ? value : "";
  }

  function applySavedPhotos() {
    document.querySelectorAll("img[data-photo-key]").forEach(image => {
      const key = image.dataset.photoKey;
      if (!image.dataset.defaultSrc) image.dataset.defaultSrc = image.getAttribute("src") || "";
      const saved = data.imageReplacements[key];
      if (saved) {
        image.src = saved;
        image.removeAttribute("data-fallback");
      } else {
        image.src = image.dataset.defaultSrc;
      }
    });
  }

  function addPhotoEditButton(container, image, target) {
    container.classList.add("photo-edit-container");
    const change = document.createElement("button");
    change.type = "button";
    change.className = "photo-edit-button";
    change.setAttribute("aria-label", `फोटो बदला: ${image.alt}`);
    change.innerHTML = '<span aria-hidden="true">📷</span> फोटो बदला';
    change.addEventListener("click", event => {
      event.stopPropagation();
      pendingPhotoTarget = target;
      $("#photoFilePicker").value = "";
      $("#photoFilePicker").click();
    });
    container.append(change);
    if (target.type === "gallery") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "photo-delete-button";
      remove.textContent = "✕ काढा";
      remove.setAttribute("aria-label", `गॅलरीतून फोटो काढा: ${image.alt}`);
      remove.addEventListener("click", async event => {
        event.stopPropagation();
        if (!window.confirm("हा फोटो गॅलरीतून काढायचा?")) return;
        const previousMedia = data.media;
        data.media = data.media.filter(item => item.id !== target.id);
        if (await saveData()) renderGallery();
        else {
          data.media = previousMedia;
          renderGallery();
        }
      });
      container.append(remove);
    }
  }

  function initStaticPhotoEditors() {
    document.querySelectorAll("img[data-photo-key]").forEach(image => {
      image.dataset.defaultSrc = image.getAttribute("src") || "";
      addPhotoEditButton(image.parentElement, image, { type: "static", key: image.dataset.photoKey, image });
    });
    applySavedPhotos();
  }

  function setEditMode(enabled) {
    const allowed = Boolean(enabled && currentAdmin && currentAdmin.uid === ADMIN_UID);
    document.body.classList.toggle("edit-mode", allowed);
    $("#adminTrigger").textContent = allowed ? "✎ Admin: ON" : "✎ Admin Login";
    $("#adminTrigger").setAttribute("aria-pressed", String(allowed));
    $("#adminTrigger").setAttribute("aria-label", allowed ? "व्यवस्थापन उघडा" : "Admin Login करा");
    if (allowed) {
      $("#editModeSwitch").textContent = "Logout — Admin बाहेर पडा";
      $("#editModeSwitch").setAttribute("aria-pressed", "true");
    }
  }

  async function compressImage(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (error) {
      throw new Error("हा फोटो फॉरमॅट या ब्राउझरमध्ये उघडता आला नाही. JPG किंवा PNG निवडा.", { cause: error });
    }
    const maxDimension = 1100;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("फोटो प्रक्रिया करता आली नाही.");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.76, 0.66, 0.56, 0.46]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw new Error("फोटो संकुचित करता आला नाही.");
      if (blob.size <= 220 * 1024) return blob;
    }
    throw new Error("संकुचित फोटो अजून मोठा आहे. दुसरा फोटो निवडा.");
  }

  $("#photoFilePicker").addEventListener("change", async event => {
    const picker = event.currentTarget;
    const file = picker.files?.[0];
    const target = pendingPhotoTarget;
    if (!file || !target) return;
    if (!file.type.startsWith("image/")) {
      showStatus("कृपया फोटो फाइल निवडा.", true);
      return;
    }
    try {
      showStatus("फोटो क्लाउडवर अपलोड होत आहे...");
      const photoBlob = await compressImage(file);
      const photoUrl = await uploadToCloudinary(photoBlob, target.type === "static" ? "shivprasad/photos" : "shivprasad/gallery", "image");
      let rollbackPhoto = null;
      if (target.type === "static") {
        const previous = data.imageReplacements[target.key];
        data.imageReplacements[target.key] = photoUrl;
        rollbackPhoto = () => {
          if (previous === undefined) delete data.imageReplacements[target.key];
          else data.imageReplacements[target.key] = previous;
          applySavedPhotos();
        };
        applySavedPhotos();
      } else {
        const item = data.media.find(media => media.id === target.id);
        if (!item) throw new Error("गॅलरी फोटो सापडला नाही.");
        const previousUrl = item.url;
        const previousFallback = item.fallback;
        item.url = photoUrl;
        delete item.fallback;
        rollbackPhoto = () => {
          item.url = previousUrl;
          if (previousFallback === undefined) delete item.fallback;
          else item.fallback = previousFallback;
          renderGallery();
        };
        renderGallery();
      }
      if (await saveData()) showStatus("फोटो बदलला आणि सर्व उपकरणांवर सिंक केला.");
      else if (rollbackPhoto) rollbackPhoto();
    } catch (error) {
      console.error("Could not save the selected photo.", error);
      showStatus(error.message || "फोटो क्लाउडवर अपलोड करता आला नाही.", true);
    } finally {
      pendingPhotoTarget = null;
      picker.value = "";
    }
  });

  function renderGallery() {
    const items = data.media.filter(item => activeFilter === "all"
      || (activeFilter === "videos" ? item.type === "video" : item.category === activeFilter));
    gallery.replaceChildren();
    items.forEach(item => {
      const card = document.createElement("div");
      card.className = "gallery-item";
      card.setAttribute("aria-label", `${item.type === "video" ? "व्हिडिओ" : "फोटो"}: ${item.alt}`);
      const url = safeMediaUrl(item.url);
      if (item.type === "video") {
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        const poster = safeExternalUrl(item.poster || "");
        const preview = document.createElement("video");
        preview.src = url;
        preview.muted = true;
        preview.playsInline = true;
        preview.preload = "metadata";
        if (poster) preview.poster = poster;
        card.append(preview);
        const play = document.createElement("span");
        play.className = "video-mark";
        play.setAttribute("aria-hidden", "true");
        play.textContent = "▶";
        card.append(play);
      } else {
        const image = document.createElement("img");
        image.src = url;
        image.alt = item.alt;
        image.loading = "lazy";
        image.tabIndex = 0;
        image.setAttribute("role", "button");
        image.setAttribute("aria-label", `मोठा फोटो पहा: ${item.alt}`);
        image.dataset.fallback = safeExternalUrl(item.fallback || "");
        attachImageFallback(image);
        card.append(image);
        image.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openLightbox(item);
          }
        });
        addPhotoEditButton(card, image, { type: "gallery", id: item.id });
      }
      const caption = document.createElement("span");
      caption.className = "gallery-caption";
      caption.textContent = item.alt;
      card.append(caption);
      card.addEventListener("click", event => {
        if (!event.target.closest(".photo-edit-button")) openLightbox(item);
      });
      card.addEventListener("keydown", event => {
        if (item.type === "video" && event.target === card && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          openLightbox(item);
        }
      });
      gallery.append(card);
    });
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "gallery-empty";
      empty.textContent = "या श्रेणीमध्ये सध्या फोटो उपलब्ध नाहीत.";
      gallery.append(empty);
    }
  }

  function openLightbox(item) {
    const content = $("#lightboxContent");
    content.replaceChildren();
    const url = safeMediaUrl(item.url);
    let media;
    if (item.type === "video") {
      media = document.createElement("video");
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
    } else {
      media = document.createElement("img");
      media.alt = item.alt;
    }
    media.src = url;
    content.append(media);
    $("#lightboxCaption").textContent = item.alt;
    $("#lightbox").showModal();
    document.body.classList.add("dialog-open");
  }

  function starsFor(rating) {
    const value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return `${"★".repeat(value)}${"☆".repeat(5 - value)}`;
  }

  function renderPublicReviews() {
    const list = $("#reviewsList");
    const count = publicReviews.length;
    const average = count
      ? publicReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / count
      : 0;
    $("#approvedReviewCount").textContent = String(count);
    $("#averageRating").textContent = count ? average.toFixed(1) : "—";
    $("#averageRatingStars").textContent = starsFor(average);
    list.replaceChildren();
    if (!count) {
      const empty = document.createElement("p");
      empty.className = "reviews-empty";
      empty.textContent = "अजून कोणताही मंजूर अभिप्राय उपलब्ध नाही.";
      list.append(empty);
      return;
    }
    publicReviews.forEach(review => {
      const card = document.createElement("article");
      card.className = "review-card";
      const name = document.createElement("h3");
      name.textContent = review.name;
      const rating = document.createElement("div");
      rating.className = "review-card-stars";
      rating.textContent = starsFor(review.rating);
      rating.setAttribute("aria-label", `${review.rating} out of 5 stars`);
      const message = document.createElement("p");
      message.textContent = review.message;
      card.append(name, rating, message);
      list.append(card);
    });
  }

  function renderAdminReviews() {
    const list = $("#adminReviewList");
    const reviews = adminReviews.filter(review => reviewFilter === "all" || review.status === reviewFilter);
    list.replaceChildren();
    if (!reviews.length) {
      const empty = document.createElement("p");
      empty.className = "reviews-empty";
      empty.textContent = "या स्थितीत कोणतेही Reviews नाहीत.";
      list.append(empty);
      return;
    }
    reviews.forEach(review => {
      const card = document.createElement("article");
      card.className = "admin-review-card";
      const heading = document.createElement("div");
      heading.className = "admin-review-heading";
      const name = document.createElement("strong");
      name.textContent = review.name;
      const rating = document.createElement("span");
      rating.className = "review-card-stars";
      rating.textContent = starsFor(review.rating);
      rating.setAttribute("aria-label", `${review.rating} out of 5 stars`);
      heading.append(name, rating);
      const meta = document.createElement("div");
      meta.className = "admin-review-meta";
      const createdDate = review.createdAt && typeof review.createdAt.toDate === "function"
        ? review.createdAt.toDate().toLocaleString()
        : "तारीख उपलब्ध नाही";
      meta.textContent = `मोबाइल: ${review.mobile || "दिलेला नाही"} · ${createdDate}`;
      const status = document.createElement("span");
      status.className = `admin-review-status ${review.status}`;
      status.textContent = review.status;
      card.append(heading, meta, status);

      if (editingReviewId === review.id) {
        const form = document.createElement("form");
        form.className = "admin-review-edit";
        const nameInput = document.createElement("input");
        nameInput.name = "name";
        nameInput.value = review.name;
        nameInput.required = true;
        nameInput.maxLength = 80;
        nameInput.setAttribute("aria-label", "Customer name");
        const mobileInput = document.createElement("input");
        mobileInput.name = "mobile";
        mobileInput.type = "tel";
        mobileInput.value = review.mobile || "";
        mobileInput.maxLength = 20;
        mobileInput.pattern = "[0-9+() -]{0,20}";
        mobileInput.setAttribute("aria-label", "Mobile number");
        const ratingSelect = document.createElement("select");
        ratingSelect.name = "rating";
        ratingSelect.setAttribute("aria-label", "Star rating");
        for (let value = 1; value <= 5; value += 1) {
          const option = document.createElement("option");
          option.value = String(value);
          option.textContent = `${value} star${value === 1 ? "" : "s"}`;
          option.selected = Number(review.rating) === value;
          ratingSelect.append(option);
        }
        const messageInput = document.createElement("textarea");
        messageInput.name = "message";
        messageInput.value = review.message;
        messageInput.required = true;
        messageInput.maxLength = 2000;
        messageInput.rows = 4;
        messageInput.setAttribute("aria-label", "Review message");
        const actions = document.createElement("div");
        actions.className = "admin-review-actions";
        const save = document.createElement("button");
        save.type = "submit";
        save.textContent = "Save changes";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", () => {
          editingReviewId = null;
          renderAdminReviews();
        });
        actions.append(save, cancel);
        form.append(nameInput, mobileInput, ratingSelect, messageInput, actions);
        form.addEventListener("submit", async event => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const values = new FormData(form);
          const updated = await saveReviewChanges(review.id, {
            name: String(values.get("name")).trim(),
            mobile: String(values.get("mobile")).trim(),
            rating: Number(values.get("rating")),
            message: String(values.get("message")).trim()
          });
          if (updated) {
            editingReviewId = null;
            showStatus("Review updated.");
            renderAdminReviews();
          }
        });
        card.append(form);
      } else {
        const message = document.createElement("p");
        message.className = "admin-review-message";
        message.textContent = review.message;
        card.append(message);
        const actions = document.createElement("div");
        actions.className = "admin-review-actions";
        const addAction = (label, action) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          button.addEventListener("click", action);
          actions.append(button);
        };
        if (review.status !== "approved") {
          addAction("Approve", async () => {
            if (await saveReviewChanges(review.id, { status: "approved" })) showStatus("Review approved.");
          });
        }
        if (review.status !== "rejected") {
          addAction("Reject", async () => {
            if (await saveReviewChanges(review.id, { status: "rejected" })) showStatus("Review rejected.");
          });
        }
        addAction("Edit", () => {
          editingReviewId = review.id;
          renderAdminReviews();
        });
        addAction("Delete", async () => {
          if (!window.confirm("हा Review कायमचा delete करायचा?")) return;
          try {
            const batch = writeBatch(db);
            batch.delete(doc(db, "reviews", review.id));
            batch.delete(doc(db, "publicReviews", review.id));
            await batch.commit();
            showStatus("Review deleted.");
          } catch (error) {
            console.error("Could not delete review.", error);
            showStatus("Review delete करता आला नाही. Firestore Rules आणि इंटरनेट तपासा.", true);
          }
        });
        card.append(actions);
      }
      list.append(card);
    });
  }

  async function saveReviewChanges(reviewId, changes) {
    if (!db || !currentAdmin || currentAdmin.uid !== ADMIN_UID) {
      showStatus("Reviews व्यवस्थापित करण्यासाठी अधिकृत Admin Login आवश्यक आहे.", true);
      return false;
    }
    try {
      const current = adminReviews.find(review => review.id === reviewId);
      if (!current) throw new Error("Review not found in the Admin list.");
      const status = changes.status || current.status;
      const updatedAt = serverTimestamp();
      const batch = writeBatch(db);
      batch.update(doc(db, "reviews", reviewId), { ...changes, updatedAt });
      const publicReviewRef = doc(db, "publicReviews", reviewId);
      if (status === "approved") {
        batch.set(publicReviewRef, {
          name: changes.name === undefined ? current.name : changes.name,
          rating: changes.rating === undefined ? current.rating : changes.rating,
          message: changes.message === undefined ? current.message : changes.message,
          status: "approved",
          createdAt: current.createdAt,
          updatedAt
        });
      } else {
        batch.delete(publicReviewRef);
      }
      await batch.commit();
      return true;
    } catch (error) {
      console.error("Could not update review.", error);
      showStatus("Review update करता आला नाही. Firestore Rules आणि इंटरनेट तपासा.", true);
      return false;
    }
  }

  function listenForPublicReviews() {
    if (!db) {
      $("#reviewsList").textContent = "Firebase Firestore कनेक्ट झाले नाही. Reviews लोड करता येत नाहीत.";
      return;
    }
    const approvedReviews = query(
      collection(db, "publicReviews"),
      where("status", "==", "approved"),
      orderBy("createdAt", "desc")
    );
    onSnapshot(approvedReviews, snapshot => {
      publicReviews = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderPublicReviews();
    }, error => {
      console.error("Could not listen for approved reviews.", error);
    
    });
  }

  function listenForAdminReviews() {
    if (stopAdminReviewListener) stopAdminReviewListener();
    stopAdminReviewListener = null;
    if (!db || !currentAdmin || currentAdmin.uid !== ADMIN_UID) return;
    const allReviews = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    stopAdminReviewListener = onSnapshot(allReviews, snapshot => {
      adminReviews = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderAdminReviews();
    }, error => {
      console.error("Could not listen for admin reviews.", error);
      showStatus("सर्व Reviews मिळवता आले नाहीत. Firestore Rules तपासा.", true);
    });
  }

  function renderSettings() {
    const settings = data.settings;
    const title = settings.title || initialData.settings.title;
    const titleParts = title.split(/\s+[—-]\s+/);
    $("#heroTitle").innerHTML = `${escapeHTML(titleParts.shift())}<br /><em>${escapeHTML(titleParts.join(" — "))}</em>`;
    $("#addressText").textContent = settings.address || initialData.settings.address;
    const announcement = $("#announcement");
    announcement.textContent = settings.announcement;
    announcement.hidden = !settings.announcement.trim();
    const configuredPhones = [settings.phone, settings.phone2, settings.phone3];
    const phones = configuredPhones.filter(phone => phone && phone.trim());
    document.querySelectorAll(".hero-call").forEach(link => {
      const phone = configuredPhones[Number(link.dataset.phoneIndex)] || "";
      link.hidden = !phone.trim();
      link.href = phone.trim() ? `tel:${phone.replace(/[^\d+]/g, "")}` : "#contact";
      const number = link.querySelector("span");
      if (number) number.textContent = phone.trim();
    });
    const phoneList = $("#contactPhone");
    phoneList.replaceChildren();
    phones.forEach(phone => {
      const link = document.createElement("a");
      link.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
      link.textContent = `📞 ${phone}`;
      phoneList.append(link);
    });
    const email = settings.email.trim();
    const emailLink = $("#emailLink");
    emailLink.textContent = email;
    emailLink.href = email ? `mailto:${email}` : "#contact";
    const primaryPhone = phones[0] || "";
    $("#callLink").href = primaryPhone ? `tel:${primaryPhone.replace(/[^\d+]/g, "")}` : "#contact";
    const whatsapp = primaryPhone.replace(/\D/g, "");
    const message = encodeURIComponent("नमस्कार, शिवप्रसाद मंगल कार्यालयातील बुकिंगविषयी चौकशी करायची आहे.");
    const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp}?text=${message}` : "#contact";
    ["#whatsappLink", "#headerWhatsappLink", "#heroWhatsappLink"].forEach(selector => {
      $(selector).href = whatsappUrl;
    });
    const audio = $("#backgroundAudio");
    const audioToggle = $("#audioToggle");
    const audioMute = $("#audioMute");
    const musicUrl = safeAudioUrl(settings.music);
    if (musicUrl && audio.src !== musicUrl) {
      audio.src = musicUrl;
      audio.load();
    } else if (!musicUrl && audio.src) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioToggle.classList.remove("playing");
    }
    audioToggle.disabled = !musicUrl;
    audioMute.disabled = !musicUrl;
    audioMute.classList.toggle("muted", audio.muted);
    audioMute.setAttribute("aria-label", audio.muted ? "संगीत अनम्यूट करा" : "संगीत म्यूट करा");
  }

  function escapeHTML(value) {
    return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function attachImageFallback(image) {
    const useFallback = () => {
      if (image.dataset.fallback && image.src !== image.dataset.fallback) {
        image.src = image.dataset.fallback;
        image.removeAttribute("data-fallback");
      }
    };
    image.addEventListener("error", useFallback, { once: true });
    if (image.complete && image.naturalWidth === 0) useFallback();
  }

  function showStatus(message, isError = false) {
    const status = $("#adminStatus");
    status.textContent = message;
    status.style.color = isError ? "#9c2b3c" : "#55744b";
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => { status.textContent = ""; }, 6000);
  }

  function populateSettingsForm() {
    const form = $("#settingsForm");
    Object.entries(data.settings).forEach(([key, value]) => {
      const input = form.elements.namedItem(key);
      if (input) input.value = key === "music" && String(value).startsWith("data:") ? "" : value;
    });
  }

  function openAdminDialog() {
    populateSettingsForm();
    renderAdminMedia();
    renderAdminReviews();
    $("#adminDialog").showModal();
    document.body.classList.add("dialog-open");
  }

  function renderAdminMedia() {
    const list = $("#adminMediaList");
    list.replaceChildren();
    data.media.forEach(item => {
      const row = document.createElement("div");
      row.className = "admin-media-row";
      const preview = item.type === "video" ? document.createElement("video") : document.createElement("img");
      preview.src = safeMediaUrl(item.url);
      if (preview instanceof HTMLVideoElement) {
        preview.muted = true;
      } else {
        preview.dataset.fallback = safeExternalUrl(item.fallback || "");
        attachImageFallback(preview);
      }
      preview.alt = item.alt;
      const title = document.createElement("span");
      title.textContent = `${categories[item.category]} — ${item.alt}`;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "संपादित";
      edit.addEventListener("click", () => {
        const form = $("#mediaForm");
        form.elements.namedItem("mediaId").value = item.id;
        form.elements.namedItem("type").value = item.type;
        form.elements.namedItem("url").value = item.url.startsWith("data:") ? "" : item.url;
        form.elements.namedItem("alt").value = item.alt;
        form.elements.namedItem("category").value = item.category;
        form.querySelector('button[type="submit"]').textContent = "बदल सेव्ह करा";
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "काढा";
      remove.addEventListener("click", async () => {
        const previousMedia = data.media;
        data.media = data.media.filter(media => media.id !== item.id);
        if (await saveData()) {
          const form = $("#mediaForm");
          if (form.elements.namedItem("mediaId").value === item.id) {
            form.reset();
            form.querySelector('button[type="submit"]').textContent = "गॅलरीत जोडा";
          }
          renderGallery();
          renderAdminMedia();
          showStatus("मीडिया काढला.");
        } else {
          data.media = previousMedia;
          renderGallery();
          renderAdminMedia();
        }
      });
      row.append(preview, title, edit, remove);
      list.append(row);
    });
  }

  $("#settingsForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const musicUrl = String(fields.get("music")).trim();
    const musicFile = fields.get("musicFile");
    const clearMusic = fields.get("clearMusic") === "on";
    if (clearMusic && (musicUrl || (musicFile instanceof File && musicFile.size > 0))) {
      showStatus("संगीत काढण्यासाठी URL किंवा ऑडिओ फाइल रिकामी ठेवा.", true);
      return;
    }
    if (musicFile instanceof File && musicFile.size > 0 && musicFile.size > 1024 * 1024) {
      showStatus("ऑडिओ फाइल १ MB पेक्षा मोठी आहे. सार्वजनिक HTTPS URL वापरा.", true);
      return;
    }
    if (musicFile instanceof File && musicFile.size > 0 && musicUrl) {
      showStatus("ऑडिओ URL किंवा फाइल — यापैकी एकच पर्याय निवडा.", true);
      return;
    }
    let music = clearMusic ? "" : data.settings.music || "";
    if (!clearMusic && musicUrl) {
      if (!safeExternalUrl(musicUrl)) {
        showStatus("संगीत URL हा http किंवा https ने सुरू होणारा हवा.", true);
        return;
      }
      music = musicUrl;
    } else if (!clearMusic && musicFile instanceof File && musicFile.size > 0) {
      if (!["audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/aac", "audio/mp4"].includes(musicFile.type)) {
        showStatus("MP3, OGG, WAV किंवा AAC ऑडिओ फाइल निवडा.", true);
        return;
      }
      try {
        showStatus("ऑडिओ क्लाउडवर अपलोड होत आहे...");
        music = await uploadToCloudinary(musicFile, "shivprasad/audio", "video");
      } catch (error) {
        console.error("Could not read the selected audio file.", error);
        showStatus(error.message || "ऑडिओ फाइल क्लाउडवर अपलोड करता आली नाही.", true);
        return;
      }
    }
    const previousSettings = data.settings;
    data.settings = {
      title: String(fields.get("title")).trim() || initialData.settings.title,
      announcement: String(fields.get("announcement")).trim(),
      address: String(fields.get("address")).trim(),
      phone: String(fields.get("phone")).trim(),
      phone2: String(fields.get("phone2")).trim(),
      phone3: String(fields.get("phone3")).trim(),
      email: String(fields.get("email")).trim(),
      music
    };
    if (await saveData()) {
      renderSettings();
      form.elements.namedItem("clearMusic").checked = false;
      form.elements.namedItem("musicFile").value = "";
      showStatus("सेटिंग्ज सेव्ह झाल्या.");
    } else {
      data.settings = previousSettings;
      renderSettings();
    }
  });

  $("#mediaForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const selectedType = String(fields.get("type"));
    const mediaId = String(fields.get("mediaId"));
    const existing = data.media.find(item => item.id === mediaId);
    const enteredUrl = String(fields.get("url")).trim();
    const file = fields.get("file");
    if (file instanceof File && selectedType === "video" && file.size > 100 * 1024 * 1024) {
      showStatus("व्हिडिओ फाइल १०० MB पेक्षा मोठी आहे. छोटी फाइल किंवा HTTPS URL वापरा.", true);
      return;
    }
    if (file instanceof File && file.size > 0 && enteredUrl) {
      showStatus("URL किंवा फाइल — यापैकी एकच पर्याय निवडा.", true);
      return;
    }
    let url = enteredUrl;
    let type = selectedType;
    if (file instanceof File && file.size > 0) {
      const accepted = selectedType === "image"
        ? file.type.startsWith("image/")
        : ["video/mp4", "video/webm"].includes(file.type);
      if (!accepted) {
        showStatus(selectedType === "image" ? "कृपया समर्थित फोटो फाइल निवडा." : "व्हिडिओसाठी MP4 किंवा WebM फाइल निवडा.", true);
        return;
      }
      try {
        if (selectedType === "image") {
          showStatus("फोटो क्लाउडवर अपलोड होत आहे...");
          url = await uploadToCloudinary(await compressImage(file), "shivprasad/gallery", "image");
        } else {
          showStatus("व्हिडिओ क्लाउडवर अपलोड होत आहे...");
          url = await uploadToCloudinary(file, "shivprasad/videos", "video");
        }
      } catch (error) {
        console.error("Could not read uploaded media.", error);
        showStatus(error.message || "फाइल क्लाउडवर अपलोड करता आली नाही.", true);
        return;
      }
      type = selectedType;
    } else if (enteredUrl && !safeExternalUrl(url)) {
      showStatus("मीडिया URL हा http किंवा https ने सुरू होणारा हवा.", true);
      return;
    } else if (!enteredUrl && existing) {
      url = existing.url;
      type = existing.type;
    } else if (!enteredUrl) {
      showStatus("मीडिया URL द्या किंवा फाइल अपलोड करा.", true);
      return;
    }
    const updatedMedia = {
      id: existing ? existing.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      category: String(fields.get("category")),
      alt: String(fields.get("alt")).trim(),
      url,
      ...(existing && url === existing.url && existing.fallback ? { fallback: existing.fallback } : {})
    };
    const previousData = structuredClone(data);
    if (existing) {
      Object.assign(existing, updatedMedia);
    } else {
      data.media.unshift(updatedMedia);
    }
    if (await saveData()) {
      renderGallery();
      renderAdminMedia();
      form.reset();
      form.querySelector('button[type="submit"]').textContent = "गॅलरीत जोडा";
      showStatus(existing ? "मीडिया बदल सेव्ह झाले." : "मीडिया गॅलरीत जोडला.");
    } else {
      data = previousData;
      renderGallery();
      renderAdminMedia();
    }
  });

  document.querySelectorAll("#gallery .filter-button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelector("#gallery .filter-button.active")?.classList.remove("active");
      button.classList.add("active");
      activeFilter = button.dataset.filter;
      renderGallery();
    });
  });

  document.querySelectorAll("[data-review-filter]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelector("[data-review-filter].active")?.classList.remove("active");
      button.classList.add("active");
      reviewFilter = button.dataset.reviewFilter;
      renderAdminReviews();
    });
  });

  $("#writeReviewButton").addEventListener("click", event => {
    const form = $("#reviewForm");
    form.hidden = !form.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) $("#reviewName").focus();
  });

  $("#reviewForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $("#reviewFormMessage");
    const submit = $("#submitReviewButton");
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const name = String(fields.get("name")).trim();
    const mobile = String(fields.get("mobile")).trim();
    const reviewMessage = String(fields.get("message")).trim();
    const rating = Number(fields.get("rating"));
    message.classList.remove("error");
    if (!name || !reviewMessage || !Number.isInteger(rating) || rating < 1 || rating > 5
        || !/^[0-9+() -]{0,20}$/.test(mobile)) {
      message.textContent = "कृपया नाव, योग्य स्टार रेटिंग, अभिप्राय आणि वैध मोबाइल नंबर तपासा.";
      message.classList.add("error");
      return;
    }
    if (!db) {
      message.textContent = "Firebase Firestore कनेक्ट झाले नाही. कृपया नंतर पुन्हा प्रयत्न करा.";
      message.classList.add("error");
      return;
    }
    submit.disabled = true;
    message.textContent = "";
    try {
      await addDoc(collection(db, "reviews"), {
        name,
        mobile,
        rating,
        message: reviewMessage,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      form.reset();
      message.textContent = "Thank you! Your review has been submitted successfully.";
    } catch (error) {
      console.error("Could not submit customer review.", error);
      message.textContent = "Review पाठवता आला नाही. Firestore Rules आणि इंटरनेट तपासून पुन्हा प्रयत्न करा.";
      message.classList.add("error");
    } finally {
      submit.disabled = false;
    }
  });

  $("#backgroundAudio").addEventListener("pause", () => {
    $("#audioToggle").classList.remove("playing");
    $("#audioToggle").setAttribute("aria-label", "शहनाई संगीत सुरू करा");
  });
  $("#backgroundAudio").addEventListener("play", () => {
    $("#audioToggle").classList.add("playing");
    $("#audioToggle").setAttribute("aria-label", "शहनाई संगीत थांबवा");
  });

  $("#audioToggle").addEventListener("click", async event => {
    const audio = $("#backgroundAudio");
    if (!audio.src) {
      showStatus("आधी व्यवस्थापनातून संगीत URL जोडा.");
      return;
    }
    if (audio.paused) {
      try {
        await audio.play();
        event.currentTarget.classList.add("playing");
        event.currentTarget.setAttribute("aria-label", "शहनाई संगीत थांबवा");
      } catch (error) {
        console.error("Could not play background music.", error);
        showStatus("संगीत सुरू झाले नाही. ऑडिओ URL तपासा.", true);
      }
    } else {
      audio.pause();
      event.currentTarget.classList.remove("playing");
      event.currentTarget.setAttribute("aria-label", "शहनाई संगीत सुरू करा");
    }
  });
  $("#audioMute").addEventListener("click", event => {
    const audio = $("#backgroundAudio");
    audio.muted = !audio.muted;
    event.currentTarget.classList.toggle("muted", audio.muted);
    event.currentTarget.setAttribute("aria-label", audio.muted ? "संगीत अनम्यूट करा" : "संगीत म्यूट करा");
    event.currentTarget.title = audio.muted ? "संगीत अनम्यूट करा" : "संगीत म्यूट करा";
  });

  $("#menuToggle").addEventListener("click", event => {
    const nav = $("#mainNav");
    const expanded = nav.classList.toggle("open");
    event.currentTarget.setAttribute("aria-expanded", String(expanded));
  });
  $("#mainNav").addEventListener("click", event => {
    if (event.target.closest("a")) {
      $("#mainNav").classList.remove("open");
      $("#menuToggle").setAttribute("aria-expanded", "false");
    }
  });

  function getInquiryDetails(form) {
    const fields = new FormData(form);
    return {
      name: String(fields.get("name")),
      email: String(fields.get("email")),
      message: String(fields.get("message"))
    };
  }

  $("#inquiryForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!data.settings.email) {
      $("#formNote").textContent = "चौकशीसाठी व्यवस्थापनातून ईमेल पत्ता जोडा.";
      return;
    }
    const details = getInquiryDetails(event.currentTarget);
    const subject = encodeURIComponent(`बुकिंग चौकशी — ${details.name}`);
    const body = encodeURIComponent(`नाव: ${details.name}\nईमेल: ${details.email}\n\n${details.message}`);
    window.location.href = `mailto:${encodeURIComponent(data.settings.email)}?subject=${subject}&body=${body}`;
  });

  $("#whatsappFormButton").addEventListener("click", () => {
    const form = $("#inquiryForm");
    if (!form.reportValidity()) return;
    const details = getInquiryDetails(form);
    const phone = (data.settings.phone || "").replace(/\D/g, "");
    if (!phone) {
      $("#formNote").textContent = "WhatsApp चौकशीसाठी व्यवस्थापनातून फोन नंबर जोडा.";
      return;
    }
    const message = encodeURIComponent(`नमस्कार, शिवप्रसाद मंगल कार्यालयातील बुकिंगविषयी चौकशी.\nनाव: ${details.name}\nईमेल: ${details.email}\nसंदेश: ${details.message}`);
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener");
  });

  $("#adminTrigger").addEventListener("click", () => {
    if (currentAdmin && currentAdmin.uid === ADMIN_UID) {
      openAdminDialog();
      return;
    }
    $("#authError").textContent = "";
    $("#authForm").reset();
    $("#adminAuthDialog").showModal();
    document.body.classList.add("dialog-open");
    $("#adminEmail").focus();
  });

  $("#authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const errorLabel = $("#authError");
    const submit = $("#authSubmit");
    const email = $("#adminEmail").value.trim();
    const password = $("#adminPassword").value;
    if (!auth) {
      errorLabel.textContent = "Firebase Authentication सुरू झाले नाही. Firebase config तपासा.";
      return;
    }
    submit.disabled = true;
    submit.textContent = "Login होत आहे...";
    errorLabel.textContent = "";
    try {
      await authPersistenceReady;
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (credential.user.uid !== ADMIN_UID) {
        await signOut(auth);
        throw new Error("या Email ला Admin परवानगी नाही.");
      }
      currentAdmin = credential.user;
      setEditMode(true);
      $("#adminAuthDialog").close();
      openAdminDialog();
    } catch (error) {
      console.error("Admin sign-in failed.", error);
      const messages = {
        "auth/invalid-credential": "ईमेल किंवा पासवर्ड चुकीचा आहे.",
        "auth/user-not-found": "हा Admin account Firebase Authentication मध्ये सापडला नाही.",
        "auth/too-many-requests": "अनेक प्रयत्न झाले. थोड्या वेळाने पुन्हा प्रयत्न करा.",
        "auth/network-request-failed": "इंटरनेट कनेक्शन तपासा."
      };
      errorLabel.textContent = messages[error.code] || error.message || "Admin Login अयशस्वी.";
    } finally {
      submit.disabled = false;
      submit.textContent = "Admin Login करा";
    }
  });

  $("#editModeSwitch").addEventListener("click", async () => {
    $("#adminDialog").close();
    try { if (auth) await signOut(auth); }
    catch (error) { console.error("Admin logout failed.", error); }
    currentAdmin = null;
    setEditMode(false);
    showStatus("Admin Logout झाले.");
  });

  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelector(".admin-tab.active")?.classList.remove("active");
      document.querySelector(".admin-panel.active")?.classList.remove("active");
      tab.classList.add("active");
      $(`#${tab.dataset.panel}`).classList.add("active");
      if (tab.dataset.panel === "reviewsPanel") renderAdminReviews();
    });
  });

  $("#resetData").addEventListener("click", async () => {
    if (!window.confirm("सेव्ह केलेली सामग्री काढून मूळ सामग्री पूर्ववत करायची?")) return;
    const previousData = data;
    data = structuredClone(initialData);
    if (!await saveData()) {
      data = previousData;
      return;
    }
    renderSettings();
    renderGallery();
    renderAdminMedia();
    applySavedPhotos();
    $("#settingsForm").reset();
    populateSettingsForm();
    $("#mediaForm").reset();
    showStatus("मूळ सामग्री पूर्ववत झाली.");
  });

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => $(`#${button.dataset.close}`).close());
  });
  document.querySelectorAll("dialog").forEach(dialog => {
    dialog.addEventListener("close", () => {
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
      if (dialog.id === "lightbox") $("#lightboxContent").replaceChildren();
    });
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
  });

  $("#year").textContent = new Date().getFullYear();
  document.querySelectorAll("img[data-fallback]").forEach(attachImageFallback);
  initStaticPhotoEditors();
  renderSettings();
  renderGallery();
  renderPublicReviews();
  listenForPublicReviews();
  if (auth) {
    onAuthStateChanged(auth, async user => {
      if (user && user.uid === ADMIN_UID) {
        currentAdmin = user;
        setEditMode(true);
        listenForAdminReviews();
      } else {
        currentAdmin = null;
        if (stopAdminReviewListener) stopAdminReviewListener();
        stopAdminReviewListener = null;
        adminReviews = [];
        renderAdminReviews();
        setEditMode(false);
        if (user) {
          try { await signOut(auth); } catch (error) { console.error("Unauthorized account sign-out failed.", error); }
        }
      }
    }, error => {
      console.error("Firebase Authentication state error.", error);
      showStatus("Admin Login स्थिती तपासता आली नाही.", true);
    });
  }

  if (contentRef) {
    onSnapshot(contentRef, snapshot => {
      try {
        data = snapshot.exists() ? normalizeData(snapshot.data()) : structuredClone(initialData);
        applySavedPhotos();
        renderGallery();
        renderSettings();
        if ($("#adminDialog").open) renderAdminMedia();
      } catch (error) {
        console.error("Could not apply venue content from Firestore.", error);
      }
    }, error => {
      console.error("Could not listen for venue content updates.", error);
      showStatus("क्लाउड अपडेट मिळवता आले नाहीत.", true);
    });
  }
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(element => observer.observe(element));
  } else {
    document.querySelectorAll(".reveal").forEach(element => element.classList.add("visible"));
  }
})();
