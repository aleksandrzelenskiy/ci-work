import ProfilePageContent from '../ProfilePageContent';

export default function PublicProfilePage({
    params,
}: {
    params: { userId: string };
}) {
    return <ProfilePageContent mode="public" userId={params.userId} />;
}
