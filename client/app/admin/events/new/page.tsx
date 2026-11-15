import { EventForm } from '@/components/admin/EventForm/EventForm';
import { PageHeader } from '@/components/admin/PageHeader/PageHeader';
import { PrivateRoute } from '@/components/admin/PrivateRoute/PrivateRoute';

const NewEventPage = () => {
  return (
    <PrivateRoute>
      <div className="page page--no-nav">
        <PageHeader
          title={
            <>
              Build
              <br />
              tonight&apos;s experience
            </>
          }
          backHref="/admin/events"
        />
        <EventForm mode="create" />
      </div>
    </PrivateRoute>
  );
};

export default NewEventPage;
