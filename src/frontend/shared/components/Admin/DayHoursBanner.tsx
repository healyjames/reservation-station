import type { FunctionComponent } from 'preact';
import type { AdminBlockedDate, AdminDateOverride } from '@shared/types';
import styles from './DayHoursBanner.module.css';

type DayHoursBannerProps = {
  /** The visible day's time-range blocks, in display order. */
  blocks: AdminBlockedDate[];
  /** Special opening hours set for the visible day, if any. */
  specialHours?: AdminDateOverride | null;
  onGoSettings: () => void;
};

/** Tells staff that the visible day has changed hours. Renders nothing on a normal day. */
const DayHoursBanner: FunctionComponent<DayHoursBannerProps> = ({ blocks, specialHours = null, onGoSettings }) => {
  if (blocks.length === 0 && !specialHours) return null;

  return (
    <section class={styles.banner} role="note" aria-label="Changed hours on this day">
      <div class={styles.content}>
        <p class={styles.heading}>
          <strong>Changed hours on this day</strong>
        </p>
        {specialHours && (
          <p class={styles.special}>
            <span class={styles.range}>
              {specialHours.is_closed
                ? 'Closed on this day'
                : `Special opening hours: ${specialHours.open_time} – ${specialHours.close_time}`}
            </span>
            {specialHours.reason && <span class={styles.reason}>{specialHours.reason}</span>}
          </p>
        )}
        {blocks.length > 0 && (
          <>
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
          </>
        )}
      </div>
      <button type="button" class={styles.link} onClick={onGoSettings}>
        Change these hours
      </button>
    </section>
  );
};

export default DayHoursBanner;
