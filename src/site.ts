/**
 * Site-wide facts that appear in more than one place.
 *
 * The phone number lives here because it previously appeared in three
 * places that disagreed: the header and footer said +30 6909 025 820 while
 * the JSON-LD advertised +30 6936 772 821 to search engines.
 *
 * `phone` is pending confirmation from the owner. It is set to the number
 * that was actually displayed to visitors, in two of the three places.
 * Correcting it is a one-line change here.
 */
const PHONE = '+30 6909 025 820';
const EMAIL = 'marinosaparts@gmail.com';

export const CONTACT = {
  phone: PHONE,
  phoneHref: `tel:${PHONE.replace(/\s/g, '')}`,
  email: EMAIL,
  emailHref: `mailto:${EMAIL}`,
} as const;
