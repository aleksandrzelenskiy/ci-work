import ProfilePageContent from '../ProfilePageContent';

export default async function PublicProfilePage({
    params,
}: PageProps<'/profile/[userId]'>) {
    const { userId } = await params;

    return <ProfilePageContent mode="public" userId={userId} />;
}
