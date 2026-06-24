const ENUM_OPTIONS = {
  // Turkish
  kan_grubu:      ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'],
  cinsiyet:       ['Male', 'Female', 'Other'],
  durum:          ['Active', 'Inactive', 'Pending'],
  odeme_durumu:   ['Paid', 'Pending', 'Cancelled'],
  oncelik:        ['Low', 'Medium', 'High'],
  spor_dali:      ['Football', 'Basketball', 'Volleyball', 'Swimming', 'Athletics', 'Tennis', 'Other'],
  uzmanlik:       ['Doctor', 'Physiotherapist', 'Dietician', 'Psychologist', 'Coach'],
  uzmanlik_alani: ['Doctor', 'Physiotherapist', 'Dietician', 'Psychologist', 'Coach'],
  // English equivalents (AI-generated field names)
  status:         ['Active', 'Inactive', 'Pending'],
  blood_type:     ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'],
  blood_group:    ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'],
  priority:       ['Low', 'Medium', 'High'],
  payment_status: ['Paid', 'Pending', 'Cancelled'],
  payment_state:  ['Paid', 'Pending', 'Cancelled'],
  order_status:   ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
  claim_status:   ['Pending', 'Approved', 'Rejected'],
  approval_status:['Pending', 'Approved', 'Rejected'],
  appointment_status: ['Scheduled', 'Completed', 'Cancelled', 'No-Show'],
};

function getEnumOptions(slug) {
  if (ENUM_OPTIONS[slug]) return ENUM_OPTIONS[slug];
  for (const key of Object.keys(ENUM_OPTIONS)) {
    if (slug.includes(key) || key.includes(slug)) return ENUM_OPTIONS[key];
  }
  return null;
}

export function detectInputType(fieldName = '', fieldType = 'string', enumValues = null) {
  const n = (fieldName || '').toLowerCase().replace(/\s+/g, '_');

  // Defensive: handle JSON string enum_values (JSONB double-serialization edge case)
  let resolvedEnumValues = enumValues;
  if (typeof enumValues === 'string') {
    try { resolvedEnumValues = JSON.parse(enumValues); } catch { resolvedEnumValues = null; }
  }

  // Explicit enum_values array — first priority
  if (resolvedEnumValues && Array.isArray(resolvedEnumValues) && resolvedEnumValues.length > 0) {
    return { inputType: 'enum', options: resolvedEnumValues };
  }

  // input_type/frontend_type is explicitly 'enum' (stored from manual module)
  if (fieldType === 'enum') {
    const enumOpts = getEnumOptions(n);
    return { inputType: 'enum', options: enumOpts || [] };
  }

  // Gender — before enum lookup so cinsiyet doesn't fall through to generic enum
  if (n === 'cinsiyet' || n === 'gender' || n === 'sex' || n.includes('gender') || n.endsWith('_gender')) {
    return { inputType: 'gender' };
  }

  if (n.includes('tc_kimlik') || n.includes('tc_no') || n.includes('kimlik_no') || n.includes('identity')) {
    return { inputType: 'tc_kimlik' };
  }

  if (
    fieldType === 'date' || fieldType === 'datetime' ||
    n.includes('tarih') || n.includes('date') ||
    n.includes('dogum') || n.includes('doğum') ||
    n.includes('muayene') || n.includes('baslangic') || n.includes('bitis') ||
    n.includes('son_odeme') || n.includes('olcum') || n.includes('kayit_tarihi')
  ) {
    return { inputType: 'date' };
  }

  if (n.includes('telefon') || n.includes('phone') || n.includes('gsm') ||
      n === 'tel' || n.startsWith('tel_')) {
    return { inputType: 'phone' };
  }

  if (n.includes('email') || n.includes('e_posta') || n.includes('eposta') || n.includes('mail')) {
    return { inputType: 'email' };
  }

  if (n.includes('tutar') || n.includes('fiyat') || n.includes('ucret') || n.includes('maas') || n === 'butce') {
    return { inputType: 'currency', defaultCurrency: 'TRY' };
  }
  if (n.includes('price') || n.includes('amount') || n.includes('salary') || n.includes('toplam')) {
    return { inputType: 'currency', defaultCurrency: 'USD' };
  }

  if (n === 'boy' || n.includes('height') || n.includes('uzunluk')) {
    return { inputType: 'number_with_unit', units: ['cm', 'm', 'inch', 'ft'], defaultUnit: 'cm' };
  }
  if (n === 'kilo' || n.includes('weight') || n.includes('agirlik') || n.includes('ağırlık')) {
    return { inputType: 'number_with_unit', units: ['kg', 'g', 'lb', 'oz'], defaultUnit: 'kg' };
  }
  if (n.includes('dozaj') || n === 'doz' || n.includes('dosage')) {
    return { inputType: 'number_with_unit', units: ['mg', 'g', 'ml', 'l', 'capsule', 'tablet', 'drops', 'IU'], defaultUnit: 'mg' };
  }
  if (n.includes('hacim') || n.includes('volume')) {
    return { inputType: 'number_with_unit', units: ['ml', 'l', 'cl'], defaultUnit: 'ml' };
  }
  if (n.includes('mesafe') || n.includes('distance')) {
    return { inputType: 'number_with_unit', units: ['km', 'm', 'mi'], defaultUnit: 'km' };
  }
  if (n.includes('sure') || n.includes('süre') || n.includes('duration') || n.includes('iyilesme')) {
    return { inputType: 'number_with_unit', units: ['min', 'hr', 'day'], defaultUnit: 'min' };
  }

  const enumOpts = getEnumOptions(n);
  if (enumOpts) {
    return { inputType: 'enum', options: enumOpts };
  }

  if (
    fieldType === 'integer' || fieldType === 'number' || fieldType === 'decimal' || fieldType === 'float' ||
    n.includes('miktar') || n.includes('quantity') || n.includes('sayi') ||
    n.includes('yas') || n.includes('age') || n.includes('stok') || n.includes('count')
  ) {
    const isDecimal = fieldType === 'decimal' || fieldType === 'float';
    return { inputType: 'number', step: isDecimal ? '0.01' : '1' };
  }

  if (
    fieldType === 'text' ||
    n.includes('not') || n.includes('aciklama') || n.includes('açıklama') ||
    n.includes('description') || n.includes('tedavi') || n.includes('plan') ||
    n.includes('klinik') || n.includes('yorum') || n.includes('detay') || n.includes('comment')
  ) {
    return { inputType: 'textarea' };
  }

  return { inputType: 'text' };
}
