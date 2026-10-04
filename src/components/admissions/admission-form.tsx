'use client';

import { useState } from 'react';

import { createAdmission } from '@/app/actions/admissions';

type AdmissionDraft = {
  applicantName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  classId: string;
  sessionId: string;
  source: string;
  notes: string;
};

const steps = ['Student information', 'Parent / guardian', 'Academic details', 'Review application'];

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  color: 'var(--foreground)',
  font: 'inherit',
  padding: '12px 14px',
  width: '100%',
};

export function AdmissionForm({
  classes,
  sessions,
}: {
  classes: Array<{ id: string; name: string }>;
  sessions: Array<{ id: string; name: string; isCurrent: boolean }>;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<AdmissionDraft>({
    applicantName: '',
    dateOfBirth: '',
    gender: 'prefer_not_to_say',
    phone: '',
    email: '',
    guardianName: '',
    guardianPhone: '',
    address: '',
    classId: '',
    sessionId: sessions.find((session) => session.isCurrent)?.id ?? '',
    source: 'walk_in',
    notes: '',
  });

  const updateField = (field: keyof AdmissionDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const selectedClass = classes.find((item) => item.id === draft.classId)?.name ?? 'Not selected';
  const selectedSession = sessions.find((item) => item.id === draft.sessionId)?.name ?? 'Not selected';

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
      <div style={{ borderBottom: '1px solid var(--line)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ color: 'var(--brand-primary)', fontSize: 12, fontWeight: 750, letterSpacing: '.1em', margin: 0, textTransform: 'uppercase' }}>New application</p>
            <h2 style={{ color: 'var(--brand-secondary)', fontSize: 22, margin: '7px 0 0' }}>{steps[stepIndex]}</h2>
          </div>
          <span style={{ color: 'var(--ink-soft)', fontSize: 13, paddingTop: 4 }}>Step {stepIndex + 1} of {steps.length}</span>
        </div>
        <div aria-hidden="true" style={{ background: 'var(--surface-soft)', borderRadius: 99, height: 5, marginTop: 16, overflow: 'hidden' }}>
          <div style={{ background: 'var(--brand-primary)', height: '100%', transition: 'width .2s ease', width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <form
        action={createAdmission}
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          if (submitter instanceof HTMLButtonElement && submitter.name === 'status') return;
          if (stepIndex < steps.length - 1) {
            event.preventDefault();
            setStepIndex((current) => Math.min(current + 1, steps.length - 1));
          }
        }}
        style={{ display: 'grid', gap: 20, padding: 20 }}
      >
        <input type="hidden" name="applicationData" value={JSON.stringify(draft)} />
        {stepIndex === 0 && (
          <div style={fieldGridStyle}>
            <Field label="Applicant full name">
              <input name="applicantName" required value={draft.applicantName} onChange={(event) => updateField('applicantName', event.currentTarget.value)} style={inputStyle} autoComplete="name" />
            </Field>
            <Field label="Date of birth">
              <input type="date" name="dateOfBirth" value={draft.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.currentTarget.value)} style={inputStyle} />
            </Field>
            <Field label="Gender">
              <select name="gender" value={draft.gender} onChange={(event) => updateField('gender', event.currentTarget.value)} style={inputStyle}>
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
              </select>
            </Field>
            <Field label="Applicant phone">
              <input name="phone" type="tel" value={draft.phone} onChange={(event) => updateField('phone', event.currentTarget.value)} style={inputStyle} autoComplete="tel" />
            </Field>
            <Field label="Applicant email">
              <input name="email" type="email" value={draft.email} onChange={(event) => updateField('email', event.currentTarget.value)} style={inputStyle} autoComplete="email" />
            </Field>
          </div>
        )}

        {stepIndex === 1 && (
          <div style={fieldGridStyle}>
            <Field label="Parent / guardian name">
              <input name="guardianName" value={draft.guardianName} onChange={(event) => updateField('guardianName', event.currentTarget.value)} style={inputStyle} autoComplete="additional-name" />
            </Field>
            <Field label="Guardian phone">
              <input name="guardianPhone" type="tel" value={draft.guardianPhone} onChange={(event) => updateField('guardianPhone', event.currentTarget.value)} style={inputStyle} autoComplete="tel" />
            </Field>
            <Field label="Home address">
              <textarea name="address" value={draft.address} onChange={(event) => updateField('address', event.currentTarget.value)} style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} autoComplete="street-address" />
            </Field>
          </div>
        )}

        {stepIndex === 2 && (
          <div style={fieldGridStyle}>
            <Field label="Applying for class">
              <select name="classId" value={draft.classId} onChange={(event) => updateField('classId', event.currentTarget.value)} style={inputStyle}>
                <option value="">Select a class</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Academic session">
              <select name="sessionId" value={draft.sessionId} onChange={(event) => updateField('sessionId', event.currentTarget.value)} style={inputStyle}>
                <option value="">Select a session</option>
                {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isCurrent ? ' (Current)' : ''}</option>)}
              </select>
            </Field>
            <Field label="How did they hear about us?">
              <select name="source" value={draft.source} onChange={(event) => updateField('source', event.currentTarget.value)} style={inputStyle}>
                <option value="walk_in">Walk-in</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="social_media">Social media</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Medical / additional notes">
              <textarea name="notes" value={draft.notes} onChange={(event) => updateField('notes', event.currentTarget.value)} style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} />
            </Field>
          </div>
        )}

        {stepIndex === 3 && (
          <div style={{ background: 'var(--surface-soft)', border: '1px solid var(--line)', borderRadius: 12, padding: 18 }}>
            <h3 style={{ color: 'var(--brand-secondary)', margin: '0 0 14px' }}>{draft.applicantName || 'Applicant details'}</h3>
            <dl style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', margin: 0 }}>
              <SummaryItem label="Date of birth" value={draft.dateOfBirth || 'Not provided'} />
              <SummaryItem label="Gender" value={draft.gender.replaceAll('_', ' ')} />
              <SummaryItem label="Phone" value={draft.phone || 'Not provided'} />
              <SummaryItem label="Email" value={draft.email || 'Not provided'} />
              <SummaryItem label="Parent / guardian" value={draft.guardianName || 'Not provided'} />
              <SummaryItem label="Guardian phone" value={draft.guardianPhone || 'Not provided'} />
              <SummaryItem label="Class" value={selectedClass} />
              <SummaryItem label="Academic session" value={selectedSession} />
              <SummaryItem label="Source" value={draft.source.replaceAll('_', ' ')} />
              <SummaryItem label="Address" value={draft.address || 'Not provided'} />
              <SummaryItem label="Additional notes" value={draft.notes || 'None'} />
            </dl>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', paddingTop: 16 }}>
          <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => Math.max(current - 1, 0))} style={buttonStyle(false)}>{'← Previous'}</button>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="submit" name="status" value="draft" formNoValidate style={buttonStyle(false)}>Save as draft</button>
            {stepIndex < steps.length - 1
              ? <button type="submit" style={buttonStyle(true)}>Continue →</button>
              : <button type="submit" name="status" value="submitted" style={buttonStyle(true)}>Submit application</button>}
          </div>
        </div>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ color: 'var(--brand-secondary)', display: 'grid', fontSize: 13, fontWeight: 650, gap: 8 }}>{label}{children}</label>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div><dt style={{ color: 'var(--ink-soft)', fontSize: 11, textTransform: 'uppercase' }}>{label}</dt><dd style={{ color: 'var(--foreground)', fontSize: 14, margin: '4px 0 0', overflowWrap: 'anywhere' }}>{value}</dd></div>;
}

function buttonStyle(primary: boolean): React.CSSProperties {
  return {
    background: primary ? 'var(--brand-primary)' : 'var(--surface)',
    border: `1px solid ${primary ? 'var(--brand-primary)' : 'var(--line)'}`,
    borderRadius: 9,
    color: primary ? '#fff' : 'var(--brand-secondary)',
    cursor: 'pointer',
    font: 'inherit',
    fontSize: 13,
    fontWeight: 700,
    padding: '11px 15px',
  };
}

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
};
