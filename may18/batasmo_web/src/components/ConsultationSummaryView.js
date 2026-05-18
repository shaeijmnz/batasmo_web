import {
  CONSULTATION_SUMMARY_SECTIONS,
  parseConsultationSummary,
} from '../lib/consultationSummaryFormat';
import './ConsultationSummaryForm.css';

export default function ConsultationSummaryView({ summary, className = '' }) {
  const text = String(summary || '').trim();
  if (!text) return null;

  const { sections, hasStructure, legacyText } = parseConsultationSummary(text);

  if (!hasStructure) {
    return (
      <div className={`csf-view ${className}`.trim()}>
        <p className="csf-view__body">{legacyText || text}</p>
      </div>
    );
  }

  const filledSections = CONSULTATION_SUMMARY_SECTIONS.filter((section) =>
    String(sections[section.key] || '').trim(),
  );

  if (!filledSections.length) return null;

  return (
    <div className={`csf-view ${className}`.trim()}>
      {filledSections.map((section) => (
        <article key={section.key} className="csf-view__block">
          <h4 className="csf-view__header">{section.title}</h4>
          <p className="csf-view__subheader">{section.subtitle}</p>
          <p className="csf-view__body">{sections[section.key]}</p>
        </article>
      ))}
    </div>
  );
}
