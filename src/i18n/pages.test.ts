import { test, expect } from 'vitest';
import { t } from './t';
import { LOCALES } from './locales';

const FACILITY_KEYS = ['spaciousRooms','kitchen','fridge','parking','airCondition','safe','yard','hotWater','largeClosets','tv','iron','balcony','tableChairs','hairDryer','screens','wifi'];
const BEACH_KEYS = ['agiaParaskevi','zeri','zavia','dei','megaNtrafi','mpelaVraka','gallikosMolos','megaAmmos','mikriAmmos','pisina','karavostasi','arrilas'];

test('every locale has all page blocks with matching key sets', () => {
  for (const lang of LOCALES) {
    const s = t(lang);
    expect(Object.keys(s.facilities).sort()).toEqual([...FACILITY_KEYS].sort());
    for (const page of ['kimon','irida'] as const) {
      expect(typeof s[page].title).toBe('string');
      expect(typeof s[page].main).toBe('string');
      expect(typeof s[page].facilitiesTitle).toBe('string');
      expect(typeof s[page].gallery).toBe('string');
    }
    expect(Object.keys(s.location.beaches).sort()).toEqual([...BEACH_KEYS].sort());
    expect(Object.keys(s.location.galleryDescriptions).sort()).toEqual([...BEACH_KEYS].sort());
    expect(typeof s.contact.form.required).toBe('string');
    expect(typeof s.contact.form.minlength10).toBe('string');
    expect(typeof s.contact.submit).toBe('string');
  }
});

test('known verbatim values are present per locale', () => {
  expect(t('en').kimon.title).toBe('Kimon Resort');
  expect(t('en').contact.submit).toBe('Submit');
  expect(t('gr').contact.submit).toBe('Αποστολή');
  expect(t('en').facilities.wifi).toBe('Free wi-fi Internet');
  expect(t('gr').location.beachTitle).toBe('Παραλίες');
});
