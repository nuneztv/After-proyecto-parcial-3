import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  // Field validation message, shown under the input
  error?: string;
  children: ReactNode;
}

export const FormField = ({ label, error, children }: FormFieldProps) => {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      {children}
      {error && (
        <span className="form-field__error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
};
