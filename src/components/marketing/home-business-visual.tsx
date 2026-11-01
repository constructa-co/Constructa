import ui from './home-business-visual.module.css';

function ProfileMark() {
  return (
    <svg className={ui.mark} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <rect x="4" y="44" width="26" height="14" /><rect x="34" y="44" width="26" height="14" />
      <rect x="18" y="26" width="28" height="14" fill="currentColor" />
      <rect x="4" y="8" width="26" height="14" /><rect x="34" y="8" width="26" height="14" />
    </svg>
  );
}

function PastWorkMark() {
  return (
    <svg className={ui.mark} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="34" height="42" /><rect x="15" y="11" width="34" height="42" />
      <rect x="24" y="16" width="34" height="42" fill="currentColor" />
    </svg>
  );
}

function ProposalMark() {
  return (
    <svg className={ui.mark} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M12 5h29l11 11v43H12z" /><path d="M41 5v11h11" />
      <path d="M12 5h8v54h-8z" fill="currentColor" />
      <path d="M28 28h16M28 37h16M28 46h9" />
    </svg>
  );
}

const stages = [
  { number: '01', title: 'Company profile', detail: 'Your company details, your story and your case studies.', Mark: ProfileMark },
  { number: '02', title: 'Relevant past work', detail: 'The examples you choose to show for this job.', Mark: PastWorkMark },
  { number: '03', title: 'Proposal', detail: 'Your experience, presented alongside your scope, price and programme.', Mark: ProposalMark },
] as const;

export function HomeBusinessVisual() {
  return (
    <figure className={ui.figure}>
      <figcaption className={ui.caption}>
        <span className={ui.qualifier}><span className={ui.tag}>Illustration</span><span>Not an app screenshot</span></span>
        <span className={ui.summary}>How your business carries through to the proposal you share.</span>
      </figcaption>
      <ol className={ui.stages}>
        {stages.map(({ number, title, detail, Mark }) => (
          <li key={number} className={ui.stage}>
            <Mark />
            <span className={ui.copy}>
              <span className={ui.number} aria-hidden="true">{number}</span>
              <strong>{title}</strong>
              <span className={ui.detail}>{detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
