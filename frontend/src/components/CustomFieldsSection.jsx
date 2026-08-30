import { useState, useEffect } from 'react';
import { Field, ErrorMessage } from 'formik';
import api from '../services/api';

export default function CustomFieldsSection({ entityType }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const response = await api.get(
          `/custom-fields?entityType=${entityType}`,
        );
        setFields(response.data);
      } catch (error) {
        console.error('Failed to fetch custom fields:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFields();
  }, [entityType]);

  if (loading || fields.length === 0) return null;

  return (
    <fieldset className="space-y-6 border-t border-gray-200 dark:border-slate-700 pt-6">
      <legend className="text-lg font-bold text-gray-900 dark:text-white px-2">
        Additional Information
      </legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {fields.map((field) => (
          <div key={field.fieldKey} className="flex flex-col gap-1.5 w-full">
            <label
              htmlFor={`customData.${field.fieldKey}`}
              className="block text-sm font-semibold text-gray-700 dark:text-slate-300"
            >
              {field.label}{' '}
              {field.validationRules?.required && (
                <span className="text-red-500">*</span>
              )}
            </label>
            {field.fieldType === 'dropdown' ? (
              <Field
                as="select"
                id={`customData.${field.fieldKey}`}
                name={`customData.${field.fieldKey}`}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Select...</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Field>
            ) : (
              <Field
                id={`customData.${field.fieldKey}`}
                name={`customData.${field.fieldKey}`}
                type={field.fieldType}
                maxLength={field.validationRules?.maxLength}
                min={field.validationRules?.min}
                max={field.validationRules?.max}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            )}
            <ErrorMessage
              name={`customData.${field.fieldKey}`}
              component="div"
              className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1"
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
