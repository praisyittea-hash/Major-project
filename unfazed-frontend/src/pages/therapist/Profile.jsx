import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext.jsx';
import api, { messageOf } from '../../api/axiosInstance.js';
export default function Profile() {
  const { therapist, setTherapist } = useAuth();
  const [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      ...therapist,
      specializations: therapist.specializations.join(', '),
      languages: therapist.languages.join(', '),
      services: therapist.services.map((s) => ({ ...s, rate: s.rate / 100 })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'services' });
  async function submit(values) {
    setError('');
    setSaved(false);
    try {
      const { data } = await api.patch('/therapists/me', {
        ...values,
        specializations: values.specializations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        languages: values.languages
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        services: values.services.map((s) => ({
          ...s,
          duration: Number(s.duration),
          rate: Math.round(Number(s.rate) * 100),
        })),
      });
      setTherapist(data.therapist);
      setSaved(true);
    } catch (e) {
      setError(messageOf(e));
    }
  }
  return (
    <main>
      <p className="eyebrow">YOUR BRANDED SPACE</p>
      <h1>Your profile</h1>
      {therapist.slug && (
        <p>
          Your link:{' '}
          <a href={`/${therapist.slug}`}>
            {location.origin}/{therapist.slug}
          </a>
        </p>
      )}
      <form className="card" onSubmit={handleSubmit(submit)}>
        <div className="grid">
          <label>
            Branded link slug
            <input
              {...register('slug')}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              minLength={3}
              maxLength={63}
            />
          </label>
          <label>
            Name
            <input {...register('name')} required minLength={2} />
          </label>
          <label>
            Practice timezone
            <input {...register('timezone')} required />
          </label>
        </div>
        <label>
          About your practice
          <textarea {...register('bio')} rows={5} maxLength={3000} />
        </label>
        <div className="grid">
          <label>
            Specializations (comma separated)
            <input {...register('specializations')} />
          </label>
          <label>
            Languages (comma separated)
            <input {...register('languages')} />
          </label>
        </div>
        <h2>Services</h2>
        <p className="muted">Set your own fees in INR.</p>
        {fields.map((field, i) => (
          <div className="card" key={field.id}>
            <div className="grid">
              <label>
                Service name
                <input {...register(`services.${i}.name`)} required />
              </label>
              <label>
                Duration
                <select {...register(`services.${i}.duration`)}>
                  {[30, 45, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d} minutes
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fee (INR)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register(`services.${i}.rate`)}
                  required
                />
              </label>
            </div>
            <label>
              Description
              <textarea {...register(`services.${i}.description`)} />
            </label>
            <button type="button" className="secondary" onClick={() => remove(i)}>
              Remove service
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() => append({ name: '', description: '', duration: 60, rate: 0 })}
        >
          Add service
        </button>
        <p>
          {error && (
            <span role="alert" className="error">
              {error}
            </span>
          )}
          {saved && (
            <span role="status" className="success">
              Profile saved.
            </span>
          )}
        </p>
        <button disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save profile'}</button>
      </form>
    </main>
  );
}
