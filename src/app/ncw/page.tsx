// app/ncw/page.tsx
import ClientLocalizationWrapper from '@/app/components/ClientLocalizationWrapper';
import { NcwGenerator } from '@/app/components/NcwGenerator';

export default function NcwGeneratePage() {
    return (
        <main className="min-h-screen p-8">
            <ClientLocalizationWrapper>
                <NcwGenerator />
            </ClientLocalizationWrapper>
        </main>
    );
}
