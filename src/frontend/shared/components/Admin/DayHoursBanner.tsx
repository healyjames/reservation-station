import type { FunctionComponent } from 'preact';
import type { AdminBlockedDate, AdminDateOverride } from '@shared/types';
import { Alert } from '@shared/components/ui';
import { toAdminHash } from '@shared/utils/adminRoute';

type DayHoursBannerProps = {
  /** The visible day's time-range blocks, in display order. */
  blocks: AdminBlockedDate[];
  /** Special opening hours set for the visible day, if any. */
  specialHours?: AdminDateOverride | null;
};

/** Tells staff that the visible day has changed hours, with a link to change them. Renders nothing on a normal day. */
const DayHoursBanner: FunctionComponent<DayHoursBannerProps> = ({ blocks, specialHours = null }) => {
  if (blocks.length === 0 && !specialHours) return null;

  return (
    // ui/Alert owns its role, so the note role and its name sit on a wrapper.
    <section role="note" aria-label="Changed hours on this day">
      <Alert
        variant="warning"
        title="Changed hours on this day"
        headingLevel={null}
        action={
          <a class="font-semibold whitespace-nowrap underline" href={toAdminHash('settings/opening-hours/specific-day')}>
            Change these hours
          </a>
        }
      >
        {specialHours && (
          <p class="my-1">
            <span class="font-semibold tabular-nums">
              {specialHours.is_closed
                ? 'Closed on this day'
                : `Special opening hours: ${specialHours.open_time} – ${specialHours.close_time}`}
            </span>
            {specialHours.reason && <span class="text-base-content/70 ms-3">{specialHours.reason}</span>}
          </p>
        )}
        {blocks.length > 0 && (
          <>
            <p class="my-1 text-sm">Customers cannot book a table starting in these times. Existing reservations are not affected.</p>
            <ul class="my-1 grid list-none gap-1 ps-0">
              {blocks.map((block) => (
                <li key={block.id}>
                  <span class="font-semibold tabular-nums">
                    {block.start_time} – {block.end_time}
                  </span>
                  {block.reason && <span class="text-base-content/70 ms-3">{block.reason}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Alert>
    </section>
  );
};

export default DayHoursBanner;
