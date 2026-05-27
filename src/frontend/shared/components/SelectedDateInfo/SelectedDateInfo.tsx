import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { formatDateForDisplay } from '@shared/utils';
import styles from './SelectedDateInfo.module.css';

interface SelectedDateInfoProps {
  date: CalendarDate;
  onChangeDate?: () => void;
}

const SelectedDateInfo: FunctionComponent<SelectedDateInfoProps> = ({
  date,
  onChangeDate,
}) => {
  const formattedDate = formatDateForDisplay(date);

  return (
    <div>
      <p className={styles.label}>Selected Date</p>
      <div>
        <h2 className={styles.value}>{formattedDate}</h2>
      </div>
    </div>
  );
};

export default SelectedDateInfo;
