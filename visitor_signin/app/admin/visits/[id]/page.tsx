import { redirect } from "next/navigation";

// Old address of the staff gate pass. The visitor details page (/visits/<id>) now has it, with more.
export default async function OldStaffPassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/visits/${id}`);
}
