import { EventForm } from '@/components/admin/EventForm/EventForm';
import { PageHeader } from '@/components/admin/PageHeader/PageHeader';
import { PrivateRoute } from '@/components/admin/PrivateRoute/PrivateRoute';

interface EditEventPageProps {
  // Next 16: dynamic route params arrive as a promise
  params: Promise<{ id: string }>;
}

const EditEventPage = async ({ params }: EditEventPageProps) => {
  const { id } = await params;

  return (
    <PrivateRoute>
      <div className="page page--no-nav">
        <PageHeader title="Edit event" backHref="/admin/events" />
        <EventForm mode="edit" eventId={id} />
      </div>
    </PrivateRoute>
  );
};

export default EditEventPage;
