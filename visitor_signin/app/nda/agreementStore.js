const AGREEMENT_KEY = "agreement";
const SIGNED_KEY = "signedAgreements";

export const defaultAgreement = {
  title: "Visitor Non-Disclosure Agreement",
  version: "1.0",
  text: `By signing this agreement, I confirm that:

1. I will keep confidential any information I see or hear during my visit.
2. I will not take photos or recordings inside the premises without permission.
3. I will not share business, customer or product information with anyone outside the company.
4. I will follow all safety rules and instructions given by my host or security staff.
5. This agreement stays in force even after my visit ends.`,
};

// get the agreement the admin saved (or the default one)
export function getAgreement() {
  try {
    const saved = JSON.parse(localStorage.getItem(AGREEMENT_KEY));
    return saved || defaultAgreement;
  } catch {
    return defaultAgreement;
  }
}

export function saveAgreement(agreement) {
  localStorage.setItem(AGREEMENT_KEY, JSON.stringify(agreement));
}

// all signed copies
export function getSigned() {
  try {
    return JSON.parse(localStorage.getItem(SIGNED_KEY)) || [];
  } catch {
    return [];
  }
}

export function addSigned(record) {
  const all = getSigned();
  all.push(record);
  localStorage.setItem(SIGNED_KEY, JSON.stringify(all));
}