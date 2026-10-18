// Keep in sync with server/utils/documentTypes.js
export const DOCUMENT_TYPES = [
  { key: 'business_registration', label: 'DTI / SEC Business Registration Certificate', required: true },
  { key: 'business_permit', label: "Mayor's / Business Permit", required: true },
  { key: 'government_id', label: "Owner's Valid Government ID", required: true },
  { key: 'bir_certificate', label: 'BIR Certificate of Registration (Form 2303)', required: false },
  { key: 'fire_safety', label: 'Fire Safety Inspection Certificate (BFP)', required: false },
  { key: 'doe_accreditation', label: 'DOE LPG Dealer / Retailer Accreditation', required: false },
  { key: 'store_photo', label: 'Photo of Store Front', required: false },
];

export const MAX_DOC_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
