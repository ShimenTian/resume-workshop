import type { CSSProperties, ReactNode } from 'react';
import { Link2, Mail, MapPin, Phone } from 'lucide-react';
import type { ResumeDocument, ResumeProfile } from '../lib/resume';
import './ResumePaper.css';

interface ResumePaperProps {
  resume: ResumeDocument;
  compact?: boolean;
}

interface EntryProps {
  title: string;
  subtitle: string;
  period: string;
  description: string;
}

function Description({ text, paragraphs = false }: { text: string; paragraphs?: boolean }) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  if (paragraphs || lines.length === 1) {
    return <div className="resume-description">{lines.map((line, index) => <p key={index}>{line}</p>)}</div>;
  }

  return (
    <ul className="resume-description resume-description-list">
      {lines.map((line, index) => <li key={index}>{line.replace(/^(?:[-*•·]\s*|\d+[.)、]\s*)/, '')}</li>)}
    </ul>
  );
}

function ContactDetails({ profile }: { profile: ResumeProfile }) {
  const contacts = [
    { text: profile.phone, label: '电话', Icon: Phone },
    { text: profile.email, label: '邮箱', Icon: Mail },
    { text: profile.city, label: '所在城市', Icon: MapPin },
    { text: profile.website, label: '个人网站', Icon: Link2 },
  ].filter(({ text }) => text.trim());
  if (!contacts.length) return null;

  return (
    <ul className="resume-contacts" aria-label="联系方式">
      {contacts.map(({ text, label, Icon }) => (
        <li key={label} title={label}>
          <Icon size={14} strokeWidth={1.7} aria-hidden="true" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="resume-section">
      <h2 className="resume-section-title">{title}</h2>
      {children}
    </section>
  );
}

function Entry({ title, subtitle, period, description }: EntryProps) {
  if (![title, subtitle, period, description].some((text) => text.trim())) return null;

  return (
    <div className="resume-entry">
      {(title.trim() || period.trim()) && <div className="resume-entry-heading">
        {title.trim() && <h3>{title}</h3>}
        {period.trim() && <span className="resume-entry-period">{period}</span>}
      </div>}
      {subtitle.trim() && <p className="resume-entry-subtitle">{subtitle}</p>}
      <Description text={description} />
    </div>
  );
}

function Skills({ skills }: { skills: string }) {
  const items = skills.split(/\r?\n|[、，;；]|\s+\/\s+/).map((item) => item.trim()).filter(Boolean);
  if (!items.length) return null;

  return (
    <Section title="专业技能">
      <ul className="resume-skill-list">
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </Section>
  );
}

/** Full-size A4 document; its preview container owns any visual scaling. */
export function ResumePaper({ resume, compact = false }: ResumePaperProps) {
  const { profile, experiences, education, projects, skills } = resume;
  const sidebar = resume.templateId === 'sidebar';
  const visibleExperiences = experiences.filter(({ company, role, period, description }) => [company, role, period, description].some((text) => text.trim()));
  const visibleEducation = education.filter(({ school, degree, period, description }) => [school, degree, period, description].some((text) => text.trim()));
  const visibleProjects = projects.filter(({ name, role, period, description }) => [name, role, period, description].some((text) => text.trim()));

  const identity = (
    <header className="resume-identity">
      {profile.name.trim() && <h1 className="resume-name">{profile.name}</h1>}
      {profile.role.trim() && <p className="resume-role">{profile.role}</p>}
      <ContactDetails profile={profile} />
    </header>
  );

  return (
    <article
      className={`resume-paper resume-paper--${resume.templateId}${compact ? ' resume-paper--compact' : ''}`}
      style={{ '--resume-accent': resume.accent } as CSSProperties}
      aria-label={profile.name.trim() ? `${profile.name}的简历` : '简历预览'}
    >
      {sidebar ? <aside className="resume-sidebar">{identity}<Skills skills={skills} /></aside> : identity}
      <div className="resume-body">
        {profile.summary.trim() && <Section title="个人简介"><Description text={profile.summary} paragraphs /></Section>}
        {visibleExperiences.length > 0 && <Section title="工作经历">
          {visibleExperiences.map((entry) => <Entry key={entry.id} title={entry.company} subtitle={entry.role} period={entry.period} description={entry.description} />)}
        </Section>}
        {visibleEducation.length > 0 && <Section title="教育经历">
          {visibleEducation.map((entry) => <Entry key={entry.id} title={entry.school} subtitle={entry.degree} period={entry.period} description={entry.description} />)}
        </Section>}
        {visibleProjects.length > 0 && <Section title="项目经历">
          {visibleProjects.map((entry) => <Entry key={entry.id} title={entry.name} subtitle={entry.role} period={entry.period} description={entry.description} />)}
        </Section>}
        {!sidebar && <Skills skills={skills} />}
      </div>
    </article>
  );
}
