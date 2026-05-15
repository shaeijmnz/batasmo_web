import { useEffect, useState } from 'react';
import {
  CONSULTATION_SUMMARY_SECTIONS,
  parseConsultationSummary,
  serializeConsultationSummary,
} from '../lib/consultationSummaryFormat';
import './ConsultationSummaryForm.css';

export default function ConsultationSummaryForm({
  value = '',
  onChange,
  disabled = false,
  idPrefix = 'consultation-summary',
}) {
  const [sections, setSections] = useState(() => parseConsultationSummary(value).sections);

  useEffect(() => {
    setSections(parseConsultationSummary(value).sections);
  }, [value]);

  const updateSection = (key, text) => {
    const next = { ...sections, [key]: text };
    setSections(next);
    onChange(serializeConsultationSummary(next));
  };

  return (
    <div className="csf-form">
      <p className="csf-form__intro">
        Fill in the sections below. Only completed sections are shown to your client.
      </p>
      {CONSULTATION_SUMMARY_SECTIONS.map((section, index) => (
        <section key={section.key} className="csf-section">
          <div className="csf-section__heading">
            <h4 className="csf-section__title" id={`${idPrefix}-${section.key}-label`}>
              {section.title}
            </h4>
            <p className="csf-section__subtitle">{section.subtitle}</p>
          </div>
          <textarea
            className="csf-section__input"
            id={`${idPrefix}-${section.key}`}
            aria-labelledby={`${idPrefix}-${section.key}-label`}
            rows={index === 0 ? 4 : 3}
            maxLength={3000}
            placeholder={section.placeholder}
            value={sections[section.key] || ''}
            onChange={(e) => updateSection(section.key, e.target.value)}
            disabled={disabled}
          />
        </section>
      ))}
    </div>
  );
}
