import { Icon } from '../Icon/Icon';
import type { IconName } from '../Icon/Icon';

interface AuthInputProps {
  icon: IconName;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  disabled?: boolean;
}

export const AuthInput = ({
  icon,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
  disabled = false,
}: AuthInputProps) => {
  return (
    <label className="auth-input">
      <Icon name={icon} size={18} />
      <input
        type={type}
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
};
