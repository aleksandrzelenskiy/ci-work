import { currentUser } from '@clerk/nextjs/server';

export default async function Home() {
  const loggedInUserData = await currentUser();
  const clerkUserId = loggedInUserData?.id;
  const name = loggedInUserData?.firstName + ' ' + loggedInUserData?.lastName;
  const imageUrl = loggedInUserData?.imageUrl;
  const email = loggedInUserData?.emailAddresses[0]?.emailAddress;
  return (
    <>
      <div className='p-10 flex flex-col gap-5'>
        <span>Name: {name}</span>
        <span>Email: {email}</span>
        <span>Image URL: {imageUrl}</span>
        <span>CLERK USER ID: {clerkUserId}</span>
      </div>
    </>
  );
}
