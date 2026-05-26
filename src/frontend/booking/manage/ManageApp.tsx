import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { Reservation, TenantConfig, CalendarDate } from '@shared/types';
import type { EditData } from './types/manage';
import { useManageBooking } from './hooks/useManageBooking';
import { LoadingView } from './views/LoadingView';
import { ErrorView } from './views/ErrorView';
import { OverviewView } from './views/OverviewView';
import { EditDetailsView } from './views/EditDetailsView';
import { ChangeDateTimeView } from './views/ChangeDateTimeView';
import { CancelConfirmView } from './views/CancelConfirmView';
import { SuccessEditView } from './views/SuccessEditView';
import { SuccessCancelView } from './views/SuccessCancelView';

interface ManageAppProps {
  reservationId: string | null;
}

export const ManageApp: FunctionComponent<ManageAppProps> = ({ reservationId }) => {
  const hook = useManageBooking(reservationId);

  switch (hook.view.value) {
    case 'loading':
      return <LoadingView />;
    case 'error':
      return <ErrorView message={hook.errorMessage.value} />;
    case 'overview':
      return (
        <OverviewView
          reservation={hook.reservation as Signal<Reservation | null>}
          errorMessage={hook.errorMessage}
          goToEditDetails={hook.goToEditDetails}
          goToChangeDatetime={hook.goToChangeDatetime}
          goToCancelConfirm={hook.goToCancelConfirm}
        />
      );
    case 'edit-details':
      return (
        <EditDetailsView
          editData={hook.editData as Signal<EditData | null>}
          tenantConfig={hook.tenantConfig as Signal<TenantConfig | null>}
          errorMessage={hook.errorMessage}
          goToOverview={hook.goToOverview}
          saveEditDetails={hook.saveEditDetails}
        />
      );
    case 'change-datetime':
      return (
        <ChangeDateTimeView
          tenantConfig={hook.tenantConfig as Signal<TenantConfig | null>}
          errorMessage={hook.errorMessage}
          calYear={hook.calYear}
          calMonth={hook.calMonth}
          selectedDate={hook.selectedDate as Signal<CalendarDate | null>}
          selectedTime={hook.selectedTime}
          blockedDates={hook.blockedDates as Signal<Set<string>>}
          blockedTimes={hook.blockedTimes}
          isFetchingTimes={hook.isFetchingTimes}
          goToOverview={hook.goToOverview}
          saveDatetime={hook.saveDatetime}
          fetchBlockedDatesForMonth={hook.fetchBlockedDatesForMonth}
          selectDate={hook.selectDate}
        />
      );
    case 'cancel-confirm':
      return (
        <CancelConfirmView
          reservation={hook.reservation as Signal<Reservation | null>}
          errorMessage={hook.errorMessage}
          goToOverview={hook.goToOverview}
          confirmCancel={hook.confirmCancel}
        />
      );
    case 'success-edit':
      return (
        <SuccessEditView
          reservation={hook.reservation.value!}
          onBack={hook.goToOverview}
        />
      );
    case 'success-cancel':
      return <SuccessCancelView reservation={hook.reservation.value!} />;
    default:
      return null;
  }
};
