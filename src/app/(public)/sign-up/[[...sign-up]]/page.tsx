'use client';

import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className='flex w-full h-screen items-center justify-center bg-signin bg-cover bg-center bg-no-repeat'>
      <SignUp afterSignUpUrl='/onboarding' />
    </div>
  );
}
