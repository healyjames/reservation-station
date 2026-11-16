import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { formatDateForDisplay } from '@shared/utils';

type SelectedDateInfoProps = {
  date: CalendarDate;
  hideLabel?: boolean;
};

const SelectedDateInfo: FunctionComponent<SelectedDateInfoProps> = ({ date, hideLabel = false }) => (
  <div>
    {!hideLabel && <p class="mt-0 mb-2">Selected Date</p>}
    <div>
      {/* accent = the legacy lighter primary. */}
      <h2 class="text-accent mt-0 mb-4 text-[2.5rem] md:text-[3.5rem]">{formatDateForDisplay(date)}</h2>
    </div>
  </div>
);

export default SelectedDateInfo;
