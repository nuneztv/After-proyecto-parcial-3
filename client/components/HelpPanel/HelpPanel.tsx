import { SUPPORT_EMAIL } from '@/lib/config';

// Answers describe what the app really does today
const FAQ = [
  {
    question: 'How do I save an event?',
    answer:
      'Tap the heart on an event or "Save Event" on Home. Saved events are stored in your account, so they appear on any device where you log in.',
  },
  {
    question: 'What does "Get Ticket" do?',
    answer:
      'It reserves a ticket for you. The reservation stays pending: online payment is not available yet, so no charge is made.',
  },
  {
    question: 'Why do occupancy numbers change by themselves?',
    answer:
      'Venues update their occupancy and status live. The app receives those changes in real time, without reloading.',
  },
  {
    question: 'How are distances calculated?',
    answer:
      'From the center of Cali, or from your current location if you allow it in Settings.',
  },
  {
    question: 'I forgot my password',
    answer: 'Log out, tap "Forgot password?" on the login screen and follow the link we email you.',
  },
];

export const HelpPanel = () => {
  return (
    <section className="info-card profile-panel" aria-label="Help and support">
      <strong>FAQ</strong>
      {FAQ.map((item) => (
        <details key={item.question} className="panel-faq">
          <summary>{item.question}</summary>
          <p className="muted">{item.answer}</p>
        </details>
      ))}
      <strong>Contact us</strong>
      {SUPPORT_EMAIL ? (
        <a className="see-all" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      ) : (
        <p className="muted">A support contact has not been configured yet.</p>
      )}
    </section>
  );
};
