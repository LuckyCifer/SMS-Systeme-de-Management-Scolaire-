import { useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE   = /^\+?[\d\s\-()\/.]{8,20}$/;

function checkRule(rule, value) {
  const v = typeof value === 'string' ? value.trim() : value;
  if (rule.required && !v) return rule.requiredMsg || 'Ce champ est requis';
  if (!v) return '';
  if (rule.email && !EMAIL_RE.test(v))          return 'Adresse e-mail invalide';
  if (rule.tel   && !TEL_RE.test(v))            return 'Numéro de téléphone invalide';
  if (rule.minLen && v.length < rule.minLen)    return `Minimum ${rule.minLen} caractères`;
  if (rule.maxLen && v.length > rule.maxLen)    return `Maximum ${rule.maxLen} caractères`;
  if (rule.numeric && isNaN(Number(v)))         return 'Valeur numérique requise';
  if (rule.min !== undefined && Number(v) < rule.min) return `Valeur minimum : ${rule.min}`;
  if (rule.custom) return rule.custom(v) || '';
  return '';
}

/**
 * @param {Record<string, object>} rules  — keyed by field name
 *   Each rule: { required, requiredMsg, email, tel, minLen, maxLen, numeric, min, custom }
 */
export function useFormValidation(rules = {}) {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = (name, value) => {
    const rule = rules[name];
    if (!rule) return '';
    const msg = checkRule(rule, value);
    setErrors(p => ({ ...p, [name]: msg }));
    return msg;
  };

  const onBlur = (name, value) => {
    setTouched(p => ({ ...p, [name]: true }));
    validateField(name, value);
  };

  const onChange = (name, value) => {
    if (touched[name]) validateField(name, value);
  };

  const validateAll = (formData) => {
    const newErrors = {};
    let valid = true;
    for (const [name, rule] of Object.entries(rules)) {
      const msg = checkRule(rule, formData[name] ?? '');
      if (msg) { newErrors[name] = msg; valid = false; }
    }
    setErrors(newErrors);
    setTouched(Object.fromEntries(Object.keys(rules).map(k => [k, true])));
    return valid;
  };

  const reset = () => { setErrors({}); setTouched({}); };

  return { errors, validateField, validateAll, onBlur, onChange, reset };
}
