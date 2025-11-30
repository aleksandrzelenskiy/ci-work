// app/ncw/page.tsx
import ClientLocalizationWrapper from '@/app/components/ClientLocalizationWrapper';
import { T2NcwGenerator } from '@/app/workspace/components/T2/T2NcwGenerator';

export default function NcwGeneratePage() {
    return (
        <main className="min-h-screen p-8">
            <ClientLocalizationWrapper>
                <T2NcwGenerator />
            </ClientLocalizationWrapper>
        </main>
    );
}
