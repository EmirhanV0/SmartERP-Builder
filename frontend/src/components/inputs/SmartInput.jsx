import { detectInputType } from '../../utils/detectInputType';
import TextInput from './TextInput';
import DateInput from './DateInput';
import PhoneInput from './PhoneInput';
import EmailInput from './EmailInput';
import NumberInput from './NumberInput';
import NumberWithUnitInput from './NumberWithUnitInput';
import EnumDropdown from './EnumDropdown';
import TextareaInput from './TextareaInput';
import TCKimlikInput from './TCKimlikInput';
import CurrencyInput from './CurrencyInput';
import GenderSelector from './GenderSelector';

export default function SmartInput({ field, value, onChange, disabled = false }) {
  const name = field.name || field;
  // Use input_type (original frontend type) if stored, else fall back to type (DDL type)
  const { inputType, ...config } = detectInputType(
    field.name,
    field.input_type || field.type,
    field.enum_values,
  );
  const val = value?.[name] ?? '';

  switch (inputType) {
    case 'date':
      return <DateInput name={name} value={val} onChange={onChange} disabled={disabled} />;
    case 'phone':
      return <PhoneInput name={name} value={val} onChange={onChange} disabled={disabled} />;
    case 'email':
      return <EmailInput name={name} value={val} onChange={onChange} disabled={disabled} />;
    case 'tc_kimlik':
      return <TCKimlikInput name={name} value={val} onChange={onChange} disabled={disabled} />;
    case 'currency':
      // Pass whole value (formData) so CurrencyInput can read/write both amount and _currency
      return <CurrencyInput
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        defaultCurrency={field.default_currency || config.defaultCurrency || 'TRY'}
      />;
    case 'number_with_unit':
      return <NumberWithUnitInput name={name} value={value} onChange={onChange} disabled={disabled} units={config.units} defaultUnit={config.defaultUnit} />;
    case 'enum':
      return <EnumDropdown name={name} value={val} onChange={onChange} disabled={disabled} options={config.options} />;
    case 'gender':
      return <GenderSelector name={name} value={val} onChange={onChange} disabled={disabled} />;
    case 'number':
      return <NumberInput name={name} value={val} onChange={onChange} disabled={disabled} step={config.step} />;
    case 'textarea':
      return <TextareaInput name={name} value={val} onChange={onChange} disabled={disabled} />;
    default:
      return <TextInput name={name} value={val} onChange={onChange} disabled={disabled} />;
  }
}

export function buildInitialFormData(fields) {
  const data = {};
  (fields || []).forEach((f) => {
    const name = f.name || f;
    data[name] = '';
    const { inputType, defaultUnit, defaultCurrency } = detectInputType(
      f.name, f.input_type || f.type, f.enum_values,
    );
    if (inputType === 'number_with_unit') {
      data[`${name}_unit`] = defaultUnit;
    }
    if (inputType === 'currency') {
      // Use field-level default_currency if stored, else detected default
      data[`${name}_currency`] = f.default_currency || defaultCurrency || 'TRY';
    }
  });
  return data;
}

export function enrichEditFormData(payload, fields) {
  const data = { ...(payload || {}) };
  (fields || []).forEach((f) => {
    const name = f.name || f;
    const { inputType, defaultUnit, defaultCurrency } = detectInputType(
      f.name, f.input_type || f.type, f.enum_values,
    );
    if (inputType === 'number_with_unit' && !data[`${name}_unit`]) {
      data[`${name}_unit`] = defaultUnit;
    }
    if (inputType === 'currency' && !data[`${name}_currency`]) {
      // Backward compat: old records without _currency default to TRY
      data[`${name}_currency`] = f.default_currency || defaultCurrency || 'TRY';
    }
  });
  return data;
}
