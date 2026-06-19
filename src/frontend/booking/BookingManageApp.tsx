import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { Reservation, TenantConfig, CalendarDate } from '@shared/types';
import type { EditData } from '@shared/types';
import { useManageBooking } from '@shared/hooks/useManageBooking';
import { Loading } from '@shared/components/BookingManage/Loading';
import { Error } from '@shared/components/BookingManage/Error';
import { Overview } from '@shared/components/BookingManage/Overview';
import { EditDetails } from '@shared/components/BookingManage/EditDetails';
import { ChangeDateTime } from '@shared/components/BookingManage/ChangeDateTime';
import { CancelConfirm } from '@shared/components/BookingManage/CancelConfirm';
import { SuccessEdit } from '@shared/components/BookingManage/SuccessEdit';
import { SuccessCancel } from '@shared/components/BookingManage/SuccessCancel';

interface BookingManageAppProps {
  reservationId: string | null;
  bookingEmail: string | null;
  bookingToken: string | null;
}

export const BookingManageApp: FunctionComponent<BookingManageAppProps> = ({ reservationId, bookingEmail, bookingToken }) => {
  const hook = useManageBooking(reservationId, bookingEmail, bookingToken);

  switch (hook.view.value) {
    case 'loading':
      return <Loading />;
    case 'error':
      return <Error message={hook.errorMessage.value} />;
    case 'overview':
      return (
        <Overview
          reservation={hook.reservation as Signal<Reservation | null>}
          errorMessage={hook.errorMessage}
          goToEditDetails={hook.goToEditDetails}
          goToChangeDatetime={hook.goToChangeDatetime}
          goToCancelConfirm={hook.goToCancelConfirm}
        />
      );
    case 'edit-details':
      return (
        <EditDetails
          editData={hook.editData as Signal<EditData | null>}
          tenantConfig={hook.tenantConfig as Signal<TenantConfig | null>}
          errorMessage={hook.errorMessage}
          goToOverview={hook.goToOverview}
          saveEditDetails={hook.saveEditDetails}
        />
      );
    case 'change-datetime':
      return (
        <ChangeDateTime
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
        <CancelConfirm
          reservation={hook.reservation as Signal<Reservation | null>}
          errorMessage={hook.errorMessage}
          goToOverview={hook.goToOverview}
          confirmCancel={hook.confirmCancel}
        />
      );
    case 'success-edit':
      return <SuccessEdit reservation={hook.reservation.value!} onBack={hook.goToOverview} />;
    case 'success-cancel':
      return <SuccessCancel reservation={hook.reservation.value!} />;
    default:
      return null;
  }
};
