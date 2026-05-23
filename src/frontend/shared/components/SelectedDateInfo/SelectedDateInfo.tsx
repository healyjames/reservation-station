import type { FunctionComponent } from 'preact';
import type { CalendarDate } from '@shared/types';
import { formatDateForDisplay } from '@shared/utils';
import styles from './SelectedDateInfo.module.css';

interface SelectedDateInfoProps {
  date: CalendarDate;
  onChangeDate?: () => void;
  class?: string;
}

const SelectedDateInfo: FunctionComponent<SelectedDateInfoProps> = ({ date, onChangeDate, class: className }) => (
  <div class={`${styles.container} ${className ?? ''}`}>
    <div class={styles.label}>Selected Date</div>
    <div class={styles.value}>{formatDateForDisplay(date)}</div>
    {onChangeDate && (
      <button type="button" class={styles.changeBtn} onClick={onChangeDate}>
        Change date
      </button>
    )}
  </div>
);

export default SelectedDateInfo;
