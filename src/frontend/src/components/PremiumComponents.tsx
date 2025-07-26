import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  Search, 
  Check, 
  X, 
  AlertCircle, 
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

// Premium Input with Floating Label
export const PremiumInput: React.FC<{
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  success?: boolean;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}> = ({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  error, 
  success, 
  placeholder = '', 
  disabled = false,
  required = false 
}) => {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isFloating = focused || value.length > 0;
  const actualType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className="premium-form-group">
      <div className="relative">
        <input
          ref={inputRef}
          type={actualType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused ? placeholder : ''}
          disabled={disabled}
          required={required}
          className={`premium-input ${error ? 'border-red-300 focus:border-red-500' : success ? 'border-green-300 focus:border-green-500' : ''}`}
        />
        
        <label 
          className={`premium-label ${isFloating ? 'transform -translate-y-6 scale-85' : ''} ${
            focused ? 'text-blue-600' : error ? 'text-red-500' : success ? 'text-green-500' : ''
          }`}
          onClick={() => inputRef.current?.focus()}
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        {/* Password Toggle */}
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}

        {/* Status Icons */}
        {!disabled && (type !== 'password' || !showPassword) && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {error && <AlertCircle className="w-5 h-5 text-red-500" />}
            {success && <CheckCircle className="w-5 h-5 text-green-500" />}
          </div>
        )}
      </div>
      
      {/* Error/Success Message */}
      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
      {success && !error && (
        <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          Looks good!
        </p>
      )}
    </div>
  );
};

// Premium Dropdown with Search
export const PremiumDropdown: React.FC<{
  label: string;
  options: { value: string; label: string; description?: string }[];
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}> = ({ 
  label, 
  options, 
  value, 
  onChange, 
  searchable = false, 
  placeholder = 'Select an option...',
  error,
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option.description && option.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="premium-form-group">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      
      <div ref={dropdownRef} className={`premium-dropdown ${isOpen ? 'open' : ''}`}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`premium-dropdown-trigger w-full text-left ${error ? 'border-red-300' : ''}`}
        >
          <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className="premium-dropdown-content">
          {searchable && (
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search options..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
          
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`premium-dropdown-item w-full text-left ${
                    option.value === value ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-sm text-gray-500">{option.description}</div>
                      )}
                    </div>
                    {option.value === value && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
};

// Premium Toggle Switch
export const PremiumToggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ label, description, checked, onChange, disabled = false }) => {
  return (
    <div className="flex items-start gap-3">
      <div className="premium-toggle">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className="premium-toggle-slider" />
      </div>
      
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-900 cursor-pointer" onClick={() => !disabled && onChange(!checked)}>
          {label}
        </label>
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
};

// Premium Button with Loading State
export const PremiumButton: React.FC<{
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ComponentType<any>;
  className?: string;
}> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled = false, 
  onClick,
  type = 'button',
  icon: Icon,
  className = ''
}) => {
  const baseClasses = 'premium-btn';
  const variantClasses = {
    primary: 'premium-btn-primary',
    secondary: 'premium-btn-secondary', 
    ghost: 'premium-btn-ghost',
    danger: 'premium-btn-primary bg-red-600 hover:bg-red-700'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {loading ? (
        <>
          <div className="premium-spinner" />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4" />}
          {children}
        </>
      )}
    </button>
  );
};

// Premium Badge Component
export const PremiumBadge: React.FC<{
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  icon?: React.ComponentType<any>;
}> = ({ children, variant = 'primary', size = 'md', icon: Icon }) => {
  const variantClasses = {
    primary: 'premium-badge-primary',
    success: 'premium-badge-success',
    warning: 'premium-badge-warning', 
    danger: 'premium-badge-danger',
    info: 'premium-badge-primary'
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1'
  };

  return (
    <span className={`premium-badge ${variantClasses[variant]} ${sizeClasses[size]}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
};

// Premium Modal
export const PremiumModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg', 
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className={`inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:w-full ${sizeClasses[size]}`}>
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white px-6 py-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Premium Progress Bar
export const PremiumProgress: React.FC<{
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
}> = ({ value, max = 100, label, showValue = true, color = 'blue', size = 'md' }) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showValue && <span className="text-sm text-gray-500">{value}/{max}</span>}
        </div>
      )}
      
      <div className={`premium-progress-bar ${sizeClasses[size]}`}>
        <div 
          className={`premium-progress-fill ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};