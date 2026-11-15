import type { FunctionComponent } from 'preact';
import type { AdminBlockedDate } from '@shared/types';
import styles from './DayHoursBanner.module.css';

type DayHoursBannerProps = {
  /** The visible day's time-range blocks, in display order. */
  blocks: AdminBlockedDate[];
  onGoSettings: () => void;
};

/** Tells staff that the visible day has changed hours. Renders nothing on a normal day. */
const DayHoursBanner: FunctionComponent<DayHoursBannerProps> = ({ blocks, onGoSettings }) => {
  if (blocks.length === 0) return null;

  return (
    <section class={styles.banner} role="note" aria-label="Changed hours on this day">
      <div class={styles.content}>
        <p class={styles.heading}>
          <strong>Changed hours on this day</strong>
        </p>
        <p class={styles.subtext}>Customers cannot book a table starting in these times. Existing reservations are not affected.</p>
        <ul class={styles.list}>
          {blocks.map((block) => (
            <li key={block.id}>
              <span class={styles.range}>
                {block.start_time} – {block.end_time}
              </span>
              {block.reason && <span class={styles.reason}>{block.reason}</span>}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" class={styles.link} onClick={onGoSettings}>
        Change these hours
      </button>
    </section>
  );
};

export default DayHoursBanner;
