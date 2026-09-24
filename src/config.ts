// The API base is baked at build time. Each deploy workflow sets
// PUBLIC_CONTACT_API_BASE so staging and production build different endpoints
// from identical source. The fallback is the staging stage, so `npm run dev`
// works with no env file.
const FALLBACK_BASE = 'https://8vgfxd8lde.execute-api.eu-west-1.amazonaws.com/dev';

export function buildEndpoints(base: string) {
  const b = base.replace(/\/+$/, '');
  return {
    contact: `${b}/contact`,
    recaptcha: `${b}/validaterecaptcha`,
  };
}

export const API_BASE = import.meta.env.PUBLIC_CONTACT_API_BASE || FALLBACK_BASE;
export const API_ENDPOINTS = buildEndpoints(API_BASE);

export const RECAPTCHA_SITE_KEY = '6LcglLUUAAAAAF_UyVCnbs1Jv4aLFlrDigWo0Y28';
