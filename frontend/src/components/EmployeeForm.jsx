/**
 * @fileoverview Employee Form Component (Formik + Yup)
 * @description A comprehensive, accessible form for creating and editing employees.
 * Uses Formik for state management and Yup for strict client-side validation.
 * Supports dark/light mode and provides inline error messaging.
 *
 * Issue: #733
 */

import { Formik, Form, Field, ErrorMessage, useFormikContext } from 'formik';
import PropTypes from 'prop-types';
import {
  employeeValidationSchema,
  initialEmployeeValues,
} from '../validation/employeeSchema';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { useEffect } from 'react';
import { useAutoSaveDraft, getDraft } from '../hooks/useAutoSaveDraft';
import { db } from '../db/db';
import CustomFieldsSection from './CustomFieldsSection';

/**
 * Reusable Input Field with Label and Error Message
 */
const FormField = ({
  label,
  name,
  type = 'text',
  placeholder,
  required,
  as = 'input',
  children,
}) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label
      htmlFor={name}
      className="block text-sm font-semibold text-gray-700 dark:text-slate-300"
    >
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {as === 'select' ? (
      <Field
        as="select"
        id={name}
        name={name}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        {children}
      </Field>
    ) : (
      <Field
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      />
    )}
    <ErrorMessage
      name={name}
      component="div"
      className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1"
    />
  </div>
);

FormField.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  as: PropTypes.string,
  children: PropTypes.node,
};

/**
 * AutoSave Component for Formik
 */
function AutoSaveFormik({ formId }) {
  const { values, setValues } = useFormikContext();
  const { clearDraft } = useAutoSaveDraft(formId, values, 2000);

  useEffect(() => {
    getDraft(formId).then((draft) => {
      if (draft && draft.data) {
        if (
          window.confirm(
            'You have an unsaved draft for this form. Do you want to restore it?',
          )
        ) {
          setValues(draft.data);
        } else {
          clearDraft();
        }
      }
    });
  }, [formId, clearDraft, setValues]);

  return null;
}

/**
 * Main Employee Form Component
 */
export default function EmployeeForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  isEdit,
}) {
  const mergedInitialValues = {
    ...initialEmployeeValues,
    ...initialValues,
    // Format dates for HTML date inputs (YYYY-MM-DD)
    dateOfBirth: initialValues?.dateOfBirth
      ? new Date(initialValues.dateOfBirth).toISOString().split('T')[0]
      : '',
    joiningDate: initialValues?.joiningDate
      ? new Date(initialValues.joiningDate).toISOString().split('T')[0]
      : '',
  };

  return (
    <Formik
      initialValues={mergedInitialValues}
      validationSchema={employeeValidationSchema}
      onSubmit={async (values, { setSubmitting, setErrors }) => {
        try {
          // Clean up empty strings to null for optional fields
          const cleanedValues = {
            ...values,
            email: values.email === '' ? null : values.email,
            department: values.department === '' ? null : values.department,
            overtimeRate:
              values.overtimeRate === '' ? 0 : Number(values.overtimeRate),
            monthlySalary: Number(values.monthlySalary),
            dateOfBirth:
              values.dateOfBirth === ''
                ? null
                : new Date(values.dateOfBirth).toISOString(),
            joiningDate:
              values.joiningDate === ''
                ? null
                : new Date(values.joiningDate).toISOString(),
            bankDetails: {
              bankName: values.bankDetails?.bankName || '',
              accountNumber: values.bankDetails?.accountNumber || '',
              routingCode: values.bankDetails?.routingCode || '',
            },
          };
          await onSubmit(cleanedValues);
          if (!isEdit) {
            await db.drafts.delete('addEmployeeDraft');
          }
        } catch (error) {
          // Map backend validation errors to Formik fields if needed
          if (error.response?.data?.errors) {
            setErrors(error.response.data.errors);
          }
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isValid, dirty, isSubmitting: formikSubmitting }) => (
        <Form className="space-y-8 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
          {!isEdit && <AutoSaveFormik formId="addEmployeeDraft" />}

          {/* Personal Information Section */}
          <fieldset className="space-y-6">
            <legend className="text-lg font-bold text-gray-900 dark:text-white px-2">
              Personal Information
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Full Name"
                name="fullName"
                placeholder="e.g. Jane Doe"
                required
              />
              <FormField
                label="Email Address"
                name="email"
                type="email"
                placeholder="jane@example.com"
              />
              <FormField label="Date of Birth" name="dateOfBirth" type="date" />
              <FormField label="Joining Date" name="joiningDate" type="date" />
            </div>
          </fieldset>

          {/* Employment Details Section */}
          <fieldset className="space-y-6 border-t border-gray-200 dark:border-slate-700 pt-6">
            <legend className="text-lg font-bold text-gray-900 dark:text-white px-2">
              Employment Details
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Role / Designation"
                name="role"
                placeholder="e.g. Software Engineer"
                required
              />
              <FormField
                label="Department"
                name="department"
                placeholder="e.g. Engineering"
              />
              <FormField label="Currency" name="currency" as="select" required>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </FormField>
            </div>
          </fieldset>

          <CustomFieldsSection entityType="Employee" />

          {/* Compensation Section */}
          <fieldset className="space-y-6 border-t border-gray-200 dark:border-slate-700 pt-6">
            <legend className="text-lg font-bold text-gray-900 dark:text-white px-2">
              Compensation
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Monthly Salary"
                name="monthlySalary"
                type="number"
                placeholder="e.g. 50000"
                required
              />
              <FormField
                label="Overtime Rate (per hour)"
                name="overtimeRate"
                type="number"
                placeholder="e.g. 250"
              />
            </div>
          </fieldset>

          {/* Bank Details Section */}
          <fieldset className="space-y-6 border-t border-gray-200 dark:border-slate-700 pt-6">
            <legend className="text-lg font-bold text-gray-900 dark:text-white px-2">
              Bank Details (Optional)
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                label="Bank Name"
                name="bankDetails.bankName"
                placeholder="e.g. HDFC Bank"
              />
              <FormField
                label="Account Number"
                name="bankDetails.accountNumber"
                placeholder="e.g. 1234567890"
              />
              <FormField
                label="Routing / IFSC Code"
                name="bankDetails.routingCode"
                placeholder="e.g. HDFC0001234"
              />
            </div>
          </fieldset>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 border-t border-gray-200 dark:border-slate-700 pt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={formikSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <CancelIcon fontSize="small" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={formikSubmitting || (!isValid && dirty)}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md shadow-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formikSubmitting ? (
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <SaveIcon fontSize="small" />
              )}
              {isEdit ? 'Update Employee' : 'Save Employee'}
            </button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

EmployeeForm.propTypes = {
  initialValues: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
  isEdit: PropTypes.bool,
};
