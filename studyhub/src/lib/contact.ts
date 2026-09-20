/** WhatsApp contact for the admin. `wa.me` needs the number in international format without "+" or leading zero. */
export const ADMIN_WHATSAPP_DISPLAY = "0324 9232263";
export const ADMIN_WHATSAPP_URL = "https://wa.me/923249232263";

/** A WhatsApp link with the message already typed, so the admin knows who is asking and why. */
export const FORGOT_PASSWORD_URL = `${ADMIN_WHATSAPP_URL}?text=${encodeURIComponent(
  "Hello, I forgot my StudyHub password. Please reset it for me.\nMy name: \nMy email/username: ",
)}`;
