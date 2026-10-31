import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { emailSchema, passwordSchema } from '../../lib/zodHelpers';
import { api } from '../../api/client';
import { FormField } from '../../components/FormField';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { UserPlus, Shield, CheckCircle2 } from 'lucide-react';

const staffFormSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  email: emailSchema,
  password: passwordSchema,
});

type StaffFormValues = z.infer<typeof staffFormSchema>;

export const StaffPage: React.FC = () => {
  const toast = useToast();
  const [createdUser, setCreatedUser] = useState<{ id: number; email: string; full_name: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
  });

  const onSubmit = async (values: StaffFormValues) => {
    setCreatedUser(null);
    try {
      const { data, error, response } = await api.POST('/auth/staff', {
        body: {
          full_name: values.full_name.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
        },
      });

      if (response.status === 409) {
        toast.error((error as any)?.detail || 'An account with this email already exists.');
        setError('email', { message: 'This email is already in use' });
        return;
      }

      if (error || !data) {
        const msg = (error as any)?.detail || 'Failed to create staff account.';
        toast.error(msg);
        return;
      }

      toast.success(`Staff user "${data.full_name}" created successfully!`);
      setCreatedUser({ id: data.id, email: data.email, full_name: data.full_name });
      reset();
    } catch {
      toast.error('Network error while connecting to server.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create internal staff accounts with billing and catalog operator access.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Create New Staff Member</h2>
              <p className="text-xs text-slate-500">Staff can manage products, subscriptions, and process payments</p>
            </div>
          </div>

          {createdUser && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  Staff account created successfully!
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  ID: #{createdUser.id} • {createdUser.full_name} ({createdUser.email})
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Full Name" htmlFor="full_name" error={errors.full_name?.message} required>
              <input
                id="full_name"
                type="text"
                {...register('full_name')}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField label="Email Address" htmlFor="email" error={errors.email?.message} required>
              <input
                id="email"
                type="email"
                {...register('email')}
                placeholder="staff@brightloop.local"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <FormField
              label="Temporary Password"
              htmlFor="password"
              error={errors.password?.message}
              helperText="Must be >8 characters with uppercase, lowercase, and special characters."
              required
            >
              <input
                id="password"
                type="password"
                {...register('password')}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </FormField>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-2xs transition disabled:opacity-60"
              >
                {isSubmitting ? <Spinner size="sm" className="text-white" label="Creating..." /> : 'Create Staff Member'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-5 space-y-4 self-start">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Shield className="w-4 h-4 text-indigo-600" />
            Role Capabilities
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Staff users have operational access to:
          </p>
          <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
            <li>View and record invoice payments</li>
            <li>View subscriptions and quotations</li>
            <li>View and edit products and plans</li>
            <li>Access finance analytics overview</li>
          </ul>
          <div className="pt-3 border-t border-slate-200 text-xs text-slate-500">
            <strong>Restricted from:</strong> Creating tax rates, configuring system discounts, or provisioning staff accounts.
          </div>
        </div>
      </div>
    </div>
  );
};
